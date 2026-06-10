// Fetches World Cup standings + matches from football-data.org and writes the
// results docs the app scores against. Runs on a GitHub Actions cron (see
// .github/workflows/results-bot.yml). Fails loudly (exit 1) so GitHub emails on breakage.
//
// Env: FOOTBALL_DATA_TOKEN, FIREBASE_SERVICE_ACCOUNT (full JSON string).

import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { FD_TEAM_MAP, isMapComplete } from "./team-map.mjs";

const API = "https://api.football-data.org/v4/competitions/WC";

async function fd(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
  });
  if (!res.ok) throw new Error(`football-data ${path} -> HTTP ${res.status}`);
  return res.json();
}

const code = (team) => {
  const c = FD_TEAM_MAP[team?.id];
  if (!c) throw new Error(`Unmapped football-data team id ${team?.id} (${team?.name})`);
  return c;
};

// football-data group stage names look like "GROUP_A"; knockout stages like
// "LAST_32"/"LAST_16"/"QUARTER_FINALS"/"SEMI_FINALS"/"THIRD_PLACE"/"FINAL".
// Verify against real payloads when the token arrives.
// Slots are FIFA match numbers ("M73".."M104") — the app's bracket progression
// (src/data/bracketStructure.js FEEDS) depends on them. FIFA numbers matches
// chronologically, so we number each stage's fixtures by kickoff order from the
// stage's base. If two fixtures in one stage ever share a kickoff instant the
// order is ambiguous — eyeball the first run and fix via the admin page if needed.
const KO_STAGE_BASE = {
  LAST_32: 73,
  LAST_16: 89,
  QUARTER_FINALS: 97,
  SEMI_FINALS: 101,
  THIRD_PLACE: 103,
  FINAL: 104,
};

function transformStandings(payload) {
  const standings = {};
  for (const s of payload.standings ?? []) {
    if (s.type !== "TOTAL" || !s.group) continue;
    const letter = s.group.replace("GROUP_", "");
    standings[letter] = s.table.map((row) => ({
      code: code(row.team),
      played: row.playedGames,
      points: row.points,
      gd: row.goalDifference,
      gf: row.goalsFor,
    }));
  }
  return standings;
}

function transformMatches(payload) {
  const groupComplete = {};
  const koByStage = {};
  let champion = null;

  for (const m of payload.matches ?? []) {
    if (m.stage === "GROUP_STAGE") {
      const letter = m.group?.replace("Group ", "")?.replace("GROUP_", "");
      if (!letter) continue;
      groupComplete[letter] ??= { total: 0, finished: 0 };
      groupComplete[letter].total += 1;
      if (m.status === "FINISHED") groupComplete[letter].finished += 1;
    } else if (m.stage in KO_STAGE_BASE) {
      (koByStage[m.stage] ??= []).push(m);
    }
  }

  const koBySlot = {};
  for (const [stage, fixtures] of Object.entries(koByStage)) {
    fixtures.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    fixtures.forEach((m, i) => {
      const matchNumber = KO_STAGE_BASE[stage] + i;
      const winnerSide = m.score?.winner; // HOME_TEAM | AWAY_TEAM | DRAW | null
      const winner =
        m.status === "FINISHED" && winnerSide && winnerSide !== "DRAW"
          ? code(winnerSide === "HOME_TEAM" ? m.homeTeam : m.awayTeam)
          : null;
      koBySlot[`M${matchNumber}`] = {
        home: m.homeTeam?.id ? code(m.homeTeam) : null,
        away: m.awayTeam?.id ? code(m.awayTeam) : null,
        status: m.status,
        kickoff: m.utcDate ?? null,
        winner,
      };
      if (matchNumber === 104 && winner) champion = winner;
    });
  }

  const complete = {};
  for (const [g, c] of Object.entries(groupComplete)) complete[g] = c.finished >= 6;
  return { groupComplete: complete, koBySlot, champion };
}

async function main() {
  if (!process.env.FOOTBALL_DATA_TOKEN) throw new Error("FOOTBALL_DATA_TOKEN missing");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
  if (!isMapComplete()) throw new Error("team-map.mjs still has placeholder entries — fill it first");

  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = getFirestore();

  const [standingsPayload, matchesPayload] = await Promise.all([
    fd("/standings"),
    fd("/matches"),
  ]);

  const standings = transformStandings(standingsPayload);
  const { groupComplete, koBySlot, champion } = transformMatches(matchesPayload);
  const allGroupsFinal =
    Object.keys(groupComplete).length === 12 && Object.values(groupComplete).every(Boolean);

  // Official thirds = teams in the real R32 field minus the 24 group winners/runners-up.
  // (Never computed from the table — FIFA tiebreaks can go to drawing of lots.)
  const r32Slots = Object.entries(koBySlot).filter(([slot]) => Number(slot.slice(1)) <= 88);
  let thirdsAdvancing = null;
  if (allGroupsFinal && r32Slots.length === 16) {
    const top2 = new Set(
      Object.values(standings).flatMap((rows) => rows.slice(0, 2).map((r) => r.code))
    );
    thirdsAdvancing = r32Slots
      .flatMap(([, m]) => [m.home, m.away])
      .filter((c) => c && !top2.has(c));
    if (thirdsAdvancing.length !== 8) thirdsAdvancing = null; // partial R32 draw — wait
  }

  // thirdsAdvancing is only written once known — never null, so a manual
  // admin entry can't be clobbered back to null by a later bot run.
  const groupsPayload = {
    standings,
    groupComplete,
    allGroupsFinal,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (thirdsAdvancing) groupsPayload.thirdsAdvancing = thirdsAdvancing;
  await db.doc("results/groups").set(groupsPayload, { merge: true });

  if (Object.keys(koBySlot).length > 0) {
    await db.doc("results/knockout").set(
      { matches: koBySlot, champion, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  if (allGroupsFinal && r32Slots.length === 16) {
    await db.doc("config/settings").set(
      { phase: champion ? "done" : "bracket-open" },
      { merge: true }
    );
  }

  console.log(
    `ok: ${Object.keys(standings).length} groups, ` +
      `${Object.values(groupComplete).filter(Boolean).length} complete, ` +
      `${Object.keys(koBySlot).length} KO matches, champion=${champion ?? "—"}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

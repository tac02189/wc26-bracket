// Fetches World Cup standings + matches from football-data.org and writes the
// results docs the app scores against. Runs on a GitHub Actions cron (see
// .github/workflows/results-bot.yml). Fails loudly (exit 1) so GitHub emails on breakage.
//
// Env: FOOTBALL_DATA_TOKEN, FIREBASE_SERVICE_ACCOUNT (full JSON string).

import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { FD_TEAM_MAP, isMapComplete } from "./team-map.mjs";

const API = "https://api.football-data.org/v4/competitions/WC";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// football-data occasionally resets the connection (ECONNRESET) or returns a
// transient 5xx/429; both self-heal on retry. Without this a single blip fails
// the whole run and emails a false alarm. Deterministic 4xx (bad token/path)
// is NOT retried — it won't fix itself, so fail fast and loud as before.
async function fd(path) {
  const MAX = 4;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        // .trim() also drops a leading BOM (U+FEFF), which is illegal in a header.
        headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN.trim() },
      });
    } catch (err) {
      // Network-level failure (ECONNRESET/ETIMEDOUT/DNS) — retry with backoff.
      if (attempt >= MAX) throw err;
      await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
      continue;
    }
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX) {
      throw new Error(`football-data ${path} -> HTTP ${res.status}`);
    }
    await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
  }
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

// football-data is inconsistent across endpoints: standings use "Group A",
// matches use "GROUP_A". Take the trailing token either way.
const groupLetter = (g) => g?.split(/[ _]/).pop();

function transformStandings(payload) {
  const standings = {};
  for (const s of payload.standings ?? []) {
    if (s.type !== "TOTAL" || !s.group) continue;
    const letter = groupLetter(s.group);
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
      const letter = groupLetter(m.group);
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
      // Only write home/away when football-data actually has the team. The doc
      // is written with set({merge:true}), which deep-merges the matches map, so
      // OMITTING a side preserves a previously-written team instead of nulling
      // it. football-data flaps the knockout draw to TBD while it assigns the
      // third-place slots; without this a momentary empty feed clobbers known
      // R32 teams and re-gates the bracket (same reasoning as thirdsAdvancing).
      const home = m.homeTeam?.id ? code(m.homeTeam) : null;
      const away = m.awayTeam?.id ? code(m.awayTeam) : null;
      const entry = { status: m.status, kickoff: m.utcDate ?? null, winner };
      if (home) entry.home = home;
      if (away) entry.away = away;
      koBySlot[`M${matchNumber}`] = entry;
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

  // Strip a leading BOM/whitespace — some secret-setting paths prepend one.
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.replace(/^﻿/, "").trim());
  initializeApp({ credential: cert(svc) });
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
    // Teams are write-once. Slots here are numbered by kickoff order, which can
    // drift from the FIFA match numbers the bracket FEEDS depend on (and the R32
    // was seeded manually from the official draw). So once a slot has a team,
    // never overwrite it — only winner/status/kickoff keep updating. This keeps
    // a re-run or a late football-data update from re-slotting a known matchup.
    const existing = (await db.doc("results/knockout").get()).data()?.matches ?? {};
    for (const [slot, entry] of Object.entries(koBySlot)) {
      if (existing[slot]?.home) delete entry.home;
      if (existing[slot]?.away) delete entry.away;
    }
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

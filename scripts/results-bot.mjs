// Fetches World Cup standings + matches from football-data.org and writes the
// results docs the app scores against. Runs on a GitHub Actions cron (see
// .github/workflows/results-bot.yml). Fails loudly (exit 1) so GitHub emails on breakage.
//
// Env: FOOTBALL_DATA_TOKEN, FIREBASE_SERVICE_ACCOUNT (full JSON string).

import { pathToFileURL } from "node:url";
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
// Slots are FIFA match numbers ("M73".."M104"), which the bracket progression
// (src/data/bracketStructure.js FEEDS) depends on. We DON'T derive them from
// kickoff order — FIFA match numbers are not strictly chronological, so that
// mis-slotted fixtures. Instead placeKnockout() maps each fixture to its slot by
// team-pair against the seeded bracket. KO_STAGE_BASE now only marks which
// stages are knockout (membership test).
const KO_STAGE_BASE = {
  LAST_32: 73,
  LAST_16: 89,
  QUARTER_FINALS: 97,
  SEMI_FINALS: 101,
  THIRD_PLACE: 103,
  FINAL: 104,
};

// FIFA knockout progression — mirror of src/data/bracketStructure.js FEEDS:
// matchNumber -> the two match numbers whose winners meet there. Used to identify
// each later-round slot by the winners of its two feeder slots.
const FEEDS = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100], 104: [101, 102],
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

// Group-stage completeness + every knockout fixture that has both teams known
// (so it can be placed). Slot assignment happens in placeKnockout, not here.
export function transformMatches(payload) {
  const groupComplete = {};
  const koFixtures = [];

  for (const m of payload.matches ?? []) {
    if (m.stage === "GROUP_STAGE") {
      const letter = groupLetter(m.group);
      if (!letter) continue;
      groupComplete[letter] ??= { total: 0, finished: 0 };
      groupComplete[letter].total += 1;
      if (m.status === "FINISHED") groupComplete[letter].finished += 1;
    } else if (m.stage in KO_STAGE_BASE && m.stage !== "THIRD_PLACE") {
      // Third place (M103) is never picked or scored, so we don't track it.
      const home = m.homeTeam?.id ? code(m.homeTeam) : null;
      const away = m.awayTeam?.id ? code(m.awayTeam) : null;
      if (!home || !away) continue; // can't place a fixture until both teams are known
      const winnerSide = m.score?.winner; // HOME_TEAM | AWAY_TEAM | DRAW | null
      const winner =
        m.status === "FINISHED" && winnerSide && winnerSide !== "DRAW"
          ? code(winnerSide === "HOME_TEAM" ? m.homeTeam : m.awayTeam)
          : null;
      koFixtures.push({ home, away, status: m.status, kickoff: m.utcDate ?? null, winner });
    }
  }

  const complete = {};
  for (const [g, c] of Object.entries(groupComplete)) complete[g] = c.finished >= 6;
  return { groupComplete: complete, koFixtures };
}

const pairKey = (a, b) => [a, b].sort().join("|");

// Map each knockout fixture to its FIFA-numbered slot by matching its two teams
// against the bracket — R32 slots come from the seeded draw (stored home/away),
// every later slot from the winners of its two feeder slots (FEEDS). Independent
// of kickoff order (which is NOT the FIFA numbering). Loops so a freshly decided
// winner unlocks the next round in the same run. Fixtures whose teams aren't in
// the bracket yet (or that don't match the seed) are returned in `unplaced`
// rather than guessed at. Returns { placed:{slotNum:fixture}, unplaced, winners }.
export function placeKnockout(koFixtures, stored) {
  const winners = {};
  for (let n = 73; n <= 104; n++) if (stored[`M${n}`]?.winner) winners[n] = stored[`M${n}`].winner;

  const placed = {};
  const unplaced = [...koFixtures];
  let progress = true;
  while (progress) {
    progress = false;
    const slotByPair = {};
    for (let n = 73; n <= 88; n++) {
      const s = stored[`M${n}`];
      if (s?.home && s?.away) slotByPair[pairKey(s.home, s.away)] = n;
    }
    for (const [slot, [f1, f2]] of Object.entries(FEEDS)) {
      if (winners[f1] && winners[f2]) slotByPair[pairKey(winners[f1], winners[f2])] = Number(slot);
    }
    for (let i = unplaced.length - 1; i >= 0; i--) {
      const fx = unplaced[i];
      const slot = slotByPair[pairKey(fx.home, fx.away)];
      if (slot == null || placed[slot]) continue;
      placed[slot] = fx;
      if (fx.winner) winners[slot] = fx.winner;
      unplaced.splice(i, 1);
      progress = true;
    }
  }
  return { placed, unplaced, winners };
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
  const { groupComplete, koFixtures } = transformMatches(matchesPayload);
  const allGroupsFinal =
    Object.keys(groupComplete).length === 12 && Object.values(groupComplete).every(Boolean);

  // Place each fixture by team-pair against the seeded bracket (NOT kickoff order).
  const stored = (await db.doc("results/knockout").get()).data()?.matches ?? {};
  const { placed, unplaced, winners } = placeKnockout(koFixtures, stored);
  if (unplaced.length) {
    console.warn(
      "unmapped knockout fixtures (teams not in the bracket yet, or a seed mismatch): " +
        unplaced.map((f) => `${f.home} v ${f.away}`).join(", ")
    );
  }

  // Build the knockout write. Teams are write-once: once a slot has a team (the
  // seeded R32 draw, or a winner that fed a later round), never overwrite it —
  // only winner/status/kickoff keep updating. Protects the manual seed and stops
  // a flapping/late feed from re-slotting a known matchup.
  const koBySlot = {};
  for (const [n, fx] of Object.entries(placed)) {
    const slot = `M${n}`;
    const entry = { status: fx.status, kickoff: fx.kickoff, winner: fx.winner };
    if (fx.home && !stored[slot]?.home) entry.home = fx.home;
    if (fx.away && !stored[slot]?.away) entry.away = fx.away;
    koBySlot[slot] = entry;
  }
  const champion = winners[104] ?? null;

  // The real R32 field = seeded teams (stored) plus anything just placed in 73–88.
  const r32Teams = [];
  let r32Known = 0;
  for (let n = 73; n <= 88; n++) {
    const home = placed[n]?.home ?? stored[`M${n}`]?.home;
    const away = placed[n]?.away ?? stored[`M${n}`]?.away;
    if (home && away) {
      r32Known += 1;
      r32Teams.push(home, away);
    }
  }

  // Official thirds = teams in the real R32 field minus the 24 group winners/
  // runners-up. (Never computed from the table — FIFA tiebreaks can go to lots.)
  let thirdsAdvancing = null;
  if (allGroupsFinal && r32Known === 16) {
    const top2 = new Set(
      Object.values(standings).flatMap((rows) => rows.slice(0, 2).map((r) => r.code))
    );
    thirdsAdvancing = r32Teams.filter((c) => c && !top2.has(c));
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

  if (allGroupsFinal && r32Known === 16) {
    await db.doc("config/settings").set(
      { phase: champion ? "done" : "bracket-open" },
      { merge: true }
    );
  }

  console.log(
    `ok: ${Object.keys(standings).length} groups, ` +
      `${Object.values(groupComplete).filter(Boolean).length} complete, ` +
      `${Object.keys(koBySlot).length} KO written, ${unplaced.length} unmapped, ` +
      `champion=${champion ?? "—"}`
  );
}

// Only run when invoked directly (node scripts/results-bot.mjs) — importing this
// module for its placement helpers (tests) must not kick off a live fetch/write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

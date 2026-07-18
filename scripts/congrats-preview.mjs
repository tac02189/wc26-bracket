// Dev harness — render the congrats email with LIVE pool data but a SIMULATED
// champion (the Final is tomorrow). Reads only: no sends, no flag claims.
// Writes sample .html/.txt files to the scratchpad for eyeballing.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildCongrats, buildStandings, congratsViewFor, fetchPoolData } from "./reminders.mjs";

const OUT = process.argv[2];
if (!OUT) throw new Error("usage: node scripts/_congratspreview.mjs <outdir>");
mkdirSync(OUT, { recursive: true });

const svc = JSON.parse(readFileSync(new URL("../wc26bracketkey.json", import.meta.url)));
initializeApp({ credential: cert(svc) });
const db = getFirestore();

const data = await fetchPoolData(db);
let simulated = false;
if (!data.results.knockout?.champion) {
  // Simulate the Final: whoever is home in M104 wins (grades champion picks too).
  const m104 = data.results.knockout?.matches?.M104;
  const champ = m104?.home ?? "FRA";
  data.results.knockout = {
    ...data.results.knockout,
    champion: champ,
    matches: {
      ...data.results.knockout.matches,
      M104: { ...m104, winner: champ, status: "FINISHED" },
    },
  };
  simulated = true;
}
const champion = data.results.knockout.champion;
console.log(`champion=${champion}${simulated ? " (SIMULATED — real Final not played yet)" : ""}\n`);

const standings = buildStandings(data);
console.log("=== OVERALL TOP 5 ===");
standings.overall.slice(0, 5).forEach((r) => console.log(`  ${r.rank}. ${r.displayName} — ${r.score.total}`));
console.log("\n=== LEAGUES ===");
for (const l of Object.values(standings.leagues)) {
  const ws = l.table.filter((r) => r.rank === 1).map((r) => r.displayName).join(" & ");
  console.log(`  ${l.name} (${l.table.length} members) — winner: ${ws}`);
}

// Render three representative recipients: overall winner, a multi/1-league member, a league-less member.
const byUid = new Map(standings.overall.map((r) => [r.uid, r]));
const overallWinner = standings.overall.find((r) => r.rank === 1);
const inLeague = standings.overall.find((r) => (standings.memberships.get(r.uid) && Object.keys(standings.memberships.get(r.uid)).length > 0) && r.rank !== 1);
const noLeague = standings.overall.find((r) => !Object.keys(standings.memberships.get(r.uid) ?? {}).length && r.rank !== 1);

console.log("\n=== SAMPLE EMAILS ===");
for (const [tag, row] of [["winner", overallWinner], ["league-member", inLeague], ["no-league", noLeague]]) {
  if (!row) { console.log(`${tag}: (no such user)`); continue; }
  const view = congratsViewFor({ uid: row.uid, name: row.displayName, email: "x@x" }, standings);
  const { subject, text, html } = buildCongrats(view, champion);
  writeFileSync(`${OUT}/${tag}.html`, html);
  writeFileSync(`${OUT}/${tag}.txt`, `SUBJECT: ${subject}\n\n${text}`);
  console.log(`${tag}: ${row.displayName} -> subject "${subject}"`);
}
console.log(`\nfiles in ${OUT}`);

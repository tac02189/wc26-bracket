// Official 2026 knockout progression, keyed by FIFA match number
// (verified 2026-06-09 from the published schedule — note it is NOT sequential:
// match 89 is W74 v W77). Slots everywhere are "M73".."M104".
// Match 103 (third place) exists in results but is never picked or scored.

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const ROUNDS = [
  { key: "R32", label: "Round of 32", matches: range(73, 88) },
  { key: "R16", label: "Round of 16", matches: range(89, 96) },
  { key: "QF", label: "Quarterfinals", matches: range(97, 100) },
  { key: "SF", label: "Semifinals", matches: [101, 102] },
  { key: "F", label: "Final", matches: [104] },
];

// matchNumber -> the two matches whose winners meet there
export const FEEDS = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100],
  104: [101, 102],
};

export const roundOf = (n) =>
  n <= 88 ? "R32" : n <= 96 ? "R16" : n <= 100 ? "QF" : n <= 102 ? "SF" : n === 103 ? "TP" : "F";

export const slotOf = (n) => `M${n}`;
export const numOf = (slot) => Number(slot.slice(1));

// All pickable matches in feed order (ascending = topological).
export const PICKABLE = ROUNDS.flatMap((r) => r.matches);

// Given real R32 fixtures + a winners map, resolve the two teams of match n.
// Returns [home, away] where each is a team code or null (unresolved).
export function teamsOf(n, koMatches, winners) {
  if (n <= 88) {
    const m = koMatches?.[slotOf(n)];
    return [m?.home ?? null, m?.away ?? null];
  }
  const [f1, f2] = FEEDS[n];
  return [winners?.[slotOf(f1)] ?? null, winners?.[slotOf(f2)] ?? null];
}

// After any pick change, drop downstream picks that no longer match a feeder team.
// Walk ascending (topological) so invalidations cascade naturally.
export function sanitizeWinners(winners, koMatches) {
  const next = { ...winners };
  for (const n of PICKABLE) {
    const slot = slotOf(n);
    if (!next[slot]) continue;
    const [home, away] = teamsOf(n, koMatches, next);
    if (next[slot] !== home && next[slot] !== away) delete next[slot];
  }
  return next;
}

// Display order for a bracket-tree layout: each round listed so the two feeders
// of every next-round match sit at adjacent positions (2j and 2j+1). Built by
// expanding the Final down through FEEDS, so it stays correct if the official
// progression ever changes. Keyed by round: { R32:[…16], R16:[…8], …, F:[104] }.
export const BRACKET_ORDERS = (() => {
  const last = ROUNDS[ROUNDS.length - 1];
  const orders = { [last.key]: [...last.matches] };
  for (let i = ROUNDS.length - 2; i >= 0; i--) {
    orders[ROUNDS[i].key] = orders[ROUNDS[i + 1].key].flatMap((p) => FEEDS[p]);
  }
  return orders;
})();

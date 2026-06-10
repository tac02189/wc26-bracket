// Verified 2026-06-09 from ESPN + Sky Sports day-by-day schedule:
//   Opener: Mexico–South Africa, Estadio Azteca, June 11 — 13:00 Mexico City = 19:00 UTC.
//   First Round-of-32 match: Sun June 28, 8pm UK = 19:00 UTC (match 73, Los Angeles).
// These mirror the enforced lock instants hardcoded in firestore.rules —
// keep both in sync if a time ever changes (rules redeploy required).

export const GROUP_LOCK_AT = Date.UTC(2026, 5, 11, 19, 0, 0);
export const BRACKET_LOCK_AT = Date.UTC(2026, 5, 28, 19, 0, 0); // re-verify before v2.0 ships

export const GROUP_STAGE_ENDS = Date.UTC(2026, 5, 27, 23, 59, 0); // last group matches June 27

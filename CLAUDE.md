# World Cup Bracket — Project Instructions

Extends the root `[3] Claude/CLAUDE.md`. Read that first.

## What this is

WC26 Pool — friends & family prediction pool for the 2026 World Cup at
**https://wc26-bracket.web.app**. Two phases: rank all 12 groups + pick 8
third-place advancers (locks at the opening kickoff, **June 11 2026 19:00 UTC**),
then a knockout bracket against the real Round of 32 (locks **June 28 2026
19:00 UTC**). Escalating points per round; leaderboard scored client-side.

## Stack & shape

React 18 + Vite + Tailwind v4 (`@tailwindcss/vite`, theme tokens in
`src/index.css`). Firebase: Auth (Google), Firestore, Hosting — project
`wc26-bracket`, single init in `src/firebase.js`. No router, no state lib —
`App.jsx` is a bottom-tab shell.

Key invariants:
- **Lock times are enforced in `firestore.rules`** (hardcoded `request.time`
  comparisons) and mirrored in `src/data/schedule.js`. Change one → change both
  → `firebase deploy --only firestore:rules`.
- **Rules are not filters**: never run collection queries over `groupPicks`/
  `bracketPicks` before the corresponding lock has passed — gate on lock time.
- Scoring values live ONLY in `src/data/scoring.js`; the Rules page renders
  from it. Never duplicate point values elsewhere.
- Teams are keyed by 3-letter codes in `src/data/tournament.js`; the results
  bot maps football-data.org **team ids** (never names) via
  `scripts/team-map.mjs`.
- Picks docs are per-user whole-doc autosaves (`groupPicks/{uid}`,
  `bracketPicks/{uid}`) via `src/lib/autosave.js` (`useLockedAutosave`) — that
  hook carries hard-won fixes (stale-tab clobber, offline hydration, unmount
  flush); don't hand-roll saves around it. Partial picks are legal everywhere —
  scoring skips gaps.
- Admin = `tac02189@gmail.com`, gated by verified email in TWO places that must
  stay identical: `isAdmin()` in `firestore.rules` (requires rules redeploy)
  and the `ADMIN_EMAIL` check in `App.jsx` (cosmetic tab visibility). Rules
  write-shape checks mean picks docs may only contain their exact known fields.

## Results pipeline (v1.1)

`.github/workflows/results-bot.yml` cron → `scripts/results-bot.mjs` →
football-data.org (`WC` competition) → writes `results/groups`,
`results/knockout`, `config/settings.phase` via firebase-admin. Secrets
`FOOTBALL_DATA_TOKEN` + `FIREBASE_SERVICE_ACCOUNT` live only in GitHub Actions.
Official third-place advancers derive from who appears in the real R32
fixtures, never from a computed table. Admin page (Thiago's UID in
`config/settings.adminUid` + `firestore.rules`) writes the same shapes — full
manual fallback.

## Deploy

`npm run deploy` (build + `firebase deploy`). Hosting + rules deploy together
with plain `firebase deploy`.

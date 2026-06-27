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
  comparisons) and mirrored in `src/data/schedule.js` AND in
  `scripts/reminders.mjs` (`BRACKET_LOCK_AT`, for the "2h to lock" email). Change
  one → change all three → `firebase deploy --only firestore:rules`.
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
- **Leagues** (`src/lib/leagues.js`) are named leaderboard slices, NOT privacy
  walls — one global set of picks/scores; a league only narrows who you rank
  against. Admin-created `leagues/{code}` (doc id = share code); membership is
  denormalized on `users/{uid}.leagues` as `{code: name}` so the leaderboard
  filters with zero extra reads. `users/{uid}.leaguesView` (same shape) grants
  view-only access — the selector unions it in (Eye icon), but the membership
  filter keys off `leagues` only, so a viewer sees the board without appearing
  in it. Join link = `?join={code}` (handled by `JoinBanner`). Reveal/lock
  semantics are unchanged and remain global.

## Results pipeline (v1.1)

`.github/workflows/results-bot.yml` cron → `scripts/results-bot.mjs` →
football-data.org (`WC` competition) → writes `results/groups`,
`results/knockout`, `config/settings.phase` via firebase-admin. Secrets
`FOOTBALL_DATA_TOKEN` + `FIREBASE_SERVICE_ACCOUNT` live only in GitHub Actions.
Official third-place advancers derive from who appears in the real R32
fixtures, never from a computed table. Admin page (Thiago's UID in
`config/settings.adminUid` + `firestore.rules`) writes the same shapes — full
manual fallback.

## Reminder emails (v1.2)

`.github/workflows/reminders.yml` cron (every 15 min) → `scripts/reminders.mjs`
→ Gmail SMTP (nodemailer). Two one-shot emails, each guarded by a flag in
`config/reminders` claimed in a transaction BEFORE sending (at-most-once; the
repeating cron can't double-send): **(1)** "bracket is open" to everyone with a
real verified email, fired when `config/settings.phase === "bracket-open"`;
**(2)** "2h to lock" fired inside the 2h window before `BRACKET_LOCK_AT`, sent
ONLY to uids whose `bracketPicks` doc isn't complete (all 31 slots filled —
mirrors `PICKABLE` in `src/data/bracketStructure.js`). Recipients come from
`admin.auth().listUsers()`; PIN accounts (synthetic `@wc26pool.app`, unverified)
are filtered out, as is anyone with `users/{uid}.emailOptOut === true`. Secrets
`GMAIL_USER` + `GMAIL_APP_PASSWORD` live only in GitHub Actions (Gmail account
needs 2-Step Verification + an app password). Re-run via the workflow's "Run
workflow" button after clearing the relevant `config/reminders` flag to resend.

## Deploy

`npm run deploy` (build + `firebase deploy`). Hosting + rules deploy together
with plain `firebase deploy`.

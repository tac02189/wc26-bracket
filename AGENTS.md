# Agent entry point

Read [CLAUDE.md](CLAUDE.md) before changing the app and [README.md](README.md)
for setup. This is a shared family project owned by `tac02189`.

- Work on a feature branch and submit changes through a PR; no direct main commits.
- Keep lock times synchronized across `src/data/schedule.js`, `firestore.rules`,
  and `scripts/reminders.mjs`.
- Keep scoring values in `src/data/scoring.js` and use the existing autosave hook.
- Preserve the exact Firestore write shapes and time-gated picks queries.
- Do not commit credentials, service-account keys, or copies of live player data.
- Results imports write production Firestore; they are not local validation commands.
- `npm run build` validates the frontend build. `npm run deploy` publishes hosting
  and rules and is a separate operational action.

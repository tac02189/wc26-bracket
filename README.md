# WC26 Pool

Friends and family prediction pool for the 2026 World Cup, hosted at
<https://wc26-bracket.web.app>. Players submit group rankings and knockout
brackets; the leaderboard scores picks against tournament results.

The upstream project records the 2026 tournament as complete. Results and reminder
cron schedules are paused; manual workflow dispatch remains available. See
[CLAUDE.md](CLAUDE.md) for the relaunch procedure.

## Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

React 18 + Vite + Tailwind 4; Firebase Auth, Firestore, and Hosting.
Deployment is `npm run deploy` (build plus Firebase deployment, including rules).
The URL is the documented deployment; this workspace review did not check live status.

## Layout and docs

- `src/` — app shell, views, shared autosave, tournament data, and scoring.
- `firestore.rules` — access control, write validation, and pick lock times.
- `scripts/` — results importer and stable team-ID mapping.
- `.github/workflows/results-bot.yml` — results import workflow; automatic schedule paused.
- [CLAUDE.md](CLAUDE.md) — architecture, invariants, results pipeline, and deployment.
- [AGENTS.md](AGENTS.md) — contribution and data-safety guardrails.

This checkout tracks `tac02189/wc26-bracket`. Changes go on a branch and through
a pull request; do not commit directly to `main`.

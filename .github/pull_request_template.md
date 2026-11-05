## What changed

<!-- One or two sentences on what this PR does. -->

## Ticket

<!-- e.g. T7 — Foundation for klindic/hair-saloon -->

## How this was verified

<!-- Commands run, what you watched happen. Don't claim CI passed if you haven't seen it run. -->

- [ ] `npm run verify` — the required gate: lint, format check, typecheck, contract check, unit
      tests, Apps Script build, production build, Pages build check.
- [ ] `npm run test:e2e` / `npm run verify:all` — optional locally, required in CI.

## Contract

- [ ] `shared/contract.ts` was not changed, OR it was, and both the frontend and the Apps Script
      backend were updated to match in this PR.

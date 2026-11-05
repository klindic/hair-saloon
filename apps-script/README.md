# Apps Script backend

The booking backend is a Google Apps Script web app. It is written in
TypeScript under `src/`, bundled by esbuild into a single flat script,
and deployed with `clasp`. Apps Script has no module system at runtime,
so the bundle must expose `doGet` and `doPost` as plain globals - that is
what `build.mjs` does.

## Building

```
npm run script:build
```

This runs `apps-script/build.mjs`, which bundles `src/main.ts` into
`apps-script/dist/Code.js` and copies `src/appsscript.json` next to it.
`apps-script/dist` is gitignored; it is build output, not source.

## Testing

The domain layer (`src/domain/`) is plain TypeScript with no Apps Script
globals, so it runs under Vitest in plain Node:

```
npm run test:script
```

Anything that touches `SpreadsheetApp`, `LockService`, `UrlFetchApp` etc.
cannot be unit tested this way - it has no Node equivalent - and must be
exercised inside Apps Script itself (manually, or via `clasp run`).

## Pushing to a script for development

`clasp push` (via `npm run script:push`) uploads `apps-script/dist` to
whatever script ID is configured in the repo-root `.clasp.json`. That
file ships with an empty `scriptId` and `rootDir` pointing at
`apps-script/dist`. To develop against a real script, create your OWN
throwaway Apps Script project, run `clasp login` to authenticate as
yourself, fill in the `scriptId` locally (do not commit a real one), and
push from there.

## Production deployment

Production deploys from the CEO's own Google account, because the Apps
Script web app runs as whoever owns the script (`executeAs:
USER_DEPLOYING`) and clasp authenticates as a logged-in user, not a
service account. We have no credential for that account and must not
create one. Shipping a build to production is therefore a manual step
the CEO performs themselves: pull this repo, run `npm run script:build`,
then `clasp login` and `clasp push` from their own machine using their
own script ID.

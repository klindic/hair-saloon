# E2E tests

Playwright tests against the production build (`ng build`), served statically from
`dist/hair-saloon/browser` by `tools/serve-static.mjs` on port 4310 — not `ng serve`.

`tools/serve-static.mjs` takes optional `--port` and `--base` flags and behaves like GitHub
Pages: any path that is not a real file gets `404.html` back with a 404 status, which is how a
deep link reaches the Angular router in production.

## First time on a machine

```
npx playwright install chromium
```

Playwright needs its own browser binary; this downloads it once. `npm run test:e2e` and
`npm run verify:all` will fail without it.

## Run

```
npm run test:e2e
```

This builds the app, starts the static server, and runs the suite across two projects: a
desktop Chromium project and a Pixel 5 mobile project.

The suite is three tests:

- the app root loads, responds 200, and renders its heading with no console error;
- a deep link to `/book` falls back to the SPA — the server returns a 404 status but the page
  still routes to the right screen, because `404.html` is a copy of `index.html`
  (`tools/pages-postbuild.mjs`) and the Angular router takes it from there;
- an unknown deep link renders the not-found page.

## Run headed

```
npm run test:e2e -- --headed
```

## Report

HTML report writes to `playwright-report/`. Open it with:

```
npx playwright show-report
```

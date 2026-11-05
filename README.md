# Hair Saloon

A salon booking site: a customer picks a slot on their phone, and the request lands as a row in
the salon owner's own Google Sheet.

## What you need

- Node, pinned in `.nvmrc` (currently 24.22.2). Install it with
  [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm), then run
  `fnm use` (or `nvm use`) in this directory before anything else.
- npm (ships with Node).

Angular 22's CLI requires Node >= 24.15.0, or >= 22.22.3 on the 22.x line. An older Node fails at
`npm install`, not later, so get the pinned version first — this is the mistake most likely to
cost someone an hour.

## Run it

```bash
npm install
npm start
```

`npm start` serves the app at `http://localhost:4200` with live reload.

## Before you open a pull request

```bash
npm run verify
```

This is the one command every engineer runs before opening a pull request. It runs, in order:
lint, format check, typecheck, the contract check, the Angular unit tests, the Apps Script unit
tests, the Apps Script bundle build, the production build, the Pages build check, and the bundle
secret check. If
`npm run verify` is green, the pull request is ready to open.

`npm run verify:all` runs `npm run verify` and then the Playwright end-to-end suite on top. CI
runs `npm run verify` and then the same Playwright suite as separate steps, so it fails fast on a
lint error instead of downloading a browser first — the checks are identical either way. Running
the Playwright half yourself needs `npx playwright install chromium` once per machine (see
`e2e/README.md`).

## Everyday commands

| Command                    | Does                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `npm start`                | Serves the app locally with live reload (`ng serve`).              |
| `npm run build`            | Production build, plus `index.html` to `404.html` and `.nojekyll`. |
| `npm run build:pages`      | Same build, with `--base-href /hair-saloon/` for Pages.            |
| `npm run preview`          | Builds for Pages and serves it like Pages — see below.             |
| `npm run lint`             | Lints the whole repo with ESLint.                                  |
| `npm run format`           | Formats the whole repo with Prettier, writing the changes.         |
| `npm run format:check`     | Checks formatting without writing — what `verify` runs.            |
| `npm run typecheck`        | Type-checks the app, the specs, the backend and e2e.               |
| `npm run check:contract`   | Checks the sheet template against the contract — see below.        |
| `npm run check:pages`      | Builds for Pages and asserts base href, 404 fallback, asset paths. |
| `npm run check:no-secrets` | Scans the production bundle for embedded credentials.              |
| `npm test`                 | Runs the Angular unit tests (`ng test`).                           |
| `npm run test:script`      | Runs the Apps Script unit tests under Vitest, in Node.             |
| `npm run test:e2e`         | Runs the Playwright end-to-end suite (see `e2e/README.md`).        |
| `npm run verify`           | The required pre-pull-request gate — see above.                    |
| `npm run verify:all`       | `verify` plus `test:e2e` — the same checks CI runs.                |
| `npm run script:build`     | Bundles `apps-script/src/main.ts` into `apps-script/dist/Code.js`. |
| `npm run script:push`      | Pushes `apps-script/dist` to the Apps Script project via `clasp`.  |

`npm run preview` builds with the GitHub Pages base href and serves it at
`http://localhost:4310/hair-saloon/` via `tools/serve-static.mjs`, behaving like Pages: any path
that is not a real file gets `404.html` back with a 404 status. Use this, not `ng serve`, to look
at the real built site — deep links included.

`npm run check:contract` asserts that the sheet column order in `docs/sheet-template.md` still
matches the `BOOKINGS_COLUMNS` / `SERVICES_COLUMNS` constants in `shared/contract.ts`, that the tab
names agree, that every shipped JSON file parses, and that `src/assets/config.json` carries exactly
its three expected keys and no extras — an extra key is how a credential would end up in a public
browser bundle. See `shared/README.md`.

`npm run check:pages` builds with the Pages base href, serves that build the way Pages serves it,
and asserts over HTTP that the base href landed in `index.html`, that a deep link falls back to
the SPA shell with a 404 status, and that the runtime config and demo fixtures resolve under the
base path. The Playwright suite covers the browser actually booting; this covers the deploy path
itself.

## Demo mode vs configured mode

The data behind the site splits three ways:

- `src/data/services.json` and `src/data/hours.json` are compiled **into** the bundle and are
  the source of truth for the slot grid in both demo mode and configured mode — the grid has to
  paint before any network call returns. Changing a price or an opening time is a commit and a
  deploy, not a spreadsheet edit. See `src/data/README.md`.
- `src/assets/config.json` is fetched at startup and is the one file the CEO edits to go live.
  It ships blank — the three keys present, each an empty string. While any key is blank the app
  runs in **demo mode**; fill in the Auth0 domain, the Auth0 SPA client id, and the Apps Script
  `/exec` URL (see the shape in `src/assets/config.example.json`) and the same build switches to
  **configured mode**, talking to the real backend.
- `src/assets/fixtures/busy.json` is fetched in demo mode only, standing in for the availability
  endpoint's response.

One build artefact serves both modes. The only difference between a demo deployment and the
CEO's live site is the contents of `config.json`, not the code.

## No `.env` file

There is no `.env` in this project, on purpose. Configuration is a runtime JSON file fetched at
startup rather than something compiled into the bundle, so a single build serves both demo and
configured deployments, and no credential able to touch the sheet ever reaches the browser — the
only secrets in this system live inside Auth0's SPA PKCE flow (which ships no client secret) and
inside the Apps Script deployment, which the CEO owns.

## More

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the agreed design and why it is shaped this way.
- [CONVENTIONS.md](./CONVENTIONS.md) — naming, boundaries and testing rules.
- [DEPLOYMENT.md](./DEPLOYMENT.md) — CI, how it ships to GitHub Pages, configuration, what is not
  set up yet.
- [docs/](./docs/) — the Google Sheet template and architecture decision records.

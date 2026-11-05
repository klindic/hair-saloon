# Deployment

## Running locally

```bash
fnm use    # or: nvm use — installs/selects the Node version pinned in .nvmrc
npm install
npm start
```

`npm start` serves the app at `http://localhost:4200` with live reload, talking to no backend —
there is no local server to run beyond the Angular dev server. See the README for the full command
table.

## What CI checks

One workflow, `.github/workflows/ci.yml`, runs on every pull request against `main` and on every
push to `main`:

1. `npm ci` on the Node version pinned in `.nvmrc`.
2. `npm run verify` — lint, format check, typecheck (app, specs, Apps Script, e2e), the sheet/
   contract check, the Angular unit tests, the Apps Script unit tests, the Apps Script bundle
   build, the production build, and the Pages build check. This is the exact command an engineer
   runs before opening a pull request — CI has no separate step list, so "green locally" and
   "green in CI" cannot drift apart.
3. `npx playwright install --with-deps chromium`, then `npm run test:e2e` — the Playwright suite
   against the real built bundle served the way Pages serves it, not against the dev server.
4. On failure, the Playwright HTML report is uploaded as a build artefact for 7 days.

A pull request runs all of this and deploys nothing. Only a push to `main` can lead to a deploy.

One thing worth knowing about, not blocking: `npm audit` currently reports 21 advisories, all of
them in devDependencies pulled in transitively by `@google/clasp` (a `zod` version), none of them
reachable from the shipped browser bundle or from any script CI runs. `npm audit --omit=dev`
reports zero. Not fixing this now because the available fix is a breaking downgrade of `clasp`
itself; worth revisiting next time `clasp` is touched.

## How it ships

`.github/workflows/deploy.yml` deploys to GitHub Pages. It does not duplicate CI's checks — it
triggers on CI finishing (`workflow_run`), and only proceeds if that run succeeded and was on
`main`, so nothing reaches Pages that has not passed the same gate as a pull request. A
`workflow_dispatch` trigger allows a manual re-deploy with no new commit.

The job builds with `npm run build:pages` (the production build with `--base-href /hair-saloon/`,
plus `404.html` and `.nojekyll` written by `tools/pages-postbuild.mjs`), then deploys the output
via `actions/upload-pages-artifact` and `actions/deploy-pages`. Authentication to Pages is GitHub's
OIDC token (`id-token: write` in the workflow's permissions) — no PAT, no secret, nothing stored in
the repository. A `concurrency` group serialises deploys so two cannot race.

**This is already live.** GitHub Pages is enabled on `klindic/hair-saloon` with the build source
set to GitHub Actions, and the site is serving at <https://klindic.github.io/hair-saloon/> in demo
mode, built from the current `main`. I verified this directly against the repository (`gh api
repos/klindic/hair-saloon/pages`, `gh run list`, and an HTTP request to the live URL) rather than
assuming the workflow files mean the site is actually up.

The Apps Script side of the architecture is deliberately outside this pipeline and cannot be
brought inside it: pushing to the CEO's Apps Script project (`npm run script:build` then
`npm run script:push`, i.e. `clasp push`) requires `clasp` to be authenticated as the CEO's own
Google account, which is a credential nobody on this team holds. No workflow in this repository
runs `clasp login` or `clasp push`. `npm run verify` builds the Apps Script bundle to prove it
compiles; it never pushes it. The actual push is a documented manual step in `docs/handover.md`,
run by whoever is sitting at the CEO's logged-in Google account.

## Configuration

There is no `.env` file and no environment variable in this project, on purpose — this is a
deliberate deviation from the usual default, not an oversight. Configuration is a runtime JSON
file, `src/assets/config.json`, fetched by `ConfigService` after the app loads, so one build
artefact serves both the demo deployment and the CEO's eventual live deployment; only the contents
of that file differ. It ships with three keys present and blank:

| Key             | What it is                                             | Where its value comes from     |
| ---------------- | ------------------------------------------------------ | ------------------------------- |
| `auth0Domain`    | The Auth0 tenant domain                                 | Auth0 application settings      |
| `auth0ClientId`  | The Auth0 SPA application's client ID                  | Auth0 application settings      |
| `apiBaseUrl`     | The deployed Apps Script web app's `/exec` URL          | Apps Script deployment screen    |

None of these three is a secret: they are a tenant name, a public SPA client identifier (Auth0 SPA
clients ship no client secret, by design of the PKCE flow), and a URL. While any of the three is
blank, `ConfigService` falls back to demo mode. `npm run check:contract` asserts `config.json`
carries exactly these three keys and no extras, mechanically, on every `verify` run — an extra key
is how a credential would end up in a public browser bundle, so this is enforced by tooling rather
than by review discipline.

The only real secrets in this system never reach this repository or this pipeline at all: the
Auth0 application's management-side settings (not needed by the SPA flow), and the OAuth session
`clasp login` creates on whoever's machine pushes the Apps Script project — stored in
`~/.clasprc.json` on that machine, which `.gitignore` excludes, and never committed.

I checked every tracked file in the repository for anything that looks like a committed credential
(API keys, private key blocks, service account JSON, client secrets) and found none. `.clasp.json`
at the repository root ships with a blank `scriptId` — that is an identifier, not a secret, and
gets filled in during the handover's manual deploy step.

## What is not set up yet

- **The Apps Script backend is not deployed.** `.clasp.json` has a blank `scriptId`, and nothing
  has been pushed to a real Apps Script project. This cannot be done from CI or by this team —
  see "How it ships" above — and is a documented manual step in `docs/handover.md`.
- **No Auth0 application exists yet.** `config.json` ships blank. Creating it is also a manual step
  in the handover document.
- **No Google Sheet exists yet.** The database the whole system depends on has not been created;
  `docs/sheet-template.md` is the spec for it, not the sheet itself.
- **The site is live, but only in demo mode.** Going fully live is the one-commit change described
  in `docs/handover.md` (filling in `config.json`'s three keys), and it is reversible — reverting
  that commit and letting it redeploy puts the site back into demo mode with no other change.
- **No error tracking or uptime monitoring.** If the live site breaks, or the Apps Script endpoint
  starts failing, nobody is notified — the only signal is a customer or the owner noticing. GitHub
  Actions' own run history is the only thing being watched, and nobody is watching it on a
  schedule. Acceptable for a single-salon demo-mode site; worth naming before this is treated as
  "production" in the owner's head.
- **No custom domain.** The site serves from `github.io`, which is fine for v1 and free; a custom
  domain is a CEO decision (and a cost, if the domain itself isn't already owned) I have not
  assumed.
- **If `klindic/hair-saloon` changes remote** (a transfer, a rename), the Pages URL changes and the
  Auth0 allowed callback/logout/origin URLs must be updated in the same change, or login breaks the
  moment the new URL goes live. This is a numbered step in `docs/handover.md`, not something this
  pipeline detects or guards against automatically.

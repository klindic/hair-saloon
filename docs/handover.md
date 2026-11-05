# Handover

This is the click-by-click the CEO (or whoever is sitting at the CEO's logged-in
Google account) follows to take the site from a build on GitHub to a live
booking page. Some steps below depend on screens nobody on this team has seen
yet, or on frontend work not yet built. Those steps are marked **TODO** rather
than guessed, with a named owner for the gap.

## 0. Enable GitHub Pages on the repository

**Already done — nothing to do here.** Recorded because it is a repository
setting no workflow can set for itself, and because it is the first thing to
check if a deploy ever stops arriving: in **Settings → Pages**, the build and
deployment source must be **GitHub Actions**. It was already set that way when
the foundation was pushed, and the demo-mode site went live from that alone,
with no Auth0 application and no Apps Script endpoint in existence:

<https://klindic.github.io/hair-saloon/>

## 1. Create the Google Sheet

Follow `docs/sheet-template.md` exactly: three tabs named `Bookings`,
`Services` and `Hours and Closures`, with the column headers in that file in
that exact order. This sheet is the database — there is no other data store.

## 2. Create the Auth0 application

- Create an Auth0 tenant (or use an existing one — **TODO, unconfirmed:**
  whether the tenant must be created under the CEO's own account or can be
  created elsewhere and handed over is not established anywhere in this
  repository; confirm with whoever sets this step up first).
- Create an application of type **Single Page Application**.
- Add a **Google** social connection so customers can sign in with a Google
  account.
- Set the allowed callback URLs, allowed logout URLs and allowed web origins.
  The site's GitHub Pages URL is `https://klindic.github.io/hair-saloon/`
  (from the `--base-href /hair-saloon/` in the `build:pages` script in
  `package.json`, which is the single place that path is written, and from the
  `origin` git remote already configured in this repository). **TODO, unconfirmed:** the exact callback
  path depends on the Auth0 login code, which has not been built yet — there
  is no callback route in `src/app/app.routes.ts` today. Whoever builds that
  integration confirms the exact URL (likely the site root, possibly with a
  path segment) and updates this section.
- Copy the **Domain** and the **Client ID** from the application's settings
  screen once it is created. **Unconfirmed:** the exact on-screen labels for
  these fields, since nobody on this team has opened the Auth0 dashboard to
  check; use whichever fields hold the tenant domain and the SPA client
  identifier.

These two values go into `src/assets/config.json` in step 4.

## 3. Deploy the Apps Script web app

- Open the Apps Script project bound to the sheet from step 1. **TODO,
  unconfirmed:** the exact menu path in Google Sheets for opening the bound
  Apps Script editor, since nobody on this team has that sheet open to check
  the current label; whoever does this step confirms it.
- Copy that project's script ID into the `scriptId` field of `.clasp.json` at
  the repository root (it ships blank).
- From a machine logged into the CEO's Google account, run `clasp login`,
  then `npm run script:build` followed by `npm run script:push` (per
  `package.json`) to build `apps-script/dist/Code.js` and push it, along with
  `apps-script/dist/appsscript.json`, to that Apps Script project. Running
  `npm install` first needs the Node version in `.nvmrc`; see the README.
- Create a new deployment of type **Web app**. The pushed manifest
  (`apps-script/src/appsscript.json`) already specifies the values this
  deployment needs: execute the script as the account that is deploying it
  (so it runs with the CEO's own access to the sheet), and make access
  anonymous (so the read path can be called by a signed-out visitor).
  **Unconfirmed:** the exact wording of the "execute as" and "who has access"
  fields on the deployment screen, since nobody on this team has seen that
  screen; match whichever options correspond to those two meanings.
- Copy the resulting URL, which ends in `/exec` (see the pattern in
  `src/assets/config.example.json`).

## 4. Fill in `src/assets/config.json` and commit

Replace the three blank strings in `src/assets/config.json` with:

- `auth0Domain` — the Auth0 domain from step 2
- `auth0ClientId` — the Auth0 client ID from step 2
- `apiBaseUrl` — the Apps Script `/exec` URL from step 3

Commit that change to `main`. This is the one commit that takes the site out
of demo mode and live: `ConfigService` falls back to demo mode whenever any
of the three fields is blank (`src/app/core/config/config.service.ts`), so an
empty file is safe and a filled-in file switches the whole site over on the
next deploy. It is reversible — reverting this commit and redeploying puts
the site back into demo mode with no other change needed.

## 5. Verify

- Open the site and confirm the demo-mode banner is gone. **TODO:** that
  banner does not exist in the UI yet — the app is still a routing skeleton —
  so this check only becomes meaningful once the ticket that builds the
  demo-mode banner has shipped. Until then, confirm instead that signing in
  with Google is offered rather than disabled.
- Make one test booking through the live site and confirm a new row appears
  in the `Bookings` tab with `status` set to `requested`.

## What only the CEO can do

- **Own the Google Sheet.** The architecture requires the CEO's own sheet to
  be the database; nobody else's sheet satisfies that.
- **Authenticate `clasp` and run the deployment in step 3.** `clasp`
  authenticates as a Google user, the Apps Script project must be deployed to
  execute as that same user, and nobody at this company can sign into the
  CEO's Google account (see `docs/decisions/0001-apps-script-as-backend.md`).
  Anyone else doing this step would deploy a script that cannot read or write
  the CEO's sheet.

Everything else — creating the Auth0 application, editing `config.json`,
committing — can in principle be done by an engineer on the CEO's behalf,
provided the CEO or the engineer sitting at the CEO's account completes the
two steps above.

## If this repository moves

The deploy workflow builds with `npm run build:pages`, whose
`--base-href /hair-saloon/` is the single place the Pages path is written, and
this repository's `origin` remote already points at
`https://github.com/klindic/hair-saloon.git`, so the Pages URL is expected to
be `https://klindic.github.io/hair-saloon/`. If that ever changes — the
repository is renamed, or moved to a different owner or organization — the
Pages URL changes with it, and the Auth0 allowed callback URLs, allowed
logout URLs and allowed web origins from step 2 must be updated in the same
change. The comment at the top of `deploy.yml` makes the same point: do both
updates together, because a stale Auth0 URL breaks login the moment the new
Pages URL goes live. To see what a changed base path actually serves before
pushing it, run `npm run preview` — it serves the built site on the Pages base
path locally, deep links included.

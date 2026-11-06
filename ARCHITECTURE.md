# Architecture

## The shape

One repository holds both sides of the system:

- One Angular SPA, built to static files, served by GitHub Pages.
- One Google Apps Script web app, deployed from the CEO's own Google account and running as
  that account (`executeAs: USER_DEPLOYING` in `apps-script/src/appsscript.json`).
- One Google Sheet, owned by the CEO, as the database: a `Bookings` tab, a `Services` tab, and
  an `Hours and Closures` tab the owner types into by hand. See `docs/sheet-template.md` for the
  exact column layout — it is the source of truth and `shared/contract.ts` must agree with it.

The contract between the two sides is two JSON calls against one Apps Script URL, and nothing
else: an anonymous GET for availability, and an authenticated POST to create a booking.

Nowhere in this shape is a server we operate or an account we pay for. That is a decision, not an
oversight — see "What this design does not do".

## Module boundaries

This is the part that stops four people colliding when they work in parallel:

- `src/app/core` is cross-cutting infrastructure — config, http, auth. It may not import from
  `src/app/features`.
- `src/app/features/*` are routed, lazy-loaded feature areas (`marketing`, `booking`,
  `not-found` today). A feature may not import another feature.
- `shared/contract.ts` is the only definition of the wire format. Both the Angular app and the
  Apps Script backend import it; nobody redefines these shapes locally.
- `apps-script/src/domain` holds pure functions with no Apps Script globals, so they run and are
  tested under plain Node (`apps-script/src/domain/slots.ts` is the first example). Where a port
  is needed — reading the sheet, resolving the salon's current UTC offset — `domain` defines the
  interface (`BookingsRepo`, `Zone` in `apps-script/src/domain/bookings-repo.ts`) and a fake
  satisfies it in tests.
- `apps-script/src/adapters` holds the concrete, globals-touching side of each port — one file per
  port (`sheet-bookings-repo.ts`, `zone.ts`), the only files allowed to touch `SpreadsheetApp`,
  `Session`, `Utilities`, `LockService` or `UrlFetchApp`. This code has no Node equivalent and
  cannot be unit tested; correctness here comes from review, not a test suite.
- `apps-script/src/main.ts` is wiring only: it reads the request, builds the real adapters, and
  calls into `domain`. It does not decide anything itself.
- `src/data/` is salon data compiled **into** the bundle — services and opening hours. It is read
  at build time and never fetched. `src/data/README.md` says why.
- `src/assets/` is the opposite: files fetched at runtime. `config.json` (the one file the CEO
  edits to go live) and `fixtures/` (demo-mode stand-ins for endpoint responses). Nothing in
  `src/assets` is imported by TypeScript, and nothing in `src/data` is fetched.
- `tools/` holds the repository's own scripts — the Pages post-build, the static server, the
  contract checker. Plain Node ESM, no framework, no dependencies beyond the standard library.
- `e2e/` tests the built bundle through a browser and may not import from `src/`. If a test needs
  to know something about the app's internals, that is a unit test instead.

## Data model

The sheet is the database. `docs/sheet-template.md` defines the three tabs column by column;
summarised, `Bookings` carries `booking_id`, `created_at`, `slot_start`, `slot_end`,
`service_id`, `stylist`, `customer_name`, `customer_email`, `status` and `notes`, `Services`
carries `id`, `name`, `price` and `duration_minutes`, and `Hours and Closures` is two owner-typed
tables (weekly hours, dated closures).

Two questions the scaffold left open are now decided, because four people would otherwise decide
them differently:

**Nothing syncs the sheet's `Services` and `Hours and Closures` tabs into the app.** The slot grid
has to paint with no network round trip, so service durations and opening hours are compiled into
the bundle from `src/data/services.json` and `src/data/hours.json`. Those files are the source of
truth for what the site shows, in demo mode and in configured mode alike. The owner's two tabs are
the owner's own record of the same facts. The cost, stated plainly rather than discovered later:
changing a price or an opening time is a commit and a deploy, not a spreadsheet edit, and if the
two disagree the site shows `src/data`. Buying the alternative — the owner edits the sheet and the
site follows — costs a round trip before the grid can paint, which is the one thing we refused.
Revisit it only with a snapshot published as a static file, never with a blocking read.

**A closed weekday is `{ "open": null, "close": null }`** in `OpeningHours`. The sheet carries the
word `closed` in both cells and the sync, whenever someone writes one, maps it to null. An empty
string, a missing key, or `open === close` is invalid data, and `src/data/salon-data.spec.ts`
fails on it.

## Contracts

**Read path.** An anonymous GET returns only busy time ranges for a requested date — zero
customer fields, so an unauthenticated caller learns the salon is busy at 10am and nothing about
who is in the chair. The slot grid itself is computed in the browser from opening hours and
service durations shipped with the build, so it paints before that GET returns and the busy
ranges land afterwards as an overlay. Our primary user is on a phone at 11pm; a spinner where
Saturday should be loses them.

**Write path.** A POST carries the Auth0 access token. The backend derives the customer's email
from that verified token and ignores any email in the request body, takes a `LockService` lock,
re-reads the sheet, and either writes exactly one row, returns a `slot_taken` rejection, or
replays the original success and writes nothing if a request reappears whose `booking_id` matches
an existing row and whose every other field matches that row too (the idempotency rule for
retries; see the "Idempotency replay rule" comment in `shared/contract.ts` for the precise rule,
including the status-on-replay decision).
Authentication sits on the write path only, never the read path: Apps Script has no RSA-verify
primitive, so the token is checked by calling Auth0's `/userinfo` endpoint, and Auth0's free tier
rate-limits `/userinfo` to 5 sustained and 10 burst requests per minute per user. Every page view
hitting the read path would exhaust that quota in seconds; every booking attempt will not.

**Why the token is in the body, not a header.** Apps Script web apps never answer a CORS
preflight request. The POST must stay a CORS-simple request — no custom headers, so no
`Authorization` header — which is why `shared/contract.ts` carries `access_token` as a body
field instead.

**Performance contract.** The slot grid paints with no network round trip. Booking submission is
allowed to take seconds, behind a disabled button and honest "sending your request" copy — a
script-to-script round trip through Apps Script is not fast, and pretending otherwise would just
move the wait somewhere less honest. The accepted consequence is that a customer can tap a slot
that has just gone; the `LockService` lock at submit time is what tells them, which means that
rejection needs a designed state in the UI, not a generic error page.

## Decisions

- **Apps Script, run as the CEO's account, is the backend** — the CEO has a Gmail account and a
  Sheet and nothing else, so this is free and needs no credential we would have to hold. Trade-off:
  deployment cannot be automated; every push to production is a manual `clasp push` run by someone
  sitting at the CEO's logged-in machine. Full reasoning in
  `docs/decisions/0001-apps-script-as-backend.md`.
- **The slot grid is computed client-side, availability is an overlay** — chosen for the phone-at-
  11pm user described above. Trade-off: the grid is only as fresh as the last build; see the sync
  gap recorded under "Data model".
- **Authentication lives only on the write path, verified via Auth0 `/userinfo`** — the only way to
  verify a token without an RSA-verify primitive. Trade-off: every booking attempt costs an extra
  network round trip to Auth0, and the write path's correctness now depends on Auth0 being
  reachable from Google's servers.
- **The access token travels in the POST body, not an `Authorization` header** — Apps Script
  cannot answer a CORS preflight. Trade-off: the contract carries a bearer credential as an
  ordinary JSON field, which is unusual and easy to get wrong if the client ever changes.
- **`shared/contract.ts` is the single frozen wire format** — divergent shapes on each side is how
  this kind of integration usually breaks. Trade-off: it is a hard coupling; see
  CONVENTIONS.md for the rule that follows from it. The sheet's column order lives there as a
  value (`BOOKINGS_COLUMNS`, `SERVICES_COLUMNS`) rather than as prose, so `npm run check:contract`
  can prove mechanically that `docs/sheet-template.md` has not drifted from it.
- **Opening hours and service durations are compiled into the bundle, not fetched** — see "Data
  model" above for the decision and what it costs.
- **GitHub Pages deep links are handled by making `404.html` a copy of `index.html`** at build
  time (`tools/pages-postbuild.mjs`). Pages has no server-side router, so it serves `404.html`
  for any path that is not a real file; handing back the whole SPA means the real URL survives and
  the Angular router just routes it. Trade-off: a deep link returns HTTP 404 with a working page,
  which is odd but harmless, and it is what `e2e/smoke.spec.ts` asserts. The rejected alternative
  was a redirect script that stashes the path and bounces to the site root: it hardcodes the
  origin, breaks under a project base path like `/hair-saloon/`, and costs an extra navigation.
- **One gate, `npm run verify`** — lint, format:check, typecheck, check:contract, unit tests,
  Apps Script tests, Apps Script bundle, build. CI runs that same script rather than its own list
  of steps, so "it passed locally" and "CI is green" cannot mean two different things. Add a check
  by editing the script, not the workflow.

## What this design does not do

- No server we operate. Everything that runs server-side runs inside Google's infrastructure, as
  the CEO's account.
- No paid infrastructure. Every piece — GitHub Pages, Apps Script, the Sheet, Auth0's free tier —
  has a free tier this product fits inside, and no growth path past it is designed in.
- No secret in the bundle. The browser holds only Auth0 SPA PKCE tokens, which ship no client
  secret.
- No customer-facing booking lookup. A customer who has submitted a request has no page to view,
  change or cancel it afterwards; the only workflow for that is the owner editing the sheet by
  hand.

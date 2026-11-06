# Conventions

Only the rules a newcomer would otherwise get wrong. Anything ESLint or Prettier already enforces
is not restated here — run `npm run lint` and `npm run format:check` to find out.

## TypeScript

Strict mode is on (`tsconfig.json`: `"strict": true`) and `any` is not allowed. Where a shape is
genuinely unknown until checked, type it `unknown` and narrow it — see
`src/app/core/config/config.service.ts`, which reads a fetched config as `unknown` and only
returns an `AppConfig` after validating each field.

## Angular

Standalone components and signals; no `NgModule` anywhere in this repo. Use `inject()`, not
constructor injection — see `provideAppInitializer(() => inject(ConfigService).load())` in
`src/app/app.config.ts`.

**Change detection:** Angular 22's component schematic defaults to `OnPush` (checked in
`node_modules/@schematics/angular/component/schema.json`, where `OnPush` is the default and the
old `Default` strategy is now spelled `Eager`). Write components that update through signals
rather than through mutated object properties, and do not reach for `Eager` to make a stale view
refresh — that is a signal you are missing, not a strategy you need.

**File naming:** no `.component.ts` suffix. The root component is `app.ts` /
`app.html`; a routed feature page is `<name>-page.ts`, e.g. `src/app/features/booking/booking-page.ts`.

**Selector naming:** component selectors are kebab-case with an `app` prefix
(`app-root`, `app-booking-page`); directive selectors are camelCase with the same prefix. Both
are enforced by `eslint.config.js`.

## The wire boundary

The sheet's columns are snake_case (`booking_id`, `slot_start`, `customer_name`, ...), and
`shared/contract.ts` uses those same snake_case names because it describes the wire, not
TypeScript idiom. Everything on the TypeScript side of that boundary — app state, service
return types, config shapes — is camelCase: see `AppConfig` in
`src/app/core/config/app-config.ts` (`auth0Domain`, `auth0ClientId`, `apiBaseUrl`). The boundary
is `shared/contract.ts` itself: snake_case stops there, camelCase starts everywhere else.

**Changing `shared/contract.ts` requires the frontend and backend change in the same pull
request.** It is imported by both sides; a field rename landed on only one side is a silent
breakage the type checker on the other side will not catch until it is deployed.

## Tests

Tests live beside the code they test, as `*.spec.ts` — `app.ts` / `app.spec.ts`,
`config.service.ts` / `config.service.spec.ts`, `slots.ts` / `slots.spec.ts`. Everything under
`apps-script/src/**/*.spec.ts` (domain logic in `apps-script/src/domain/`, plus standalone checks
like `apps-script/src/manifest.spec.ts`) runs under Vitest in plain Node via
`apps-script/vitest.config.mts` (`npm run test:script`); anything that touches an Apps Script
global (`SpreadsheetApp`, `LockService`, `UrlFetchApp`) has no Node equivalent and cannot be unit
tested this way — see `apps-script/README.md`.

## Where things go

Four engineers working in parallel need this to be a lookup, not a judgement call:

- A routed page → `src/app/features/<name>/<name>-page.ts`. Features never import each other.
- Something two features both need → `src/app/core/`. Core never imports a feature.
- A wire shape, an error code, a sheet column → `shared/contract.ts`, and nowhere else.
- A colour, space, radius or type size → `docs/design/tokens.md`, and nowhere else.
- A booking-flow screen's states or exact customer-facing copy → `docs/design/booking-flow.md`, and nowhere else.
- Salon data the slot grid needs (services, opening hours) → `src/data/`, compiled into the
  bundle. Changing it is a commit; see `src/data/README.md`.
- Something fetched at runtime → `src/assets/`. Only `config.json` and demo fixtures belong there.
- A repeated manual chore → a script in `tools/`, wired into an npm script. If two people have
  typed the same four commands this week, that is the signal.

## Before you open a pull request

Run `npm run verify`. It is lint, format:check, typecheck, check:contract, check:contrast, unit tests,
Apps Script tests, the Apps Script bundle and the build, and it is the same script CI runs — so a
green `verify` locally and a green CI mean the same thing. `npm run verify:all` adds Playwright, which
is worth it if you touched routing, the build or anything the browser loads.

Do not claim a check passed that you did not watch pass. If something is broken and you are
landing anyway because it is unrelated, say so in the pull request.

## Formatting

Prettier decides formatting (`npm run format`); nobody hand-formats around it or argues with its
output.

## Branches and pull requests

One ticket, one branch, one pull request. Name the branch after the ticket:
`<ticket-id>-<short-kebab-summary>`, e.g. `t8-root-docs`. Keep commits scoped to that ticket —
don't ride along a second, unrelated change in the same PR.

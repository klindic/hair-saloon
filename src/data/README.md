# Shipped salon data

`services.json` and `hours.json` are compiled **into** the bundle and are the source of truth for
the slot grid in both demo mode and configured mode. That is deliberate: the grid has to paint
with no network round trip, so opening hours and service durations cannot be fetched.

The consequence, stated plainly: changing a price, a duration or an opening time is a commit and a
deploy, not a spreadsheet edit. The `Services` and `Hours and Closures` tabs in the owner's sheet
are the owner's own record of the same facts (see `docs/sheet-template.md`); nothing syncs them
automatically in v1, and if they disagree, this directory is what the site shows.

Shapes are frozen in `shared/contract.ts` (`Service`, `OpeningHours`). A closed weekday is
`{ "open": null, "close": null }`. `salon-data.spec.ts` checks both files against those types and
against the invariants the grid depends on — run `npm test`.

This is not the same thing as `src/assets/`:

- `src/data/` — compiled in, read at build time, never fetched.
- `src/assets/config.json` — fetched at startup, the one file the CEO edits to go live.
- `src/assets/fixtures/` — fetched in demo mode only, standing in for the endpoint's responses.

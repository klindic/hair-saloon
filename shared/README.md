# Shared Contract

This directory contains the **frozen wire format contract** between the Angular frontend and the
Google Apps Script backend.

## contract.ts

The types and constants in `contract.ts` define:

- The read path (`AvailabilityRequest`, `BusyRange`, `AvailabilityResponse`).
- The write path (`BookRequest`, `BookSuccessResponse`).
- Errors (`BookingErrorCode`, `ErrorResponse`), and the discriminated result unions a caller
  narrows on `ok` before it can read `booking_id` or `busy`: `AvailabilityResult`, `BookResult`,
  and `EndpointResult`.
- The sheet's shape: `BookingStatus`, `BookingRow`, `Service`, and the column-order constants
  `BOOKINGS_COLUMNS`, `SERVICES_COLUMNS` and the tab names in `SHEET_TAB_NAMES`. These exist as
  values, not just as prose, so `npm run check:contract` can mechanically prove that
  `docs/sheet-template.md` has not drifted from them — the backend writes a row by
  `BOOKINGS_COLUMNS`'s order, and the check compares that array against the document the owner
  built the sheet from.
- The salon data shipped with the build: `Weekday`, `WEEKDAYS`, `DayHours`, `Closure`, and
  `OpeningHours`. A closed weekday is `{ open: null, close: null }`, not an empty string or a
  missing key — that is the one representation the rest of the code trusts.
- The salon configuration: `SALON_TIMEZONE`. This exists as a value, so a Node test can verify
  that the duplicate in `apps-script/src/appsscript.json`'s `timeZone` field has not drifted —
  the Apps Script runtime reads that manifest directly and cannot import this file.

Both the frontend and backend import these types. **Changing a field name or shape here is a
breaking change** that requires coordinated updates:

- Backend: the Apps Script must accept the new shape.
- Frontend: the Angular app must send the new shape.
- Documentation: the sheet column headers in `docs/sheet-template.md` must match the field names
  — `npm run check:contract` enforces this mechanically rather than leaving it to review.

A contract change needs both sides updated in the same pull request (see `CONVENTIONS.md`).

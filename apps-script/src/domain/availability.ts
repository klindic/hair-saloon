import type { AvailabilityResult, BookingRow, BusyRange } from '@contract/contract';
import { parseBookingRow, ZoneOffsetError, type BookingsRepo, type Zone } from './bookings-repo';

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for a real calendar date in strict YYYY-MM-DD form. The shape check first rules out
 * anything that is not four digits, two digits, two digits (so '26-11-07' never reaches
 * `Date`); the round trip through `Date`'s UTC parsing then rules out a date that is the right
 * shape but does not exist, such as '2026-02-30' or '2026-13-01' — `Date` normalises those into a
 * different, later date, and the re-serialised string stops matching the input.
 */
export function isValidCalendarDate(date: string): boolean {
  if (!DATE_SHAPE.test(date)) {
    return false;
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === date;
}

/**
 * The availability read path. Deliberately anonymous: it reports when the salon is busy and
 * never who is in the chair, so it only ever reaches into a parsed row for `status` and
 * `slot_start`/`slot_end`, and the returned `BusyRange` has room for nothing else.
 *
 * The date is validated before `snapshot` is touched at all — an invalid date returns
 * immediately, without a single read of `snapshot`, so a malformed request never pays for a scan
 * of the sheet and a caller can safely pass a value that is not really a snapshot when the date
 * alone is what is under test.
 *
 * A row that fails to parse is excluded rather than allowed to fail the whole request - one bad
 * cell anywhere in the tab must not turn every customer's "what's free today" into an error page.
 * That can only ever widen what looks available, never narrow it, which is why `created_at` is
 * deliberately *not* one of the ways a row can fail to parse: `readCreatedAt` never throws (see
 * `bookings-repo.ts`), because that column is never read back from an existing row by anything,
 * this endpoint included, so a blank or malformed `created_at` must not cost a real booking its
 * visibility. The only way `parseBookingRow` can still throw here is `slot_start` or `slot_end`
 * itself being unparseable - the exact fields this endpoint and the write path's own overlap check
 * both need to evaluate the row at all. An excluded row like that is exactly the
 * case the locked write path already exists to catch: the customer picks it, the lock re-reads the
 * real row, and they get `slot_taken` instead of a confirmation - degraded, not unsafe.
 *
 * A `ZoneOffsetError` is not one of those bad cells and is never excluded: it means the zone
 * itself is misconfigured, so every `Date`-typed row would fail the same way and "every row
 * excluded" would otherwise read back as the dishonest `ok: true, busy: []` - a calendar that
 * looks wide open because the infrastructure under it is broken. It is left to propagate so the
 * caller (`main.ts`'s `doGet`) reports it as `internal_error` instead.
 */
export function availabilityFor(
  date: string,
  snapshot: unknown[][],
  zone: Zone
): AvailabilityResult {
  if (!isValidCalendarDate(date)) {
    return {
      ok: false,
      error: 'invalid_request',
      message: `'${date}' is not a valid calendar date in YYYY-MM-DD format`,
    };
  }

  const busy: BusyRange[] = [];
  for (const raw of snapshot) {
    let row: BookingRow;
    try {
      row = parseBookingRow(raw, zone);
    } catch (error) {
      if (error instanceof ZoneOffsetError) {
        // A zone that cannot be parsed is an infrastructure failure, not bad row data: it must
        // reach doGet's catch as internal_error, never be read back as "nothing is booked".
        throw error;
      }
      continue;
    }
    // The owner types this cell by hand, so the comparison tolerates the casing and stray
    // whitespace a human actually produces ('Cancelled', 'cancelled ') rather than only the exact
    // lowercase literal the contract pins for what the app itself writes.
    if (row.status.trim().toLowerCase() === 'cancelled') {
      continue;
    }
    if (row.slot_start.slice(0, 10) !== date) {
      continue;
    }
    busy.push({ start: row.slot_start, end: row.slot_end });
  }

  return { ok: true, date, busy };
}

/**
 * The entry point `main.ts` actually calls: owns the one sheet read. The date is validated before
 * `repo.loadBookingsSnapshot()` is ever invoked, so an invalid date costs no read at all — a fake
 * `BookingsRepo` with a spied `loadBookingsSnapshot` is how a test proves that, since `main.ts`
 * itself touches real Apps Script globals and has no Node equivalent to test against directly.
 */
export function availabilityResponse(
  date: string,
  repo: BookingsRepo,
  zone: Zone
): AvailabilityResult {
  const snapshot = isValidCalendarDate(date) ? repo.loadBookingsSnapshot() : [];
  return availabilityFor(date, snapshot, zone);
}

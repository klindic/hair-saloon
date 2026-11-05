import type { AvailabilityResult, BusyRange } from '@contract/contract';
import { parseBookingRow, type BookingsRepo, type Zone } from './bookings-repo';

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
    const row = parseBookingRow(raw, zone);
    if (row.status === 'cancelled') {
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

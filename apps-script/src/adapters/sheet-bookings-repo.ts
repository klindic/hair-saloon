import { BOOKINGS_COLUMNS, SHEET_TAB_NAMES, type BookingRow } from '@contract/contract';
import type { BookingsRepo } from '../domain/bookings-repo';

/**
 * The minimal slice of `GoogleAppsScript.Spreadsheet.Range` that `writeFormattedRow` needs - one
 * range, pinned to plain text and then written to, since pinning a narrower sub-range than the
 * one being written would leave part of the row unprotected. Kept deliberately narrower than the
 * real `Range` type so the function can be exercised with a plain object fake in Node - a real
 * `Range` satisfies this shape too, so passing one at runtime works exactly the same.
 */
export interface FormattableValueRange {
  setNumberFormat(format: string): void;
  setValues(values: unknown[][]): void;
}

/**
 * Write one row, having first pinned its cells' format to plain text ('@').
 *
 * Sheets auto-converts anything date-shaped into its own internal date-serial representation the
 * moment `setValues` runs, which silently throws away the explicit UTC offset this app writes
 * into `created_at`/`slot_start`/`slot_end` ('2026-11-07T10:00:00+01:00' comes back later as a
 * bare `Date`, with no offset left to recover) - this part is confirmed by this project's own
 * earlier read-path work, which had to recover from exactly this. The same hazard reaches further
 * than the three datetime columns, though: a `customer_name` of '007' or a `notes` of a phone
 * number or a date gets silently reinterpreted too, which breaks `booking.ts`'s exact-string
 * replay comparison on those fields (a retry would read back as `invalid_request`, the one answer
 * a true replay must never get).
 *
 * A `customer_name` or `notes` starting with '=' is also, separately, a plausible formula-
 * injection surface - Sheets' manual-entry behaviour evaluates a leading '=' as a formula, and the
 * common, widely-documented mitigation is this same '@' plain-text pin. That part is NOT verified
 * against a live Sheet from this repository: no primary Google documentation found during review
 * states explicitly that `setNumberFormat('@')` suppresses formula evaluation for a value written
 * through `setValues()` specifically, as opposed to typed by hand. `docs/handover.md`'s step 5 now
 * has the one check that can actually settle it, since nobody here can run a real Apps Script
 * deployment. Pinning the *whole* row's format to '@' before the write, not only the datetime
 * columns, is the right move either way: it is confirmed to fix the date problem, and it is the
 * standard mitigation for the formula problem even though this repository cannot confirm that part
 * itself.
 *
 * The format pin has to happen on *every* call, not once at setup: a human reformatting a column
 * by hand later would silently undo a one-time format with nothing to throw and catch it. So the
 * order here - format, then values, every time - is the entire point of this function; do not
 * reorder these two calls.
 */
export function writeFormattedRow(range: FormattableValueRange, values: unknown[]): void {
  range.setNumberFormat('@');
  range.setValues([values]);
}

/**
 * The `BookingsRepo` port, backed by the real Bookings sheet tab. The whole tab is read in one
 * `getDataRange().getValues()` call - reading row by row or cell by cell would mean one round
 * trip to Sheets per row, which is slow and quota-hungry for no benefit.
 */
export class SheetBookingsRepo implements BookingsRepo {
  loadBookingsSnapshot(): unknown[][] {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TAB_NAMES.bookings);
    if (sheet === null) {
      throw new Error(`Sheet tab '${SHEET_TAB_NAMES.bookings}' not found`);
    }
    const values = sheet.getDataRange().getValues();
    return values.slice(1);
  }

  append(row: BookingRow): void {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TAB_NAMES.bookings);
    if (sheet === null) {
      throw new Error(`Sheet tab '${SHEET_TAB_NAMES.bookings}' not found`);
    }
    // Flattened in the contract's own column order, never a locally hardcoded one, so a column
    // added to `BOOKINGS_COLUMNS` later breaks this loudly rather than writing to the wrong cell.
    const values = BOOKINGS_COLUMNS.map((column) => row[column]);
    // getLastRow() counts the header row too, so +1 is the first genuinely empty row.
    const nextRow = sheet.getLastRow() + 1;
    // One range, pinned to plain text and written in the same call: see writeFormattedRow for why
    // the whole row is pinned, not only the three datetime columns.
    const rowRange = sheet.getRange(nextRow, 1, 1, BOOKINGS_COLUMNS.length);
    writeFormattedRow(rowRange, values);
    // Apps Script batches spreadsheet writes and may still be holding this row in its own buffer
    // when the execution's work is done, so the append has to be forced out to the sheet *here* -
    // while `bookSlot` still holds the lock - and not left to whenever the runtime gets round to
    // it. Without this, the next request can acquire the lock the moment `bookSlot`'s `finally`
    // releases it, call `loadBookingsSnapshot()`, and not see this row: it finds no overlap and
    // writes a second booking into the same slot, which is the exact failure the lock exists to
    // prevent. Flushing before releasing a lock is Google's own documented pattern for
    // LockService. It belongs in the repo rather than in `bookSlot` because `SpreadsheetApp` is an
    // adapter concern - `domain/` never names it - and because `append`'s contract is "the row is
    // in the sheet when this returns", which is not true until the buffer is drained.
    SpreadsheetApp.flush();
  }
}

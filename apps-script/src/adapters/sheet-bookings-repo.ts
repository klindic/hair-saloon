import { BOOKINGS_COLUMNS, SHEET_TAB_NAMES, type BookingRow } from '@contract/contract';
import type { BookingsRepo } from '../domain/bookings-repo';

/**
 * The minimal slice of `GoogleAppsScript.Spreadsheet.Range` that `writeFormattedRow` needs for
 * pinning a cell's number format. Kept deliberately narrower than the real `Range` type so the
 * function can be exercised with a plain object fake in Node - a real `Range` satisfies this
 * shape too, so passing one at runtime works exactly the same.
 */
export interface FormattableRange {
  setNumberFormat(format: string): void;
}

/**
 * The minimal slice of `GoogleAppsScript.Spreadsheet.Range` that `writeFormattedRow` needs for
 * writing the row's values. See `FormattableRange` for why this is narrower than `Range` itself.
 */
export interface ValueRange {
  setValues(values: unknown[][]): void;
}

/**
 * Write one row, having first pinned its cells' format to plain text ('@').
 *
 * Sheets auto-converts anything date-shaped into its own internal date-serial representation the
 * moment `setValues` runs, which silently throws away the explicit UTC offset this app writes
 * into `created_at`/`slot_start`/`slot_end` ('2026-11-07T10:00:00+01:00' comes back later as a
 * bare `Date`, with no offset left to recover). The same hazard reaches further than the three
 * datetime columns, though: a `customer_name` of '007' or a `notes` of a phone number or a date
 * gets silently reinterpreted too, which breaks `booking.ts`'s exact-string replay comparison on
 * those fields (a retry would read back as `invalid_request`, the one answer a true replay must
 * never get) and - because a string starting with '=' is evaluated as a formula by Sheets'
 * default parsing - is a real injection surface on a customer-supplied field. Pinning the *whole*
 * row's format to '@' before the write, not only the datetime columns, stops Sheets from
 * reinterpreting any of it.
 *
 * `dateRange` and `rowRange` may be - and in `SheetBookingsRepo.append` below, are - the exact
 * same range: the two parameters exist so a narrower range could still be pinned on its own if a
 * future caller only wants to format part of a row, not because this function needs them to
 * differ. The format pin has to happen on *every* call, not once at setup: a human reformatting a
 * column by hand later would silently undo a one-time format with nothing to throw and catch it.
 * So the order here - format, then values, every time - is the entire point of this function; do
 * not reorder these two calls.
 */
export function writeFormattedRow(
  dateRange: FormattableRange,
  rowRange: ValueRange,
  values: unknown[]
): void {
  dateRange.setNumberFormat('@');
  rowRange.setValues([values]);
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
    writeFormattedRow(rowRange, rowRange, values);
  }
}

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
 * Write one row, having first pinned the datetime columns' cell format to plain text ('@').
 *
 * Sheets auto-converts anything date-shaped into its own internal date-serial representation the
 * moment `setValues` runs, which silently throws away the explicit UTC offset this app writes
 * into `created_at`/`slot_start`/`slot_end` ('2026-11-07T10:00:00+01:00' comes back later as a
 * bare `Date`, with no offset left to recover). Pinning the format to '@' before the write stops
 * Sheets from reinterpreting the string at all.
 *
 * That pin has to happen on *every* call, not once at setup: a human reformatting the column by
 * hand later (or a new column header pushing the dates sideways) would silently undo a one-time
 * format with nothing to throw and catch it. So the order here - format, then values, every time -
 * is the entire point of this function; do not reorder these two calls.
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
    const rowRange = sheet.getRange(nextRow, 1, 1, BOOKINGS_COLUMNS.length);
    // 'created_at', 'slot_start' and 'slot_end' are contiguous and in that order in the contract
    // today, so one 3-wide range covers all of them; this assumes that stays true.
    const dateRange = sheet.getRange(nextRow, BOOKINGS_COLUMNS.indexOf('created_at') + 1, 1, 3);
    writeFormattedRow(dateRange, rowRange, values);
  }
}

import { SHEET_TAB_NAMES, type BookingRow } from '@contract/contract';
import type { BookingsRepo } from '../domain/bookings-repo';

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

  append(_row: BookingRow): void {
    throw new Error('implemented in T-03');
  }
}

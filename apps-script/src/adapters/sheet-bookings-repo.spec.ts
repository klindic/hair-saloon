import { describe, expect, it } from 'vitest';
import { writeFormattedRow, type FormattableRange, type ValueRange } from './sheet-bookings-repo';

/**
 * `writeFormattedRow` is the one piece of this file that does not touch a real Apps Script
 * global - it takes its ranges as parameters instead of calling `SpreadsheetApp` itself - so it
 * is the only thing in this file worth unit-testing in Node. `append` and `loadBookingsSnapshot`
 * both call `SpreadsheetApp`/`sheet.getRange` directly and have no Node equivalent, same as every
 * other adapter in this codebase.
 */
describe('writeFormattedRow', () => {
  it('pins the number format before writing values, every call', () => {
    const calls: string[] = [];
    const dateRange: FormattableRange = {
      setNumberFormat: () => {
        calls.push('setNumberFormat');
      },
    };
    const rowRange: ValueRange = {
      setValues: () => {
        calls.push('setValues');
      },
    };

    writeFormattedRow(dateRange, rowRange, ['a', 'b', 'c']);

    expect(calls).toEqual(['setNumberFormat', 'setValues']);
  });

  it('writes the values wrapped in a single-row 2D array', () => {
    let received: unknown[][] | undefined;
    const dateRange: FormattableRange = {
      setNumberFormat: () => undefined,
    };
    const rowRange: ValueRange = {
      setValues: (values) => {
        received = values;
      },
    };
    const someValuesArray = ['booking-1', '2026-11-07T10:00:00+01:00', 'confirmed'];

    writeFormattedRow(dateRange, rowRange, someValuesArray);

    expect(received).toEqual([someValuesArray]);
  });
});

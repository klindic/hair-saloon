import { describe, expect, it } from 'vitest';
import { writeFormattedRow, type FormattableValueRange } from './sheet-bookings-repo';

/**
 * `writeFormattedRow` is the one piece of this file that does not touch a real Apps Script
 * global - it takes its range as a parameter instead of calling `SpreadsheetApp` itself - so it
 * is the only thing in this file worth unit-testing in Node. `append` and `loadBookingsSnapshot`
 * both call `SpreadsheetApp`/`sheet.getRange` directly and have no Node equivalent, same as every
 * other adapter in this codebase.
 */
describe('writeFormattedRow', () => {
  it('pins the number format before writing values, every call', () => {
    const calls: string[] = [];
    const range: FormattableValueRange = {
      setNumberFormat: () => {
        calls.push('setNumberFormat');
      },
      setValues: () => {
        calls.push('setValues');
      },
    };

    writeFormattedRow(range, ['a', 'b', 'c']);

    expect(calls).toEqual(['setNumberFormat', 'setValues']);
  });

  it('writes the values wrapped in a single-row 2D array', () => {
    let received: unknown[][] | undefined;
    const range: FormattableValueRange = {
      setNumberFormat: () => undefined,
      setValues: (values) => {
        received = values;
      },
    };
    const someValuesArray = ['booking-1', '2026-11-07T10:00:00+01:00', 'confirmed'];

    writeFormattedRow(range, someValuesArray);

    expect(received).toEqual([someValuesArray]);
  });
});

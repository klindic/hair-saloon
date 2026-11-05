import { describe, expect, it, vi } from 'vitest';
import { availabilityFor, availabilityResponse, isValidCalendarDate } from './availability';
import type { BookingsRepo, Zone } from './bookings-repo';

/** A zone pinned to one offset, so a test says which offset it is asserting against. */
function fixedZone(offset: string): Zone {
  return { offsetFor: () => offset };
}

/** A zone that fails the test if it is consulted at all. */
const unusedZone: Zone = {
  offsetFor: () => {
    throw new Error('the zone was consulted when it should not have been');
  },
};

/** A raw Bookings-tab row, in BOOKINGS_COLUMNS order, with sensible defaults a test can override. */
function row(
  overrides: Partial<{ slotStart: string; slotEnd: string; status: string }>
): unknown[] {
  const {
    slotStart = '2026-11-07T10:00:00+01:00',
    slotEnd = '2026-11-07T10:45:00+01:00',
    status = 'requested',
  } = overrides;
  return [
    'bk_777',
    '2026-11-05T14:29:41+01:00',
    slotStart,
    slotEnd,
    'colour',
    'Ana',
    'Marko Horvat',
    'marko@example.com',
    status,
    'first visit',
  ];
}

describe('isValidCalendarDate', () => {
  it('accepts a real calendar date', () => {
    expect(isValidCalendarDate('2026-11-07')).toBe(true);
  });

  it('accepts a leap day in a leap year', () => {
    expect(isValidCalendarDate('2028-02-29')).toBe(true);
  });

  it('rejects a leap day in a non-leap year', () => {
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
  });

  it('rejects a day that does not exist in its month', () => {
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
  });

  it('rejects a month greater than 12', () => {
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
  });

  it('rejects a two-digit year', () => {
    expect(isValidCalendarDate('26-11-07')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidCalendarDate('')).toBe(false);
  });
});

describe('availabilityFor', () => {
  it('returns an empty busy list for an empty snapshot', () => {
    const result = availabilityFor('2026-11-07', [], unusedZone);
    expect(result).toEqual({ ok: true, date: '2026-11-07', busy: [] });
  });

  it('produces one busy range for a requested row matching the date', () => {
    const result = availabilityFor('2026-11-07', [row({ status: 'requested' })], unusedZone);
    expect(result).toEqual({
      ok: true,
      date: '2026-11-07',
      busy: [{ start: '2026-11-07T10:00:00+01:00', end: '2026-11-07T10:45:00+01:00' }],
    });
  });

  it('produces one busy range for a confirmed row matching the date', () => {
    const result = availabilityFor('2026-11-07', [row({ status: 'confirmed' })], unusedZone);
    expect(result).toEqual({
      ok: true,
      date: '2026-11-07',
      busy: [{ start: '2026-11-07T10:00:00+01:00', end: '2026-11-07T10:45:00+01:00' }],
    });
  });

  it('excludes a cancelled row matching the date', () => {
    const result = availabilityFor('2026-11-07', [row({ status: 'cancelled' })], unusedZone);
    expect(result).toEqual({ ok: true, date: '2026-11-07', busy: [] });
  });

  it('excludes a row on a different date', () => {
    const result = availabilityFor(
      '2026-11-07',
      [row({ slotStart: '2026-11-08T10:00:00+01:00', slotEnd: '2026-11-08T10:45:00+01:00' })],
      unusedZone
    );
    expect(result).toEqual({ ok: true, date: '2026-11-07', busy: [] });
  });

  it('produces one busy range per matching row when there are several', () => {
    const rows = [
      row({ slotStart: '2026-11-07T09:00:00+01:00', slotEnd: '2026-11-07T09:30:00+01:00' }),
      row({ slotStart: '2026-11-07T11:00:00+01:00', slotEnd: '2026-11-07T11:45:00+01:00' }),
    ];
    const result = availabilityFor('2026-11-07', rows, unusedZone);
    expect(result).toEqual({
      ok: true,
      date: '2026-11-07',
      busy: [
        { start: '2026-11-07T09:00:00+01:00', end: '2026-11-07T09:30:00+01:00' },
        { start: '2026-11-07T11:00:00+01:00', end: '2026-11-07T11:45:00+01:00' },
      ],
    });
  });

  it('never leaks customer or booking identity into the response', () => {
    const result = availabilityFor('2026-11-07', [row({ status: 'requested' })], unusedZone);
    const serialized = JSON.stringify(result);
    expect(serialized.includes('customer_name')).toBe(false);
    expect(serialized.includes('customer_email')).toBe(false);
    expect(serialized.includes('booking_id')).toBe(false);
    expect(serialized.includes('service_id')).toBe(false);
    expect(serialized.includes('Marko Horvat')).toBe(false);
    expect(serialized.includes('marko@example.com')).toBe(false);
    expect(serialized.includes('bk_777')).toBe(false);
  });

  it('rejects an empty date and never reads the snapshot', () => {
    const call = (): ReturnType<typeof availabilityFor> =>
      availabilityFor('', undefined as unknown as unknown[][], fixedZone('+01:00'));
    expect(call).not.toThrow();
    const result = call();
    if (result.ok) {
      throw new Error('expected an error response');
    }
    expect(result.error).toBe('invalid_request');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('rejects a malformed date with an out-of-range month', () => {
    const result = availabilityFor('2026-13-45', [], unusedZone);
    if (result.ok) {
      throw new Error('expected an error response');
    }
    expect(result.error).toBe('invalid_request');
  });

  it('rejects a date that does not exist, such as a leap day in a non-leap year', () => {
    const result = availabilityFor('2026-02-30', [], unusedZone);
    if (result.ok) {
      throw new Error('expected an error response');
    }
    expect(result.error).toBe('invalid_request');
  });
});

describe('availabilityResponse', () => {
  /** The spy is returned alongside the repo so an assertion never goes through `repo.method`,
   * which ESLint's `unbound-method` rule (rightly) distrusts as a general pattern. */
  function fakeRepo(snapshot: unknown[][]): {
    repo: BookingsRepo;
    loadBookingsSnapshot: ReturnType<typeof vi.fn>;
  } {
    const loadBookingsSnapshot = vi.fn(() => snapshot);
    const repo: BookingsRepo = {
      loadBookingsSnapshot,
      append: () => {
        throw new Error('append is not under test here');
      },
    };
    return { repo, loadBookingsSnapshot };
  }

  it('reads the sheet exactly once for a valid date', () => {
    const { repo, loadBookingsSnapshot } = fakeRepo([row({ status: 'requested' })]);
    availabilityResponse('2026-11-07', repo, unusedZone);
    expect(loadBookingsSnapshot).toHaveBeenCalledTimes(1);
  });

  it('never reads the sheet for an invalid date', () => {
    const { repo, loadBookingsSnapshot } = fakeRepo([row({ status: 'requested' })]);
    const result = availabilityResponse('not-a-date', repo, unusedZone);
    expect(loadBookingsSnapshot).not.toHaveBeenCalled();
    if (result.ok) {
      throw new Error('expected an error response');
    }
    expect(result.error).toBe('invalid_request');
  });

  it('returns the same result availabilityFor would, given the snapshot the repo provides', () => {
    const { repo } = fakeRepo([row({ status: 'requested' })]);
    const result = availabilityResponse('2026-11-07', repo, unusedZone);
    expect(result).toEqual({
      ok: true,
      date: '2026-11-07',
      busy: [{ start: '2026-11-07T10:00:00+01:00', end: '2026-11-07T10:45:00+01:00' }],
    });
  });
});

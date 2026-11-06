import { describe, expect, it } from 'vitest';
import type { OpeningHours } from '@contract/contract';
import {
  computeDaySlots,
  findNextOpenDay,
  formatDateKey,
  formatNextOpenDayLabel,
  isDayOpen,
  parseDateKey,
  weekdayForDateKey,
} from './scheduling';

const OPEN_ALL_WEEK: OpeningHours = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '09:00', close: '18:00' },
  sunday: { open: '09:00', close: '18:00' },
  closures: [],
};

const CLOSED_ALL_WEEK: OpeningHours = {
  monday: { open: null, close: null },
  tuesday: { open: null, close: null },
  wednesday: { open: null, close: null },
  thursday: { open: null, close: null },
  friday: { open: null, close: null },
  saturday: { open: null, close: null },
  sunday: { open: null, close: null },
  closures: [],
};

const SAMPLE_HOURS: OpeningHours = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '20:00' },
  friday: { open: '09:00', close: '20:00' },
  saturday: { open: '10:00', close: '16:00' },
  sunday: { open: null, close: null },
  closures: [{ date: '2026-12-25', reason: 'Christmas Day' }],
};

describe('computeDaySlots', () => {
  it('produces the right count and first/last slot for a normal open day', () => {
    const slots = computeDaySlots({ open: '09:00', close: '11:00' }, 30);
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30']);
    expect(slots[0]).toBe('09:00');
    expect(slots[slots.length - 1]).toBe('10:30');
  });

  it('returns an empty array for a closed day', () => {
    expect(computeDaySlots({ open: null, close: null }, 30)).toEqual([]);
  });

  it('never includes the close time when it is an exact multiple of the granularity', () => {
    const slots = computeDaySlots({ open: '09:00', close: '10:00' }, 30);
    expect(slots).toEqual(['09:00', '09:30']);
    expect(slots).not.toContain('10:00');
  });

  it('excludes a start that the shortest service could not finish before close', () => {
    const slots = computeDaySlots({ open: '10:00', close: '16:00' }, 150);
    expect(slots[slots.length - 1]).toBe('13:30');
    expect(slots).not.toContain('14:00');
  });

  it('keeps every granularity-aligned start when the minimum duration fits exactly', () => {
    const slots = computeDaySlots({ open: '09:00', close: '10:00' }, 60);
    expect(slots).toEqual(['09:00']);
  });
});

describe('isDayOpen', () => {
  it('is closed on a weekday with null hours', () => {
    expect(isDayOpen('2026-11-08', SAMPLE_HOURS)).toBe(false);
  });

  it('is closed on a date present in closures even on an otherwise-open weekday', () => {
    expect(isDayOpen('2026-12-25', SAMPLE_HOURS)).toBe(false);
  });

  it('is open on an ordinary open weekday with no matching closure', () => {
    expect(isDayOpen('2026-11-09', SAMPLE_HOURS)).toBe(true);
  });

  it('uses the explicitly passed closures list instead of hours.closures when given', () => {
    const hoursWithNoClosures: OpeningHours = { ...SAMPLE_HOURS, closures: [] };
    expect(
      isDayOpen('2026-11-09', hoursWithNoClosures, [{ date: '2026-11-09', reason: 'test' }])
    ).toBe(false);
  });
});

describe('findNextOpenDay', () => {
  it('returns tomorrow when it is open', () => {
    expect(findNextOpenDay('2026-11-05', OPEN_ALL_WEEK, [])).toBe('2026-11-06');
  });

  it('returns the open day when it is exactly at the 14-day boundary', () => {
    const closures = [
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ].map((date) => ({ date, reason: 'test' }));
    expect(findNextOpenDay('2026-11-05', OPEN_ALL_WEEK, closures)).toBe('2026-11-19');
  });

  it('returns null when no open day exists within the window', () => {
    expect(findNextOpenDay('2026-11-05', CLOSED_ALL_WEEK, [])).toBeNull();
  });

  it('returns null when closures fully cover every day in the window even though weekdays would otherwise be open', () => {
    const closures = [
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
    ].map((date) => ({ date, reason: 'test' }));
    expect(findNextOpenDay('2026-11-05', OPEN_ALL_WEEK, closures)).toBeNull();
  });
});

describe('formatNextOpenDayLabel', () => {
  it('uses the short form for a target 1 day out', () => {
    expect(formatNextOpenDayLabel('2026-11-05', '2026-11-06')).toBe('See Friday');
  });

  it('uses the short form for a target exactly 6 days out', () => {
    expect(formatNextOpenDayLabel('2026-11-05', '2026-11-11')).toBe('See Wednesday');
  });

  it('uses the long form with date for a target 7 days out', () => {
    expect(formatNextOpenDayLabel('2026-11-05', '2026-11-12')).toBe('See Thursday 12 Nov');
  });
});

describe('formatDateKey / parseDateKey', () => {
  it('round-trips a known date key', () => {
    const key = '2026-11-08';
    expect(formatDateKey(parseDateKey(key))).toBe(key);
  });

  it('reports the correct weekday for 2026-11-08 (a Sunday)', () => {
    expect(weekdayForDateKey('2026-11-08')).toBe('sunday');
  });

  it('reports the correct weekday for 2026-11-09 (a Monday)', () => {
    expect(weekdayForDateKey('2026-11-09')).toBe('monday');
  });
});

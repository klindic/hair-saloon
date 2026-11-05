import { describe, expect, it } from 'vitest';
import { isInPast, rangesOverlap, type TimeRange } from './slots';

describe('rangesOverlap', () => {
  it('returns true when ranges genuinely overlap', () => {
    const a: TimeRange = { start: '2026-11-05T10:00:00+01:00', end: '2026-11-05T10:30:00+01:00' };
    const b: TimeRange = { start: '2026-11-05T10:15:00+01:00', end: '2026-11-05T10:45:00+01:00' };
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it('returns false when one range is fully before the other', () => {
    const a: TimeRange = { start: '2026-11-05T09:00:00+01:00', end: '2026-11-05T09:30:00+01:00' };
    const b: TimeRange = { start: '2026-11-05T10:00:00+01:00', end: '2026-11-05T10:30:00+01:00' };
    expect(rangesOverlap(a, b)).toBe(false);
  });

  it('returns false when ranges only touch at the boundary', () => {
    const a: TimeRange = { start: '2026-11-05T09:00:00+01:00', end: '2026-11-05T10:00:00+01:00' };
    const b: TimeRange = { start: '2026-11-05T10:00:00+01:00', end: '2026-11-05T10:30:00+01:00' };
    expect(rangesOverlap(a, b)).toBe(false);
  });

  it('returns true when one range fully contains the other', () => {
    const a: TimeRange = { start: '2026-11-05T09:00:00+01:00', end: '2026-11-05T11:00:00+01:00' };
    const b: TimeRange = { start: '2026-11-05T09:30:00+01:00', end: '2026-11-05T10:00:00+01:00' };
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it('is symmetric regardless of argument order', () => {
    const a: TimeRange = { start: '2026-11-05T10:00:00+01:00', end: '2026-11-05T10:30:00+01:00' };
    const b: TimeRange = { start: '2026-11-05T10:15:00+01:00', end: '2026-11-05T10:45:00+01:00' };
    expect(rangesOverlap(a, b)).toBe(rangesOverlap(b, a));
  });
});

describe('isInPast', () => {
  it('returns true when the slot start is before now', () => {
    expect(isInPast('2026-11-05T09:00:00+01:00', '2026-11-05T10:00:00+01:00')).toBe(true);
  });

  it('returns false when the slot start is after now', () => {
    expect(isInPast('2026-11-05T11:00:00+01:00', '2026-11-05T10:00:00+01:00')).toBe(false);
  });

  it('returns false when the slot start is exactly now', () => {
    expect(isInPast('2026-11-05T10:00:00+01:00', '2026-11-05T10:00:00+01:00')).toBe(false);
  });
});

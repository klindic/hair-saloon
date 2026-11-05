export interface TimeRange {
  start: string;
  end: string;
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = Date.parse(a.start);
  const aEnd = Date.parse(a.end);
  const bStart = Date.parse(b.start);
  const bEnd = Date.parse(b.end);
  return aStart < bEnd && bStart < aEnd;
}

export function isInPast(slotStart: string, now: string): boolean {
  return Date.parse(slotStart) < Date.parse(now);
}

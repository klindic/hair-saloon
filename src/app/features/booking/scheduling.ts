import type { Closure, DayHours, OpeningHours, Weekday } from '@contract/contract';

// Assumption pending product sign-off: no ticket specifies a granularity.
export const SLOT_GRANULARITY_MINUTES = 30;

// Matches findNextOpenDay's default window, so the day-picker and the next-open-day fallback
// cover the same range.
export const BOOKING_WINDOW_DAYS = 14;

const WEEKDAY_BY_JS_DAY: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const WEEKDAY_DISPLAY_BY_JS_DAY = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_DISPLAY_BY_JS_MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function weekdayForDateKey(dateKey: string): Weekday {
  return WEEKDAY_BY_JS_DAY[parseDateKey(dateKey).getDay()];
}

export function isDayOpen(
  dateKey: string,
  hours: OpeningHours,
  closures: Closure[] = hours.closures
): boolean {
  if (closures.some((closure) => closure.date === dateKey)) {
    return false;
  }
  return hours[weekdayForDateKey(dateKey)].open !== null;
}

// minServiceDurationMinutes is the shortest duration across services.json: a start that no
// service could finish before close is never offered.
export function computeDaySlots(dayHours: DayHours, minServiceDurationMinutes: number): string[] {
  if (dayHours.open === null || dayHours.close === null) {
    return [];
  }
  const [openHour, openMinute] = dayHours.open.split(':').map(Number);
  const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;
  const latestStartMinutes = closeMinutes - minServiceDurationMinutes;

  const slots: string[] = [];
  for (
    let minutes = openMinutes;
    minutes <= latestStartMinutes;
    minutes += SLOT_GRANULARITY_MINUTES
  ) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return slots;
}

export function findNextOpenDay(
  fromDate: string,
  hours: OpeningHours,
  closures: Closure[],
  maxDays = 14
): string | null {
  const fromDateObj = parseDateKey(fromDate);
  for (let offset = 1; offset <= maxDays; offset++) {
    const candidate = new Date(fromDateObj);
    candidate.setDate(candidate.getDate() + offset);
    const candidateKey = formatDateKey(candidate);
    if (isDayOpen(candidateKey, hours, closures)) {
      return candidateKey;
    }
  }
  return null;
}

export function formatNextOpenDayLabel(fromDate: string, targetDate: string): string {
  const fromDateObj = parseDateKey(fromDate);
  const targetDateObj = parseDateKey(targetDate);
  const dayDifference = Math.round((targetDateObj.getTime() - fromDateObj.getTime()) / 86400000);
  const weekdayName = WEEKDAY_DISPLAY_BY_JS_DAY[targetDateObj.getDay()];

  if (dayDifference <= 6) {
    return `See ${weekdayName}`;
  }

  const day = targetDateObj.getDate();
  const month = MONTH_DISPLAY_BY_JS_MONTH[targetDateObj.getMonth()];
  return `See ${weekdayName} ${day} ${month}`;
}

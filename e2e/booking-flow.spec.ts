// T-07: the demo-mode shell and the slot grid paint entirely from the compiled-in hours/services
// data, with no network round trip. Finding "the next open day" and "the next closed day" from
// whichever day the suite actually runs on — using the same `isDayOpen` the real code path uses,
// so dated closures in hours.json are honoured too — keeps these assertions true indefinitely,
// instead of hardcoding a date that only means "closed" or "open" as of when this file was
// written.
import { expect, test } from '@playwright/test';
import type { OpeningHours } from '../shared/contract';
import hoursJson from '../src/data/hours.json';
import { formatDateKey, isDayOpen } from '../src/app/features/booking/scheduling';

const hours = hoursJson satisfies OpeningHours as OpeningHours;

function dateKeyAt(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function offsetOfNextDay(matches: (day: Date) => boolean): number {
  for (let i = 0; i < 14; i++) {
    const day = new Date();
    day.setDate(day.getDate() + i);
    if (matches(day)) {
      return i;
    }
  }
  throw new Error('no matching day found in the 14-day window');
}

const nextOpenDayOffset = () => offsetOfNextDay((day) => isDayOpen(formatDateKey(day), hours));
const nextClosedDayOffset = () => offsetOfNextDay((day) => !isDayOpen(formatDateKey(day), hours));

test('the demo-mode banner is persistent and the sign-in control is disabled', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('This is a preview — bookings made here are not sent to the salon.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled();
});

test('the slot grid paints instantly from the compiled-in data once a day is picked', async ({
  page,
}) => {
  await page.goto('/book');

  await expect(page.getByText('Pick a day to see open times.')).toBeVisible();
  await expect(page.locator('app-slot-grid button')).toHaveCount(0);

  const openDateKey = dateKeyAt(nextOpenDayOffset());
  await page.getByRole('button', { name: openDateKey, exact: true }).click();

  await expect(page.getByText('Pick a day to see open times.')).toHaveCount(0);
  await expect(page.locator('app-slot-grid button').first()).toBeVisible();
});

test('a closed day shows the unavailable card, and its next-open-day link focuses the new slot grid', async ({
  page,
}) => {
  await page.goto('/book');

  const closedDateKey = dateKeyAt(nextClosedDayOffset());
  await page.getByRole('button', { name: closedDateKey, exact: true }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Closed today' })).toBeVisible();
  await expect(page.locator('app-slot-grid button')).toHaveCount(0);

  await page.locator('app-day-unavailable-card button').click();

  const firstSlot = page.locator('app-slot-grid button').first();
  await expect(firstSlot).toBeVisible();
  await expect(firstSlot).toBeFocused();
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { DayHours, OpeningHours, Service } from '@contract/contract';
import hoursJson from '../../../data/hours.json';
import servicesJson from '../../../data/services.json';
import { BookingPage } from './booking-page';
import { formatDateKey, isDayOpen, weekdayForDateKey } from './scheduling';

const hours = hoursJson satisfies OpeningHours as OpeningHours;
const services = servicesJson satisfies Service[] as Service[];
const minServiceDurationMinutes = Math.min(...services.map((service) => service.duration_minutes));

// Finding "the next open day" and "the next closed day" from whatever day the test actually runs
// on — using the same `isDayOpen` the real code path uses, so dated closures in hours.json are
// honoured too — keeps these assertions true regardless of the real calendar date, instead of
// hardcoding a date that only means "closed" or "open" as of when this file was written.
function indexOfNextDay(from: Date, matches: (day: Date) => boolean): number {
  for (let i = 0; i < 14; i++) {
    const day = new Date(from);
    day.setDate(day.getDate() + i);
    if (matches(day)) {
      return i;
    }
  }
  throw new Error('no matching day found in the 14-day window');
}

const indexOfNextClosedDay = () =>
  indexOfNextDay(new Date(), (day) => !isDayOpen(formatDateKey(day), hours));
const indexOfNextOpenDay = () =>
  indexOfNextDay(new Date(), (day) => isDayOpen(formatDateKey(day), hours));

// `hours[weekday].close` one minute short of the shortest service's duration: the window is open
// (`open !== null`) but no service can finish before close, same as the crafted repro in the
// scheduling-level test (`computeDaySlots({ open: '09:00', close: '09:15' }, 20)` === `[]`).
function tooShortToFitAnyService(open: string): string {
  const [openHour, openMinute] = open.split(':').map(Number);
  const closeMinutes = openHour * 60 + openMinute + minServiceDurationMinutes - 1;
  const closeHour = Math.floor(closeMinutes / 60);
  const closeMinute = closeMinutes % 60;
  return `${String(closeHour).padStart(2, '0')}:${String(closeMinute).padStart(2, '0')}`;
}

describe('BookingPage', () => {
  let fixture: ComponentFixture<BookingPage> | null = null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingPage],
    }).compileComponents();
  });

  afterEach(() => {
    (fixture?.nativeElement as HTMLElement | undefined)?.remove();
    fixture = null;
  });

  function create(): ComponentFixture<BookingPage> {
    fixture = TestBed.createComponent(BookingPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  function dayPickerButtons(target: ComponentFixture<BookingPage>): HTMLButtonElement[] {
    return Array.from(
      (target.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'app-day-picker button'
      )
    );
  }

  interface SlotSelection {
    date: string;
    time: string;
  }

  // slotSelection is protected: it exists so a date and a slot are carried as one value rather
  // than as two signals that only happen to stay in sync, and this reaches past the component's
  // public surface to prove that value is real and correct, not just that the DOM looks right.
  function slotSelectionOf(target: ComponentFixture<BookingPage>): SlotSelection | null {
    return (
      target.componentInstance as unknown as { slotSelection: () => SlotSelection | null }
    ).slotSelection();
  }

  it('shows the pick-a-day prompt and no slot grid before any day is selected', () => {
    const page = create();
    const compiled = page.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Pick a day to see open times.');
    expect(compiled.querySelector('app-slot-grid')).toBeNull();
    expect(compiled.querySelector('app-day-unavailable-card')).toBeNull();
  });

  it('shows the slot grid and hides the prompt when an open day is selected', async () => {
    const page = create();
    dayPickerButtons(page)[indexOfNextOpenDay()].click();
    await page.whenStable();

    const compiled = page.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Pick a day to see open times.');
    expect(compiled.querySelector('app-slot-grid button')).not.toBeNull();
    expect(compiled.querySelector('app-day-unavailable-card')).toBeNull();
  });

  it('combines the selected date and slot into one value, and clears it when the date changes', async () => {
    const page = create();
    const openDayIndex = indexOfNextOpenDay();
    const buttons = dayPickerButtons(page);
    buttons[openDayIndex].click();
    await page.whenStable();

    expect(slotSelectionOf(page)).toBeNull();

    const compiled = page.nativeElement as HTMLElement;
    const slotButton = compiled.querySelector<HTMLButtonElement>('app-slot-grid button');
    expect(slotButton).not.toBeNull();
    slotButton!.click();
    await page.whenStable();

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + openDayIndex);
    expect(slotSelectionOf(page)).toEqual({
      date: formatDateKey(expectedDate),
      time: slotButton!.textContent.trim(),
    });

    const anotherDayIndex = openDayIndex === 0 ? 1 : 0;
    buttons[anotherDayIndex].click();
    await page.whenStable();

    expect(slotSelectionOf(page)).toBeNull();
  });

  it('shows the day-unavailable card instead of a grid when a closed day is selected', async () => {
    const page = create();
    dayPickerButtons(page)[indexOfNextClosedDay()].click();
    await page.whenStable();

    const compiled = page.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-day-unavailable-card h2')?.textContent?.trim()).toBe(
      'Closed today'
    );
    expect(compiled.querySelector('app-slot-grid button')).toBeNull();
  });

  it('shows the fully-booked card instead of an empty grid when an open day has no slot that fits any service', async () => {
    // `dayIsOpen` only knows the shipped opening hours, not whether any service's duration fits
    // in that window — a day can be open (`open !== null`) and still have zero bookable slots,
    // e.g. computeDaySlots({ open: '09:00', close: '09:15' }, 20) === []. hours.json has no such
    // day today, so this test crafts one on the real, shared hours object for the duration of the
    // test and restores it afterwards: `hoursJson` and `hours` (src/app/features/booking/
    // booking-page.ts:29) are the same parsed object, so the mutation is visible to the component
    // under test without any module mocking, which the Angular unit-test builder rejects outright
    // for relative imports.
    const openDayIndex = indexOfNextOpenDay();
    const openDate = new Date();
    openDate.setDate(openDate.getDate() + openDayIndex);
    const weekday = weekdayForDateKey(formatDateKey(openDate));
    const original: DayHours = { ...hours[weekday] };
    hours[weekday] = { open: original.open, close: tooShortToFitAnyService(original.open!) };

    try {
      const page = create();
      dayPickerButtons(page)[openDayIndex].click();
      await page.whenStable();

      const compiled = page.nativeElement as HTMLElement;
      expect(compiled.querySelector('app-slot-grid')).toBeNull();
      expect(compiled.querySelector('app-day-unavailable-card h2')?.textContent?.trim()).toBe(
        'Fully booked'
      );
    } finally {
      hours[weekday] = original;
    }
  });

  it('moves focus to the first slot button after activating the next-open-day link', async () => {
    const page = create();
    dayPickerButtons(page)[indexOfNextClosedDay()].click();
    await page.whenStable();

    const compiled = page.nativeElement as HTMLElement;
    const nextOpenDayButton = compiled.querySelector<HTMLButtonElement>(
      'app-day-unavailable-card button'
    );
    expect(nextOpenDayButton).not.toBeNull();
    nextOpenDayButton!.click();
    await page.whenStable();

    const slotButton = compiled.querySelector<HTMLButtonElement>('app-slot-grid button');
    expect(compiled.querySelector('app-day-unavailable-card')).toBeNull();
    expect(slotButton).not.toBeNull();
    expect(document.activeElement).toBe(slotButton);
  });

  // Every 14-day window contains at least one Sunday, so there is always at least one closed day
  // to exercise here regardless of which real day this suite happens to run on — the exact
  // boundary (the window-edge day itself being the closed one) is covered deterministically with
  // literal dates in scheduling.spec.ts, since it depends on `today`'s weekday and can't be forced
  // through this component without controlling the real clock.
  it("never follows a next-open-day link to a date outside the day-picker's own window", async () => {
    const page = create();
    const compiled = page.nativeElement as HTMLElement;
    const buttons = dayPickerButtons(page);

    for (const button of buttons) {
      button.click();
      await page.whenStable();

      const nextOpenDayButton = compiled.querySelector<HTMLButtonElement>(
        'app-day-unavailable-card button'
      );
      if (nextOpenDayButton === null) {
        continue;
      }

      nextOpenDayButton.click();
      await page.whenStable();

      expect(compiled.querySelector('app-day-picker button[aria-pressed="true"]')).not.toBeNull();
    }
  });
});

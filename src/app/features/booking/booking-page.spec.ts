import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingPage } from './booking-page';

// `hours.json` closes only Sunday as a weekday (plus a handful of specific dates far in the
// future) — finding "the next Sunday" and "the next non-Sunday" from whatever day the test
// actually runs on keeps these assertions true regardless of the real calendar date, instead of
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

const indexOfNextClosedDay = () => indexOfNextDay(new Date(), (day) => day.getDay() === 0);
const indexOfNextOpenDay = () => indexOfNextDay(new Date(), (day) => day.getDay() !== 0);

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
});

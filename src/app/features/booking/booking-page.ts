import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import type { OpeningHours, Service } from '@contract/contract';
import contactJson from '../../../data/contact.json';
import hoursJson from '../../../data/hours.json';
import servicesJson from '../../../data/services.json';
import { DayPicker } from './day-picker/day-picker';
import { DayUnavailableCard } from './day-unavailable-card/day-unavailable-card';
import {
  BOOKING_WINDOW_DAYS,
  computeDaySlots,
  findNextOpenDay,
  formatDateKey,
  formatNextOpenDayLabel,
  isDayOpen,
  maxSearchDaysWithinWindow,
  weekdayForDateKey,
} from './scheduling';
import { SlotGrid } from './slot-grid/slot-grid';

const hours = hoursJson satisfies OpeningHours as OpeningHours;
const contact = contactJson;
const services = servicesJson satisfies Service[] as Service[];
const minServiceDurationMinutes = Math.min(...services.map((service) => service.duration_minutes));

interface NextOpenDay {
  date: string;
  label: string;
}

@Component({
  selector: 'app-booking-page',
  imports: [DayPicker, SlotGrid, DayUnavailableCard],
  template: `
    <h1 #pageHeading tabindex="-1">Book an Appointment</h1>

    <app-day-picker
      [today]="today"
      [days]="bookingWindowDays"
      [selectedDate]="selectedDate()"
      (dateSelected)="onDayPickerSelect($event)"
    />

    @if (selectedDate() === null) {
      <p>Pick a day to see open times.</p>
    } @else if (dayIsOpen()) {
      <div #slotGridRegion>
        <app-slot-grid
          [slots]="daySlots()"
          [selectedSlot]="selectedSlot()"
          (slotSelected)="selectedSlot.set($event)"
        />
      </div>
    } @else {
      <app-day-unavailable-card
        [reason]="'closed'"
        [selectedDate]="selectedDate()!"
        [nextOpenDay]="nextOpenDay()"
        [phoneNumber]="phoneNumber"
        (daySelected)="onNextOpenDaySelect($event)"
      />
    }
  `,
})
export class BookingPage {
  protected readonly bookingWindowDays = BOOKING_WINDOW_DAYS;
  protected readonly phoneNumber = contact.phone;
  protected readonly today = formatDateKey(new Date());

  private readonly injector = inject(Injector);
  private readonly pageHeading = viewChild.required<ElementRef<HTMLElement>>('pageHeading');
  private readonly slotGridRegion = viewChild<ElementRef<HTMLElement>>('slotGridRegion');

  protected readonly selectedDate = signal<string | null>(null);
  protected readonly selectedSlot = signal<string | null>(null);

  protected readonly slotSelection = computed(() => {
    const date = this.selectedDate();
    const time = this.selectedSlot();
    return date && time ? { date, time } : null;
  });

  protected readonly dayIsOpen = computed(() => {
    const date = this.selectedDate();
    return date !== null && isDayOpen(date, hours);
  });

  protected readonly daySlots = computed<string[]>(() => {
    const date = this.selectedDate();
    if (date === null || !this.dayIsOpen()) {
      return [];
    }
    return computeDaySlots(hours[weekdayForDateKey(date)], minServiceDurationMinutes);
  });

  protected readonly nextOpenDay = computed<NextOpenDay | null>(() => {
    const date = this.selectedDate();
    if (date === null || this.dayIsOpen()) {
      return null;
    }
    // Bounded by what's left of the day-picker's own window (fixed at `this.today`, never moved),
    // not a fresh BOOKING_WINDOW_DAYS from wherever the selection landed — otherwise the link can
    // point at a date with no corresponding day-picker button to show as selected afterwards.
    const maxDays = maxSearchDaysWithinWindow(this.today, date, this.bookingWindowDays);
    const next = findNextOpenDay(date, hours, hours.closures, maxDays);
    if (next === null) {
      return null;
    }
    return { date: next, label: formatNextOpenDayLabel(date, next) };
  });

  protected onDayPickerSelect(dateKey: string): void {
    // The day-picker's own buttons are never removed from the DOM on an ordinary date change, so
    // the browser keeps focus on whichever button the customer just clicked — nothing to do here.
    this.selectedDate.set(dateKey);
    this.selectedSlot.set(null);
  }

  protected onNextOpenDaySelect(dateKey: string): void {
    this.selectedDate.set(dateKey);
    this.selectedSlot.set(null);

    // Outcome (a) from DayUnavailableCard's own documented focus contract: if the newly selected
    // day has open slots, the card instance that owned focus is destroyed and the slot grid takes
    // its place. The card has no visibility into what replaces it and documents this as the
    // parent's job — this is that job. (Outcome (b), the card re-rendering itself with a new
    // unavailable day, is handled entirely inside the card; there is nothing to do here for it.)
    afterNextRender(
      () => {
        if (this.dayIsOpen()) {
          const firstSlotButton = this.slotGridRegion()?.nativeElement.querySelector('button');
          (firstSlotButton ?? this.pageHeading().nativeElement).focus();
        }
      },
      { injector: this.injector }
    );
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayUnavailableCard } from './day-unavailable-card';

const PHONE = '+385 1 234 5678';

// 2026-11-08 is a Sunday, 2026-11-09 a Monday, 2026-12-25 a Friday.
const SUNDAY = '2026-11-08';
const MONDAY = '2026-11-09';
const CHRISTMAS = '2026-12-25';

interface CardInputs {
  reason: 'closed' | 'fully-booked';
  selectedDate: string;
  nextOpenDay?: { date: string; label: string } | null;
  phoneNumber?: string;
}

describe('DayUnavailableCard', () => {
  let fixture!: ComponentFixture<DayUnavailableCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DayUnavailableCard],
    }).compileComponents();
  });

  afterEach(() => {
    host().remove();
  });

  // Every required input is set before the first change detection — reading a required input that
  // has no value yet throws, and the effect in the component reads two of them.
  //
  // The host element is then attached to `document.body` explicitly, because nothing can hold
  // focus while it is outside the document: `document.activeElement` would stay <body> whatever
  // the component did. Measured, not assumed: these tests still pass with the `appendChild` taken
  // out, because this TestBed already renders the fixture into a root element inside <body>. It
  // is kept anyway so the focus assertions do not quietly depend on that renderer detail (the
  // Vitest browser runner, for one, need not behave the same way).
  async function createCard(inputs: CardInputs): Promise<void> {
    fixture = TestBed.createComponent(DayUnavailableCard);
    fixture.componentRef.setInput('reason', inputs.reason);
    fixture.componentRef.setInput('selectedDate', inputs.selectedDate);
    fixture.componentRef.setInput('nextOpenDay', inputs.nextOpenDay ?? null);
    fixture.componentRef.setInput('phoneNumber', inputs.phoneNumber ?? PHONE);
    document.body.appendChild(host());
    await fixture.whenStable();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function heading(): HTMLHeadingElement {
    const element = host().querySelector('h2');
    expect(element).not.toBeNull();
    return element!;
  }

  function paragraphs(): string[] {
    return Array.from(host().querySelectorAll('p')).map((p) => p.textContent?.trim() ?? '');
  }

  function link(): HTMLButtonElement | null {
    return host().querySelector('button');
  }

  describe('closed-day copy', () => {
    it('names the weekday of the selected date', async () => {
      await createCard({ reason: 'closed', selectedDate: SUNDAY });

      expect(heading().textContent?.trim()).toBe('Closed today');
      expect(paragraphs()[0]).toBe("The salon isn't open on Sunday. Try another day.");
    });

    it('names the weekday from the date key, not from today', async () => {
      await createCard({ reason: 'closed', selectedDate: CHRISTMAS });

      expect(paragraphs()[0]).toBe("The salon isn't open on Friday. Try another day.");
    });
  });

  describe('fully-booked copy', () => {
    it('renders the fully-booked wording without crashing', async () => {
      await createCard({ reason: 'fully-booked', selectedDate: MONDAY });

      expect(heading().textContent?.trim()).toBe('Fully booked');
      expect(paragraphs()[0]).toBe('Every slot on this day is taken. Try another day.');
    });
  });

  describe('next-open-day control', () => {
    it('renders the parent-supplied label on a real focusable button', async () => {
      await createCard({
        reason: 'closed',
        selectedDate: SUNDAY,
        nextOpenDay: { date: MONDAY, label: 'See Monday' },
      });

      const control = link();
      expect(control).not.toBeNull();
      expect(control?.tagName).toBe('BUTTON');
      expect(control?.getAttribute('type')).toBe('button');
      expect(control?.textContent?.trim()).toBe('See Monday');
    });

    it('emits the next open day as a plain date key when activated', async () => {
      await createCard({
        reason: 'closed',
        selectedDate: SUNDAY,
        nextOpenDay: { date: MONDAY, label: 'See Monday' },
      });

      let emitted: string | null = null;
      fixture.componentInstance.daySelected.subscribe((dateKey: string) => {
        emitted = dateKey;
      });

      link()?.click();

      expect(emitted).toBe(MONDAY);
    });
  });

  describe('phone fallback', () => {
    it('renders no link and invites a phone call when there is no next open day', async () => {
      await createCard({ reason: 'closed', selectedDate: SUNDAY, nextOpenDay: null });

      expect(link()).toBeNull();
      expect(paragraphs()[1]).toBe(`No open days in the next two weeks — call us on ${PHONE}.`);
    });

    it('renders the phone number the parent passed in', async () => {
      await createCard({ reason: 'closed', selectedDate: SUNDAY, phoneNumber: '+385 9 999 0000' });

      expect(paragraphs()[1]).toContain('+385 9 999 0000');
    });
  });

  describe('focus management', () => {
    it('does not take focus on its first render', async () => {
      await createCard({
        reason: 'closed',
        selectedDate: SUNDAY,
        nextOpenDay: { date: MONDAY, label: 'See Monday' },
      });

      expect(document.activeElement).not.toBe(heading());
      expect(document.activeElement).toBe(document.body);
    });

    // Outcome (b) in the component's focus contract: the parent handled `daySelected`, found the
    // next open day was also unavailable, and re-pointed this same instance at it.
    it('moves focus to its own heading when the same instance is re-pointed at a new day', async () => {
      await createCard({
        reason: 'closed',
        selectedDate: SUNDAY,
        nextOpenDay: { date: CHRISTMAS, label: 'See Friday 25 Dec' },
      });

      fixture.componentRef.setInput('selectedDate', CHRISTMAS);
      fixture.componentRef.setInput('reason', 'closed');
      fixture.componentRef.setInput('nextOpenDay', { date: MONDAY, label: 'See Monday' });
      await fixture.whenStable();

      expect(document.activeElement).toBe(heading());
      expect(heading().textContent?.trim()).toBe('Closed today');
      expect(paragraphs()[0]).toBe("The salon isn't open on Friday. Try another day.");
    });

    it('takes focus off the next-open-day control whose label changed underneath it', async () => {
      await createCard({
        reason: 'closed',
        selectedDate: SUNDAY,
        nextOpenDay: { date: CHRISTMAS, label: 'See Friday 25 Dec' },
      });

      const control = link();
      control?.focus();
      expect(document.activeElement).toBe(control);

      fixture.componentRef.setInput('selectedDate', CHRISTMAS);
      fixture.componentRef.setInput('nextOpenDay', { date: MONDAY, label: 'See Monday' });
      await fixture.whenStable();

      expect(document.activeElement).toBe(heading());
      expect(link()?.textContent?.trim()).toBe('See Monday');
    });

    it('moves focus to its heading when the re-pointed day has no next open day either', async () => {
      await createCard({
        reason: 'closed',
        selectedDate: SUNDAY,
        nextOpenDay: { date: CHRISTMAS, label: 'See Friday 25 Dec' },
      });

      fixture.componentRef.setInput('selectedDate', CHRISTMAS);
      fixture.componentRef.setInput('nextOpenDay', null);
      await fixture.whenStable();

      expect(document.activeElement).toBe(heading());
      expect(link()).toBeNull();
    });

    it('moves focus when only the reason changes', async () => {
      await createCard({ reason: 'closed', selectedDate: SUNDAY });

      fixture.componentRef.setInput('reason', 'fully-booked');
      await fixture.whenStable();

      expect(document.activeElement).toBe(heading());
      expect(heading().textContent?.trim()).toBe('Fully booked');
    });

    // A day-picker click from one closed day straight to another re-points this same instance —
    // outcome (b) — but the user activated a control OUTSIDE the card, not the card's own link.
    // Stealing their focus into this heading would cost them their place in the day-picker for no
    // reason, so this is the one case the card must leave alone.
    it('leaves focus on an outside control when it did not originate inside the card', async () => {
      await createCard({ reason: 'closed', selectedDate: SUNDAY });

      const dayPickerButton = document.createElement('button');
      dayPickerButton.textContent = 'a day-picker button, not ours';
      document.body.appendChild(dayPickerButton);
      dayPickerButton.focus();
      expect(document.activeElement).toBe(dayPickerButton);

      fixture.componentRef.setInput('selectedDate', CHRISTMAS);
      await fixture.whenStable();

      expect(document.activeElement).toBe(dayPickerButton);
      expect(heading().textContent?.trim()).toBe('Closed today');

      dayPickerButton.remove();
    });
  });
});

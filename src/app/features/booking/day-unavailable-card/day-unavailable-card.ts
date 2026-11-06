// Shown in place of the slot grid when the selected day cannot be booked: closed by the shipped
// opening hours, or (from T-14) open but with every slot taken. Presentational only — the parent
// computes `nextOpenDay` with `findNextOpenDay`/`formatNextOpenDayLabel` from `scheduling.ts` and
// reads the phone number out of `src/data/contact.json`. This component imports neither.
//
// FOCUS CONTRACT — read this before changing anything below.
//
// Activating the next-open-day control emits `daySelected`, and then the PARENT decides what
// happens next, asynchronously. There are two outcomes, and only one of them is ours:
//
//   (a) The next open day has slots, so the parent destroys this card and renders the slot grid
//       where it stood. THE PARENT MUST MOVE FOCUS in this case — to the slot grid's first slot
//       button, or to its own heading — from inside its own `afterNextRender`, after it has
//       handled `daySelected`. This component cannot do it: the element to focus belongs to a
//       sibling component that does not exist yet when the event is emitted, and `SlotGrid`
//       exposes no focus hook of any kind. Reaching across that boundary is deliberately not
//       attempted here; it is a real boundary, not an oversight.
//
//   (b) The next open day is itself unavailable (chained closures), so the parent keeps this
//       instance and re-points it at a new `selectedDate`/`reason`/`nextOpenDay`. Nothing was
//       destroyed, so focus is still sitting on our own control — whose label just changed under
//       the user from "See Tuesday" to something else. That case is ours, and the effect below
//       handles it by moving focus to the re-rendered heading.
//
// Angular reuses this same instance for (b) whenever the parent's `@else` branch does not change,
// which also covers a day-picker click straight from one closed day to another: nothing destroyed
// the card, so by the two outcomes above this looks exactly like a chained-closure re-point. But
// the user did not activate anything inside this card — they clicked a day-picker button that
// still exists — so stealing their focus into this heading would cost them their place in the day
// row for no reason. `focusIsOursToMove` tells the two apart: only take focus if it was already
// inside this card (our own control, about to be relabelled) or nowhere in particular (first
// render, or a test that never focused anything). If it is sitting on a control outside the card,
// leave it there.
//
// Focus cannot be moved synchronously from the click handler in either case: change detection has
// not run yet, so in (a) the target does not exist and in (b) the heading still names the old
// day. Hence `afterNextRender`, which runs once the DOM has caught up.
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

@Component({
  selector: 'app-day-unavailable-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="day-unavailable-card" #cardRegion>
      <!-- tabindex="-1" makes the heading programmatically focusable without putting it in the
           tab order; see the focus contract at the top of this file. -->
      <h2 tabindex="-1" #heading>{{ headingText() }}</h2>
      <p>{{ bodyText() }}</p>
      @if (nextOpenDay(); as nextDay) {
        <!-- A real button, not a div with a click handler: it is focusable and Enter/Space
             activate it for free. Emits the same plain date key a day-picker button emits.
             Reset to plain underlined text with no accent fill, per spec — real hover/focus
             styling is T-06's, this is just enough to not look like a default button. -->
        <button type="button" [style]="linkStyle" (click)="daySelected.emit(nextDay.date)">
          {{ nextDay.label }}
        </button>
      } @else {
        <p>{{ callUsText() }}</p>
      }
    </section>
  `,
})
export class DayUnavailableCard {
  readonly reason = input.required<'closed' | 'fully-booked'>();
  /** A `YYYY-MM-DD` key. Used only to name the weekday in the closed-day copy. */
  readonly selectedDate = input.required<string>();
  /** Pre-computed by the parent; `null` means no open day inside the search window. */
  readonly nextOpenDay = input<{ date: string; label: string } | null>(null);
  readonly phoneNumber = input.required<string>();

  readonly daySelected = output<string>();

  // Written as statements rather than ternaries so each `// TODO(T-05)` stays attached to the one
  // string it is about; Prettier reflows a trailing comment out of a wrapped ternary.
  readonly headingText = computed(() => {
    if (this.reason() === 'closed') {
      return 'Closed today';
    }
    return 'Fully booked'; // TODO(T-05): confirm exact copy
  });

  readonly bodyText = computed(() => {
    if (this.reason() === 'closed') {
      return `The salon isn't open on ${weekdayNameOf(this.selectedDate())}. Try another day.`;
    }
    return 'Every slot on this day is taken. Try another day.'; // TODO(T-05): confirm exact copy
  });

  // TODO(T-05): confirm exact copy, including whether "two weeks" should be read off the window
  // `findNextOpenDay` actually searched rather than hard-coded in this sentence.
  readonly callUsText = computed(
    () => `No open days in the next two weeks — call us on ${this.phoneNumber()}.`
  );

  // Plain underlined text, no accent fill, per spec — strips the native button chrome without
  // needing a real token. TODO(T-06): replace with the token set's link styling.
  protected readonly linkStyle =
    'background: none; border: none; padding: 0; text-decoration: underline; cursor: pointer;';

  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly cardRegion = viewChild.required<ElementRef<HTMLElement>>('cardRegion');

  private hasRendered = false;

  constructor() {
    effect(() => {
      // Tracked on purpose: these two inputs are what the card's wording is about. A change to
      // either means the parent kept this instance and pointed it at a different day — outcome
      // (b) above — so the user has to be told where they now are.
      this.selectedDate();
      this.reason();

      if (!this.hasRendered) {
        // First run is the initial render. A freshly created card never takes focus on its own.
        this.hasRendered = true;
        return;
      }

      // Read focus NOW, before the new copy renders: at this point it is still wherever it was
      // when this effect was triggered (the control the user just activated, or an outside
      // day-picker button), not wherever `afterNextRender` will find it.
      const shouldMoveFocus = this.focusIsOursToMove();
      this.focusHeadingAfterNextRender(shouldMoveFocus);
    });
  }

  // True when focus belongs to this card (its own next-open-day control, about to be relabelled
  // or removed) or sits nowhere in particular (first render; a test that never focused anything).
  // False when focus is on a control outside the card — a day-picker button the user clicked to
  // land on a different closed day — which this component must leave alone.
  private focusIsOursToMove(): boolean {
    const active = this.document.activeElement;
    if (active === null || active === this.document.body) {
      return true;
    }
    return this.cardRegion().nativeElement.contains(active);
  }

  private focusHeadingAfterNextRender(shouldMoveFocus: boolean): void {
    if (!shouldMoveFocus) {
      return;
    }
    afterNextRender(
      () => {
        const heading = this.heading().nativeElement;
        // A pending hook registers itself against this component's `DestroyRef` — the documented
        // default when `manualCleanup` is not set — so outcome (a), where the card is destroyed,
        // should never reach here. The guard makes that independent of the framework detail:
        // never call `focus()` on a detached element, which silently drops focus to <body>.
        if (!heading.isConnected) {
          return;
        }
        heading.focus();
      },
      { injector: this.injector }
    );
  }
}

function weekdayNameOf(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  // The three-argument LOCAL constructor, deliberately. `new Date('2026-11-08')` parses as UTC
  // midnight and reports the previous weekday for any runtime west of Greenwich.
  return WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()];
}

import { TestBed } from '@angular/core/testing';
import { DayPicker } from './day-picker';

function buttons(fixture: { nativeElement: unknown }): HTMLButtonElement[] {
  const compiled = fixture.nativeElement as HTMLElement;
  return Array.from(compiled.querySelectorAll('button'));
}

describe('DayPicker', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DayPicker],
    }).compileComponents();
  });

  it('renders one button per day', () => {
    const fixture = TestBed.createComponent(DayPicker);
    fixture.componentRef.setInput('today', '2026-11-05');
    fixture.componentRef.setInput('days', 14);
    fixture.detectChanges();

    expect(buttons(fixture).length).toBe(14);
  });

  it('rolls date keys over a month boundary', () => {
    const fixture = TestBed.createComponent(DayPicker);
    fixture.componentRef.setInput('today', '2026-11-28');
    fixture.componentRef.setInput('days', 5);
    fixture.detectChanges();

    const rendered = buttons(fixture);
    expect(rendered.length).toBe(5);
    expect(rendered[4].textContent?.trim()).toBe('2026-12-02');
  });

  it('marks the selected day with aria-pressed and others as not pressed', () => {
    const fixture = TestBed.createComponent(DayPicker);
    fixture.componentRef.setInput('today', '2026-11-05');
    fixture.componentRef.setInput('days', 3);
    fixture.componentRef.setInput('selectedDate', '2026-11-06');
    fixture.detectChanges();

    const rendered = buttons(fixture);
    expect(rendered[0].getAttribute('aria-pressed')).toBe('false');
    expect(rendered[1].getAttribute('aria-pressed')).toBe('true');
    expect(rendered[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('emits the clicked date key', () => {
    const fixture = TestBed.createComponent(DayPicker);
    fixture.componentRef.setInput('today', '2026-11-05');
    fixture.componentRef.setInput('days', 3);
    fixture.detectChanges();

    let emitted: string | null = null;
    fixture.componentInstance.dateSelected.subscribe((dateKey: string) => {
      emitted = dateKey;
    });

    buttons(fixture)[2].click();

    expect(emitted).toBe('2026-11-07');
  });
});

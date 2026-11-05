import { TestBed } from '@angular/core/testing';
import { SlotGrid } from './slot-grid';

function buttons(fixture: { nativeElement: unknown }): HTMLButtonElement[] {
  const compiled = fixture.nativeElement as HTMLElement;
  return Array.from(compiled.querySelectorAll('button'));
}

describe('SlotGrid', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlotGrid],
    }).compileComponents();
  });

  it('renders one button per slot with the slot as its label', () => {
    const fixture = TestBed.createComponent(SlotGrid);
    fixture.componentRef.setInput('slots', ['09:00', '09:30', '10:00']);
    fixture.detectChanges();

    const rendered = buttons(fixture);
    expect(rendered.length).toBe(3);
    expect(rendered.map((button) => button.textContent?.trim())).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ]);
  });

  it('renders no buttons for an empty slots array', () => {
    const fixture = TestBed.createComponent(SlotGrid);
    fixture.componentRef.setInput('slots', []);
    fixture.detectChanges();

    expect(buttons(fixture).length).toBe(0);
  });

  it('marks the selected slot with aria-pressed and others as not pressed', () => {
    const fixture = TestBed.createComponent(SlotGrid);
    fixture.componentRef.setInput('slots', ['09:00', '09:30', '10:00']);
    fixture.componentRef.setInput('selectedSlot', '09:30');
    fixture.detectChanges();

    const rendered = buttons(fixture);
    expect(rendered[0].getAttribute('aria-pressed')).toBe('false');
    expect(rendered[1].getAttribute('aria-pressed')).toBe('true');
    expect(rendered[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('emits the clicked slot', () => {
    const fixture = TestBed.createComponent(SlotGrid);
    fixture.componentRef.setInput('slots', ['09:00', '09:30', '10:00']);
    fixture.detectChanges();

    let emitted: string | null = null;
    fixture.componentInstance.slotSelected.subscribe((slot: string) => {
      emitted = slot;
    });

    buttons(fixture)[1].click();

    expect(emitted).toBe('09:30');
  });
});

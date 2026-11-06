import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-slot-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slot-grid">
      @for (slot of slots(); track slot) {
        <button
          type="button"
          [attr.aria-pressed]="slot === selectedSlot()"
          (click)="slotSelected.emit(slot)"
        >
          {{ slot }}
        </button>
      }
    </div>
  `,
})
export class SlotGrid {
  readonly slots = input.required<string[]>();
  readonly selectedSlot = input<string | null>(null);

  readonly slotSelected = output<string>();
}

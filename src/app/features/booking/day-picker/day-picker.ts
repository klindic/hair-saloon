import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-day-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="day-picker">
      @for (dateKey of dateKeys(); track dateKey) {
        <button
          type="button"
          [attr.aria-pressed]="dateKey === selectedDate()"
          (click)="dateSelected.emit(dateKey)"
        >
          <!-- TODO(T-06): decide the real label (weekday abbreviation, day-of-month, etc). -->
          {{ dateKey }}
        </button>
      }
    </div>
  `,
})
export class DayPicker {
  readonly today = input.required<string>();
  readonly days = input<number>(14);
  readonly selectedDate = input<string | null>(null);

  readonly dateSelected = output<string>();

  readonly dateKeys = computed<string[]>(() => {
    const [y, m, d] = this.today().split('-').map(Number);
    const keys: string[] = [];
    for (let i = 0; i < this.days(); i++) {
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + i);
      keys.push(formatDateKey(date));
    }
    return keys;
  });
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

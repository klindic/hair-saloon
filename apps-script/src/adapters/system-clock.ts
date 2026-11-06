import type { Clock } from '../domain/booking';

/** The `Clock` port, backed by the system's wall-clock time. */
export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}

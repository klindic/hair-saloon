import type { Zone } from '../domain/bookings-repo';

/**
 * The `Zone` port, backed by the script's own configured timezone
 * (`appsscript.json`'s `timeZone`, read back via `Session.getScriptTimeZone()`)
 * rather than any zone name written down in this file.
 */
export class ScriptZone implements Zone {
  // Cached on first use rather than re-read on every call: the script's timezone
  // cannot change mid-execution, and this avoids a redundant Session call per row.
  private timeZone: string | undefined;

  offsetFor(instant: string): string {
    this.timeZone ??= Session.getScriptTimeZone();
    return Utilities.formatDate(new Date(instant), this.timeZone, 'XXX');
  }
}

import { BOOKINGS_COLUMNS, type BookingRow, type BookingStatus } from '@contract/contract';

/**
 * The salon's timezone, as a port rather than a fact. Zagreb is +01:00 (CET) for most of the
 * year and +02:00 (CEST) between late March and late October, so the offset is a function of
 * the instant, never a constant. The concrete implementation reads it from the script's own
 * timezone via Apps Script globals and lives in `adapters/zone.ts`; nothing in `domain/` knows
 * the zone's name.
 */
export interface Zone {
  /** `instant` is a UTC ISO-8601 string (e.g. 2026-11-07T09:00:00.000Z). Returns '+01:00'. */
  offsetFor(instant: string): string;
}

/**
 * The Bookings tab, as a port. `loadBookingsSnapshot` is one sheet read with the header row
 * already stripped: raw cells, unparsed, because Sheets decides for itself whether a cell comes
 * back as a string or a Date and `parseBookingRow` is the only place that reckons with that.
 */
export interface BookingsRepo {
  loadBookingsSnapshot(): unknown[][];
  append(row: BookingRow): void;
}

/** The three columns written as ISO-8601 datetimes, and so the three Sheets can re-type. */
type DatetimeColumn = 'created_at' | 'slot_start' | 'slot_end';

const OFFSET_PATTERN = /^[+-]\d{2}:\d{2}$/;

const MILLIS_PER_MINUTE = 60_000;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function offsetToMinutes(offset: string): number {
  if (!OFFSET_PATTERN.test(offset)) {
    throw new Error(`Zone returned an offset this code cannot parse: ${offset}`);
  }
  const sign = offset.startsWith('-') ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  return sign * (hours * 60 + minutes);
}

/** The exact shape a correctly-written cell has: no 'Z', no space, no milliseconds. */
const EXPLICIT_OFFSET_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

/**
 * Shift `instant` by the zone's offset for that instant and read the result back with the UTC
 * getters, which is what spells out salon-local wall-clock time without ever consulting the host
 * machine's own timezone. Shared by every path that starts from a real instant rather than an
 * already-correct string: a native `Date`, and a string whose shape needs recovering too.
 */
function reconstructFromInstant(instant: Date, zone: Zone): string {
  const offset = zone.offsetFor(instant.toISOString());
  const shifted = new Date(instant.getTime() + offsetToMinutes(offset) * MILLIS_PER_MINUTE);
  const date = `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}-${pad(shifted.getUTCDate(), 2)}`;
  const time = `${pad(shifted.getUTCHours(), 2)}:${pad(shifted.getUTCMinutes(), 2)}:${pad(shifted.getUTCSeconds(), 2)}`;
  return `${date}T${time}${offset}`;
}

/**
 * Recover the salon-local ISO-8601 string for a cell that should hold one.
 *
 * Rows are written with an explicit offset ('2026-11-07T10:00:00+01:00'), but Sheets auto-parses
 * anything date-shaped into its own serial value, which comes back out of `getValues()` as a
 * native `Date`. That `Date` still points at the right instant and has lost every trace of the
 * offset it was written with, so `toISOString()` would answer in UTC ('...T09:00:00.000Z') and
 * the browser would be told the salon is busy at the wrong wall-clock hour.
 *
 * A string is only trusted verbatim when it already has exactly the shape a correctly-written
 * cell has (`EXPLICIT_OFFSET_ISO`) — a shape check, not just a `typeof`. A string that is close
 * but not quite right (a 'Z' suffix, a space instead of 'T', milliseconds) is not published as
 * written: it goes through the same instant-based recovery as a `Date`, so the zone - not the
 * cell - decides the offset that ends up in the response. A string `Date` cannot parse at all
 * throws, the same as any other value this function cannot make sense of.
 *
 * A space between the date and time portions is normalised to 'T' before parsing. `Date`'s own
 * constructor accepts a space there on V8 (Node and Apps Script's runtime alike), but that
 * leniency is implementation-defined, not something the language guarantees - normalising first
 * means the actual parse is always the one spec-defined ISO form, on any engine.
 */
export function toSlotIso(value: unknown, zone: Zone): string {
  if (typeof value === 'string') {
    if (EXPLICIT_OFFSET_ISO.test(value)) {
      return value;
    }
    const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2');
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Expected an ISO-8601 datetime, got the unparseable string "${value}"`);
    }
    return reconstructFromInstant(parsed, zone);
  }
  if (value instanceof Date) {
    return reconstructFromInstant(value, zone);
  }
  throw new Error(`Expected a string or a Date in a datetime cell, got ${typeof value}`);
}

/**
 * Zip one raw sheet row against `BOOKINGS_COLUMNS` into a `BookingRow`. Column order comes from
 * the contract, never from a local copy of it, so a column added there breaks here loudly.
 *
 * `status` is cast, not validated: the owner edits that cell by hand and the read path only ever
 * compares it to 'cancelled', so a typo in the sheet is a data problem for the owner to see in
 * the sheet, not an exception that takes the whole day's availability down.
 */
export function parseBookingRow(raw: unknown[], zone: Zone): BookingRow {
  const cell = (column: (typeof BOOKINGS_COLUMNS)[number]): unknown =>
    raw[BOOKINGS_COLUMNS.indexOf(column)];
  const datetime = (column: DatetimeColumn): string => toSlotIso(cell(column), zone);
  return {
    booking_id: String(cell('booking_id')),
    created_at: datetime('created_at'),
    slot_start: datetime('slot_start'),
    slot_end: datetime('slot_end'),
    service_id: String(cell('service_id')),
    stylist: String(cell('stylist')),
    customer_name: String(cell('customer_name')),
    customer_email: String(cell('customer_email')),
    status: String(cell('status')) as BookingStatus,
    notes: String(cell('notes')),
  };
}

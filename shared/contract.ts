// Frozen frontend/backend contract for the salon booking system.
//
// Imported by BOTH the Angular frontend and the Google Apps Script backend. It is the only
// definition of the wire format and of the sheet's column order; nobody redefines these shapes
// locally. Changing a field name here is a breaking change and needs both sides updated in the
// same pull request (see CONVENTIONS.md).
//
// Field names are snake_case because they describe the wire and the sheet columns, not
// TypeScript idiom. camelCase starts on the other side of this file.

// ===== Read path: availability =====

export interface AvailabilityRequest {
  action: 'availability';
  date: string; // YYYY-MM-DD, the day being asked about
}

export interface BusyRange {
  start: string; // ISO 8601 with an explicit offset, e.g. 2026-11-07T10:00:00+01:00
  end: string; // ISO 8601 with an explicit offset
}

export interface AvailabilityResponse {
  ok: true;
  date: string; // echo of the requested date
  busy: BusyRange[];
}

// Deliberately no names, emails, booking ids or service ids in the availability response: this
// endpoint is anonymous, so an unauthenticated caller learns the salon is busy at 10am and
// nothing about who is in the chair. Adding any customer field here is a privacy regression.

// ===== Write path: booking =====

export interface BookRequest {
  action: 'book';
  // A client-generated UUID, minted by the browser before the request is sent — never by the
  // backend. It exists so that a request whose response was lost in transit and is then retried
  // can prove to the backend that it is the same request come again, not a new booking.
  booking_id: string;
  // The Auth0 access token travels in the BODY, not an Authorization header. Apps Script web
  // apps never answer a CORS preflight, so this POST has to stay a CORS-simple request:
  // Content-Type text/plain;charset=utf-8, no custom headers.
  access_token: string;
  slot_start: string; // ISO 8601 with an explicit offset
  slot_end: string; // ISO 8601 with an explicit offset
  service_id: string;
  customer_name: string;
  notes?: string;
}

// Deliberately no customer_email field. The backend derives the verified email from the token
// via Auth0's /userinfo and ignores anything the client claims about who it is.

export interface BookSuccessResponse {
  ok: true;
  // Echo of the request's booking_id, never minted by the server. The server's only job with
  // this value is to recognise it on replay; it is not a source of new ids.
  booking_id: string;
  // Only ever 'requested' from this endpoint, never 'confirmed': v1 promises a recorded request
  // that the salon confirms by hand in the sheet.
  status: 'requested';
  slot_start: string; // echo of the requested slot
  slot_end: string; // echo of the requested slot
}

// ===== Errors =====

export type BookingErrorCode =
  | 'slot_taken'
  | 'slot_in_past'
  | 'invalid_request'
  | 'unauthenticated'
  | 'rate_limited'
  | 'internal_error';

export interface ErrorResponse {
  ok: false;
  error: BookingErrorCode;
  message: string;
}

// Both calls are discriminated on `ok`, so a caller cannot read booking_id or busy without
// narrowing first.
export type AvailabilityResult = AvailabilityResponse | ErrorResponse;
export type BookResult = BookSuccessResponse | ErrorResponse;
export type EndpointResult = AvailabilityResult | BookResult;

// Idempotency replay rule, precisely: a request whose booking_id, verified email, and slot
// (both slot_start and slot_end) all match an existing row returns that row's original
// BookSuccessResponse again and writes nothing new. A request whose booking_id and verified
// email match an existing row but whose slot differs returns the 'invalid_request' error code —
// the same id cannot be reused to mean a different booking. A booking_id that is not a
// well-formed UUID also returns 'invalid_request'; it is never treated as a fresh booking with a
// garbage key.
//
// A same-booking_id collision from one customer is expected client behaviour, not a rare edge
// case: the frontend retries once automatically after a timeout, using the same booking_id, when
// it cannot tell whether its first POST landed. This replay rule is the system's only way to
// confirm a write landed, because there is deliberately no bookings-lookup endpoint (cut on
// privacy grounds — it would let anyone probe who booked what).

// ===== Salon configuration =====

// The one piece of configuration both the browser and the Apps Script runtime need. It exists
// twice in this system because the two runtimes cannot share a TypeScript import: the second
// copy is apps-script/src/appsscript.json's `timeZone` field, which Apps Script reads directly
// as a deploy manifest and so can never import this file. A Node test keeps the two values in
// sync.
export const SALON_TIMEZONE = 'Europe/Zagreb';

// ===== Sheet shapes =====

// The app only ever writes 'requested'. The owner moves a row to 'confirmed' or 'cancelled' by
// hand; that manual edit is the whole owner workflow in v1.
export type BookingStatus = 'requested' | 'confirmed' | 'cancelled';

// Column order of the sheet's tabs, as a value rather than prose, so the backend writes a row by
// this array and `npm run check:contract` can assert docs/sheet-template.md still agrees.
export const BOOKINGS_COLUMNS = [
  'booking_id',
  'created_at',
  'slot_start',
  'slot_end',
  'service_id',
  'stylist',
  'customer_name',
  'customer_email',
  'status',
  'notes',
] as const;

export const SERVICES_COLUMNS = ['id', 'name', 'price', 'duration_minutes'] as const;

export const SHEET_TAB_NAMES = {
  bookings: 'Bookings',
  services: 'Services',
  hoursAndClosures: 'Hours and Closures',
} as const;

export interface BookingRow {
  booking_id: string;
  created_at: string; // ISO 8601 with an explicit offset
  slot_start: string;
  slot_end: string;
  service_id: string;
  stylist: string; // constant in v1: one salon, one stylist, one chair
  customer_name: string;
  customer_email: string; // from the verified token, never from the request body
  status: BookingStatus;
  notes: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

// ===== Shipped salon data =====

export type Weekday =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

// A closed weekday is `{ open: null, close: null }`. That is the convention, not an accident:
// the sheet's Hours and Closures tab carries the word `closed` in both cells and it maps to null
// here. Anything else (an empty string, a missing key, open === close) is invalid data.
export interface DayHours {
  open: string | null; // HH:mm, 24-hour, or null when the salon is closed that weekday
  close: string | null; // HH:mm, 24-hour, or null when the salon is closed that weekday
}

export interface Closure {
  date: string; // YYYY-MM-DD
  reason: string; // the owner's own note; never shown to a customer and never read by logic
}

export type OpeningHours = Record<Weekday, DayHours> & {
  closures: Closure[];
};

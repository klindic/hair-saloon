import type {
  BookRequest,
  BookResult,
  BookSuccessResponse,
  BookingRow,
  ErrorResponse,
} from '@contract/contract';
import {
  parseBookingRow,
  RECOVERABLE_ISO,
  toSlotIso,
  ZoneOffsetError,
  type BookingsRepo,
  type Zone,
} from './bookings-repo';
import { isInPast, rangesOverlap } from './slots';

/**
 * Wall-clock time as a port. The write path needs `now` twice - once to reject a slot that has
 * already happened, once to stamp `created_at` - and both must come from the same injected source
 * so a test can state the moment it is reasoning about instead of racing the machine it runs on.
 * The concrete implementation is one line over `Date`; it lives in `adapters/`, not here.
 */
export interface Clock {
  /** An ISO-8601 instant. The offset it carries is irrelevant: only the instant is ever read. */
  now(): string;
}

/**
 * What verifying an access token can tell us. Either the token names a verified email address, or
 * it does not - and "does not" splits in two, because the two cases are not the customer's fault
 * in the same way. `unauthenticated` means the token was rejected; `rate_limited` means the
 * identity provider declined to answer right now, which says nothing about the token and is worth
 * retrying. Collapsing them would tell a customer with a perfectly good session to log in again.
 */
export type VerifyResult =
  { ok: true; email: string } | { ok: false; error: 'unauthenticated' | 'rate_limited' };

/**
 * Identity as a port. The verified email is the one piece of customer identity this system trusts,
 * and it only ever comes from here - `BookRequest` deliberately has no email field at all (see the
 * contract), so there is nothing in the request body for a caller to lie with.
 */
export interface TokenVerifier {
  verify(accessToken: string): VerifyResult;
}

/**
 * The salon's one mutex, as a port. `tryAcquire` returns false rather than throwing when the lock
 * is already held, because contention is an expected outcome of two customers clicking at once,
 * not an exception. `release` is only ever called against an acquisition that actually succeeded.
 */
export interface Lock {
  tryAcquire(timeoutMs: number): boolean;
  release(): void;
}

/** Everything `bookSlot` needs from the outside world, and nothing more. */
export interface BookSlotPorts {
  clock: Clock;
  tokenVerifier: TokenVerifier;
  lock: Lock;
  repo: BookingsRepo;
  zone: Zone;
  /** One salon, one stylist, one chair in v1: a constant written into every row's column. */
  stylist: string;
}

/**
 * How long to wait for the mutex before giving up. Long enough that a second customer arriving
 * mid-write queues behind the first instead of being turned away, short enough that the request
 * answers well inside the Apps Script execution budget.
 */
const LOCK_TIMEOUT_MS = 5000;

/**
 * The canonical 8-4-4-4-12 hyphenated hex UUID - what `crypto.randomUUID()` produces - matched
 * case-insensitively. Any UUID version is accepted: this field is a comparison key, not a
 * version-sensitive identifier. The shape is checked because `booking_id` is the sheet's de-facto
 * primary key and is supplied by the client; a garbage key would still be written, and would then
 * be a row no retry could ever match.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidRequest(message: string): ErrorResponse {
  return { ok: false, error: 'invalid_request', message };
}

/**
 * Narrow an `unknown` to something indexable, or `undefined` when it is not a plain object. An
 * array is rejected as well as a primitive and `null`: `JSON.parse('[]')` is an object by `typeof`
 * and has none of the fields below, so letting it through would only move the failure to a less
 * honest message.
 */
function asFields(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * True only for a string that names a real instant AND carries its own explicit offset.
 *
 * `Date.parse` alone is not enough here: it also accepts an offsetless string like
 * '2026-11-07T10:00' - exactly what a `<input type="datetime-local">` produces - and resolves it
 * against the *host* machine's own timezone, which disagrees between Node and Apps Script. This
 * value is echoed into the sheet verbatim and pinned to plain text (never recovered through
 * `toSlotIso`), so accepting a shape `RECOVERABLE_ISO` would itself refuse would write a row that
 * can never be read back correctly - not by this request's own retry (parseBookingRow throws on
 * it, which the scan below treats as "skip this row", hiding it from both the replay check and the
 * overlap check), not by another customer's overlap check, and not by the read path either.
 */
function isParseableInstant(value: unknown): value is string {
  return (
    typeof value === 'string' && RECOVERABLE_ISO.test(value) && !Number.isNaN(Date.parse(value))
  );
}

/**
 * Structural validation of a POST body, with no port touched and nothing external consulted.
 *
 * This runs before anything else in `bookSlot` for one blunt reason: step 3 of that function spends
 * a rate-limited call on the identity provider, and garbage input must never be allowed to spend
 * it. Every failure returns `invalid_request` and names the field that failed, so a client bug is
 * debuggable from the response alone rather than from a log nobody can read.
 *
 * `customer_name` is checked by trimming a copy and never by trimming the value: a name the
 * customer typed with a leading space is still their name, and the sheet records what they typed.
 * The trim exists only to stop '   ' from counting as a name.
 */
export function validateBookRequest(candidate: unknown): BookRequest | ErrorResponse {
  const fields = asFields(candidate);
  if (!fields) {
    return invalidRequest('The request body is not an object');
  }
  if (fields.action !== 'book') {
    return invalidRequest("Field 'action' must be the literal 'book'");
  }
  const bookingId = fields.booking_id;
  if (typeof bookingId !== 'string' || !UUID_PATTERN.test(bookingId)) {
    return invalidRequest("Field 'booking_id' must be a UUID in canonical 8-4-4-4-12 hex form");
  }
  const accessToken = fields.access_token;
  if (!isNonEmptyString(accessToken)) {
    return invalidRequest("Field 'access_token' must be a non-empty string");
  }
  const slotStart = fields.slot_start;
  if (!isParseableInstant(slotStart)) {
    return invalidRequest("Field 'slot_start' must be an ISO-8601 datetime");
  }
  const slotEnd = fields.slot_end;
  if (!isParseableInstant(slotEnd)) {
    return invalidRequest("Field 'slot_end' must be an ISO-8601 datetime");
  }
  if (Date.parse(slotEnd) <= Date.parse(slotStart)) {
    return invalidRequest("Field 'slot_end' must be strictly after 'slot_start'");
  }
  const serviceId = fields.service_id;
  if (!isNonEmptyString(serviceId)) {
    return invalidRequest("Field 'service_id' must be a non-empty string");
  }
  const customerName = fields.customer_name;
  if (typeof customerName !== 'string' || customerName.trim().length === 0) {
    return invalidRequest("Field 'customer_name' must be a non-blank string");
  }
  const notes = fields.notes;
  if (notes !== undefined && typeof notes !== 'string') {
    return invalidRequest("Field 'notes' must be a string when present");
  }
  return {
    action: 'book',
    booking_id: bookingId,
    access_token: accessToken,
    slot_start: slotStart,
    slot_end: slotEnd,
    service_id: serviceId,
    customer_name: customerName,
    ...(notes === undefined ? {} : { notes }),
  };
}

/**
 * The receipt for a write that landed. `status` is the literal 'requested' and the slot echoes the
 * *request's* own strings, on a fresh write and on a replay alike: this is a receipt for the write,
 * never a live read of the row, so a row the owner has since confirmed or cancelled by hand still
 * replays as 'requested'. See the contract's replay-rule comment for why that is deliberate.
 */
function requestedResponse(request: BookRequest): BookSuccessResponse {
  return {
    ok: true,
    booking_id: request.booking_id,
    status: 'requested',
    slot_start: request.slot_start,
    slot_end: request.slot_end,
  };
}

/**
 * Whether an existing row is the same booking this request is asking for - the full-match half of
 * the replay rule.
 *
 * The slots are compared by instant rather than by string, because the row's strings have been
 * through the sheet and back: a cell Sheets auto-parsed into a `Date` comes out of
 * `parseBookingRow` re-rendered in the salon's offset, so '2026-11-07T09:00:00Z' on the way in and
 * '2026-11-07T10:00:00+01:00' on the way out are the same moment and must count as a match.
 * String equality there would turn a customer's legitimate retry into `invalid_request`.
 *
 * Everything else is exact, and `notes` treats a missing field and an empty string as equal, which
 * is the only normalisation the rule allows. `access_token` is deliberately not compared at all:
 * it is a credential, not booking data, and may legitimately have been refreshed between attempts.
 */
function isSameBooking(request: BookRequest, verifiedEmail: string, row: BookingRow): boolean {
  return (
    row.customer_email === verifiedEmail &&
    Date.parse(row.slot_start) === Date.parse(request.slot_start) &&
    Date.parse(row.slot_end) === Date.parse(request.slot_end) &&
    row.service_id === request.service_id &&
    row.customer_name === request.customer_name &&
    row.notes === (request.notes ?? '')
  );
}

/**
 * The booking write path: validate, reject the past, verify identity, lock, check, append once.
 *
 * The ORDER of those steps is the whole function, and each boundary in it is load-bearing:
 *
 * - Validation precedes every port, so a malformed body costs no identity-provider call out of a
 *   rate-limited quota and no sheet read.
 * - The past-slot check precedes verification for the same reason: a slot that has already
 *   happened is refused on arithmetic the backend already holds, with nothing spent on it.
 * - Verification precedes the lock, so a request that was never going to be written does not hold
 *   the salon's single mutex while an HTTP call to Auth0 completes.
 * - The lock precedes the read, which is the only thing that makes "check, then append" atomic. A
 *   snapshot taken outside the lock could be stale by the time the append lands, which is exactly
 *   the double-booking this function exists to prevent.
 * - A lock we failed to acquire is reported as `internal_error`, never `slot_taken`. There is
 *   deliberately no error code for contention: telling a customer their slot is gone when all that
 *   happened is that another request held a mutex for a moment would be a lie about the sheet.
 * - The snapshot is read exactly once and scanned exactly once, and the scan finishes before any
 *   decision is taken on an overlap OR on a `booking_id` match - see the loop below for why that
 *   matters for both, not only for the overlap.
 * - A `ZoneOffsetError` from the scan is left to propagate rather than being treated as one more
 *   unparseable row. It means the zone itself is misconfigured, which fails every `Date`-typed row
 *   in the snapshot the same way - swallowing it would leave `hasOverlap` false by construction and
 *   let the append land on a slot that is genuinely taken, a real double-booking rather than a
 *   merely stale read. `main.ts` turns the propagated throw into `internal_error`, the same as any
 *   other unexpected failure; the lock is still released, because that happens in `finally`.
 */
export function bookSlot(candidate: unknown, ports: BookSlotPorts): BookResult {
  const validated = validateBookRequest(candidate);
  if ('ok' in validated) {
    return validated;
  }
  const request = validated;

  if (isInPast(request.slot_start, ports.clock.now())) {
    return {
      ok: false,
      error: 'slot_in_past',
      message: `The slot starting ${request.slot_start} is already in the past`,
    };
  }

  const verified = ports.tokenVerifier.verify(request.access_token);
  if (!verified.ok) {
    // The verifier's own distinction is passed straight through: 'rate_limited' is the identity
    // provider declining to answer, not a verdict on the token, and the client retries it.
    return {
      ok: false,
      error: verified.error,
      message:
        verified.error === 'rate_limited'
          ? 'The identity provider is rate-limiting this backend; retry shortly'
          : 'The access token could not be verified',
    };
  }

  if (!ports.lock.tryAcquire(LOCK_TIMEOUT_MS)) {
    // Nothing was acquired, so nothing is released: calling release() here would hand back a lock
    // this request never held, which on a real LockService is someone else's lock.
    return {
      ok: false,
      error: 'internal_error',
      message: 'The booking sheet is busy with another request; please try again',
    };
  }

  try {
    // Exactly one read, under the lock, held in a local: every check below reasons about the same
    // snapshot, so no two of them can disagree about what the sheet contained.
    const snapshot = ports.repo.loadBookingsSnapshot();

    // Every verdict the scan can reach is deferred until the scan finishes, and all three are
    // decided together afterwards in a fixed priority order - replay, then id collision, then
    // overlap. The snapshot can hold more than one row carrying this request's own `booking_id`
    // (an owner's copy-pasted row, a row written before some earlier bug is fixed), or an
    // unrelated overlapping row sitting before this request's own prior row - sheet order is
    // whatever the owner's sorting left behind, never something this function may rely on. A full
    // match found *anywhere* must win over an id-collision found *anywhere else*, which is only
    // true if the scan never returns early on the first id match it meets; the same reasoning the
    // overlap flag already needed applies here too, not only to it.
    let replayMatch: BookingRow | undefined;
    let hasIdCollision = false;
    let hasOverlap = false;

    for (const raw of snapshot) {
      let row: BookingRow;
      try {
        row = parseBookingRow(raw, ports.zone);
      } catch (error) {
        if (error instanceof ZoneOffsetError) {
          // Not a bad cell: the zone itself is misconfigured, which makes every Date-typed row in
          // the snapshot fail the same way. Swallowing it here is worse than on the read path -
          // every row would be skipped, hasOverlap would stay false, and the append below would
          // land on top of a slot that is actually taken. A real double-booking, not a stale read.
          throw error;
        }
        // One unparseable row elsewhere in the tab must not fail a customer's booking. The cost is
        // that such a row cannot block the slot; the row the customer is actually retrying is
        // theirs and parses, and a genuinely conflicting unparseable row is a data problem the
        // owner can see in the sheet.
        continue;
      }

      if (row.booking_id === request.booking_id) {
        // This id is already the sheet's de-facto key for a row, so the only two possible answers
        // for THIS row are "it is this booking" (replay) or "it is a different booking" (the id is
        // being reused, never allowed) - but neither answer is returned yet, because a different
        // row later in the same snapshot could still be the real replay match. A row carrying this
        // id is never also a candidate for the overlap check below: it is either the booking
        // itself or an anomaly, not an independent conflicting booking.
        if (isSameBooking(request, verified.email, row)) {
          replayMatch = row;
        } else {
          hasIdCollision = true;
        }
        continue;
      }

      if (row.status === 'cancelled') {
        // A cancelled row never blocks a new booking - the chair is free again. The comparison is
        // exact here, unlike the read path's lenient one: a status the owner typed oddly leaves the
        // row blocking, which costs a customer a retry rather than double-booking the chair.
        continue;
      }

      if (
        rangesOverlap(
          { start: row.slot_start, end: row.slot_end },
          { start: request.slot_start, end: request.slot_end }
        )
      ) {
        hasOverlap = true;
      }
    }

    // Replay outranks everything: a request that already has a row is never told its own booking
    // is unavailable, regardless of what else the same snapshot happens to contain.
    if (replayMatch) {
      return requestedResponse(request);
    }
    if (hasIdCollision) {
      return invalidRequest(
        `Field 'booking_id' is already recorded against a different booking: ${request.booking_id}`
      );
    }
    if (hasOverlap) {
      return {
        ok: false,
        error: 'slot_taken',
        message: `The slot from ${request.slot_start} to ${request.slot_end} is already booked`,
      };
    }

    const row: BookingRow = {
      booking_id: request.booking_id,
      // The only value this function mints. It goes through `toSlotIso` so the cell reads in the
      // salon's own offset, the same as every other datetime column, rather than in UTC.
      created_at: toSlotIso(new Date(ports.clock.now()), ports.zone),
      // The slot is echoed verbatim, never reformatted: the customer's request is what the sheet
      // records, and the replay comparison above is by instant anyway.
      slot_start: request.slot_start,
      slot_end: request.slot_end,
      service_id: request.service_id,
      stylist: ports.stylist,
      customer_name: request.customer_name,
      // From the verified token, never from the body - there is no email field in the body to take.
      customer_email: verified.email,
      status: 'requested',
      notes: request.notes ?? '',
    };
    ports.repo.append(row);
    return requestedResponse(request);
  } finally {
    // Every exit from the block above releases the lock: the success, each early return, and a
    // throw out of the sheet read or the append. A lock left held outsurvives this request and
    // blocks the salon until Apps Script times it out.
    ports.lock.release();
  }
}

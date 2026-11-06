import { describe, expect, it, vi } from 'vitest';
import {
  BOOKINGS_COLUMNS,
  type BookRequest,
  type BookResult,
  type BookingErrorCode,
  type BookingRow,
  type ErrorResponse,
} from '@contract/contract';
import { bookSlot, validateBookRequest, type BookSlotPorts, type VerifyResult } from './booking';
import { ZoneOffsetError, type Zone } from './bookings-repo';

/** A zone pinned to one offset, so a test says which offset it is asserting against. */
function fixedZone(offset: string): Zone {
  return { offsetFor: () => offset };
}

const VERIFIED_EMAIL = 'marko@example.com';
const BOOKING_A = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const BOOKING_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const NOW = '2026-11-06T09:00:00+01:00';
const SLOT_START = '2026-11-07T10:00:00+01:00';
const SLOT_END = '2026-11-07T10:45:00+01:00';

/** The receipt a successful or replayed booking of the default slot must return. */
const SUCCESS = {
  ok: true,
  booking_id: BOOKING_A,
  status: 'requested',
  slot_start: SLOT_START,
  slot_end: SLOT_END,
} as const;

/** A well-formed body, with the fields a test cares about overridable one at a time. */
function bookRequest(overrides: Partial<BookRequest> = {}): BookRequest {
  return {
    action: 'book',
    booking_id: BOOKING_A,
    access_token: 'token-abc',
    slot_start: SLOT_START,
    slot_end: SLOT_END,
    service_id: 'colour',
    customer_name: 'Marko Horvat',
    notes: 'first visit',
    ...overrides,
  };
}

/**
 * The same body with one field deleted outright rather than set to undefined - the only way to
 * test a field that is genuinely absent from the JSON, which is what a real client sends when it
 * has no notes to pass.
 */
function bookRequestWithout(field: keyof BookRequest): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...bookRequest() };
  delete fields[field];
  return fields;
}

/**
 * A typed `BookingRow` flattened back into the raw cell array `loadBookingsSnapshot` hands out.
 * Column order comes from the contract, not a local copy, so this agrees with `parseBookingRow`
 * by construction - which is what lets a test feed a row the previous call actually appended back
 * in as the next call's snapshot, the way the real sheet does.
 */
function rawRow(row: BookingRow): unknown[] {
  return BOOKINGS_COLUMNS.map((column) => row[column]);
}

/** A stored row for `request`, as the sheet would hold it, with single cells overridable. */
function storedRow(request: BookRequest, overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    booking_id: request.booking_id,
    created_at: NOW,
    slot_start: request.slot_start,
    slot_end: request.slot_end,
    service_id: request.service_id,
    stylist: 'Ana',
    customer_name: request.customer_name,
    customer_email: VERIFIED_EMAIL,
    status: 'requested',
    notes: request.notes ?? '',
    ...overrides,
  };
}

/**
 * Narrow to the error branch and assert the code, that the message is not empty, and - where a
 * specific field is at fault - that the message names it, so a client bug is debuggable from the
 * response alone. Written as a guard-and-assert rather than a `toEqual` against a matcher because
 * the matchers are typed `any`, which this codebase does not allow anywhere.
 */
function expectError(result: BookResult, error: BookingErrorCode, field?: string): void {
  if (result.ok) {
    throw new Error(`expected an error response, got ok with booking ${result.booking_id}`);
  }
  expect(result.error).toBe(error);
  expect(result.message.length).toBeGreaterThan(0);
  if (field !== undefined) {
    expect(result.message).toContain(field);
  }
}

/** The same, for `validateBookRequest`, whose success branch is a `BookRequest` with no `ok`. */
function expectInvalid(result: BookRequest | ErrorResponse, field: string): void {
  if (!('ok' in result)) {
    throw new Error('expected an error response, got a valid request');
  }
  expect(result.error).toBe('invalid_request');
  expect(result.message).toContain(field);
}

/**
 * Every port as a spy, plus the mutable snapshot array they read from. The spies are returned
 * alongside the ports rather than reached through `ports.repo.append`, which ESLint's
 * `unbound-method` rule (rightly) distrusts as a general pattern.
 *
 * `snapshot` is handed out by reference so a test can push the row a first `bookSlot` call
 * appended and then call again against the same spies - which is how the replay and the race are
 * driven, with the append count accumulating across both calls exactly as it would in the sheet.
 */
function harness(
  options: {
    now?: string;
    verify?: VerifyResult;
    acquires?: boolean;
    snapshot?: unknown[][];
    zone?: Zone;
  } = {}
) {
  const snapshot: unknown[][] = options.snapshot ?? [];
  const loadBookingsSnapshot = vi.fn((): unknown[][] => snapshot);
  const appended: BookingRow[] = [];
  const append = vi.fn((row: BookingRow): void => {
    appended.push(row);
  });
  const now = vi.fn((): string => options.now ?? NOW);
  const verify = vi.fn(
    (_accessToken: string): VerifyResult => options.verify ?? { ok: true, email: VERIFIED_EMAIL }
  );
  const tryAcquire = vi.fn((_timeoutMs: number): boolean => options.acquires ?? true);
  const release = vi.fn((): void => undefined);
  const ports: BookSlotPorts = {
    clock: { now },
    tokenVerifier: { verify },
    lock: { tryAcquire, release },
    repo: { loadBookingsSnapshot, append },
    zone: options.zone ?? fixedZone('+01:00'),
    stylist: 'Ana',
  };
  return {
    ports,
    snapshot,
    appended,
    loadBookingsSnapshot,
    append,
    now,
    verify,
    tryAcquire,
    release,
  };
}

describe('validateBookRequest', () => {
  it('accepts a well-formed request and echoes its fields', () => {
    const request = bookRequest();
    expect(validateBookRequest(request)).toEqual(request);
  });

  it('rejects a primitive body', () => {
    expectInvalid(validateBookRequest('book'), 'object');
    expectInvalid(validateBookRequest(42), 'object');
  });

  it('rejects null and an array, which are objects by typeof but carry no fields', () => {
    expectInvalid(validateBookRequest(null), 'object');
    expectInvalid(validateBookRequest([]), 'object');
  });

  it('rejects a body whose action is not book', () => {
    expectInvalid(validateBookRequest({ ...bookRequest(), action: 'availability' }), 'action');
    expectInvalid(validateBookRequest(bookRequestWithout('action')), 'action');
  });

  it('rejects a booking_id that is UUID-ish but the wrong shape', () => {
    const malformed = [
      'not-a-uuid',
      '3f2504e04f8911d39a0c0305e82c3301',
      '3f2504e0-4f89-11d3-9a0c-0305e82c330',
      '3f2504e0-4f89-11d3-9a0c-0305e82c3301-9',
      'zf2504e0-4f89-11d3-9a0c-0305e82c3301',
      '',
    ];
    for (const bookingId of malformed) {
      expectInvalid(validateBookRequest({ ...bookRequest(), booking_id: bookingId }), 'booking_id');
    }
  });

  it('rejects a missing or non-string booking_id', () => {
    expectInvalid(validateBookRequest(bookRequestWithout('booking_id')), 'booking_id');
    expectInvalid(validateBookRequest({ ...bookRequest(), booking_id: 42 }), 'booking_id');
  });

  // Well-formedness is case-insensitive, so a client that uppercases its own UUID is still valid -
  // the replay lookup itself stays an exact, case-sensitive match.
  it('accepts an uppercase booking_id', () => {
    const result = validateBookRequest({ ...bookRequest(), booking_id: BOOKING_A.toUpperCase() });
    expect('ok' in result).toBe(false);
  });

  it('rejects an empty or non-string access_token', () => {
    expectInvalid(validateBookRequest({ ...bookRequest(), access_token: '' }), 'access_token');
    expectInvalid(validateBookRequest(bookRequestWithout('access_token')), 'access_token');
  });

  it('rejects an unparseable slot_start or slot_end', () => {
    expectInvalid(
      validateBookRequest({ ...bookRequest(), slot_start: 'tomorrow at ten' }),
      'slot_start'
    );
    expectInvalid(validateBookRequest({ ...bookRequest(), slot_end: '' }), 'slot_end');
    expectInvalid(validateBookRequest(bookRequestWithout('slot_end')), 'slot_end');
  });

  it('rejects a slot_end that is not strictly after slot_start', () => {
    expectInvalid(validateBookRequest({ ...bookRequest(), slot_end: SLOT_START }), 'slot_end');
    expectInvalid(
      validateBookRequest({ ...bookRequest(), slot_start: SLOT_END, slot_end: SLOT_START }),
      'slot_end'
    );
  });

  it('rejects an empty service_id', () => {
    expectInvalid(validateBookRequest({ ...bookRequest(), service_id: '' }), 'service_id');
  });

  it('rejects a customer_name that is only whitespace', () => {
    expectInvalid(validateBookRequest({ ...bookRequest(), customer_name: '   ' }), 'customer_name');
    expectInvalid(validateBookRequest({ ...bookRequest(), customer_name: '' }), 'customer_name');
  });

  // The trim is a validity check on a copy, never a transformation: the sheet records the name as
  // the customer typed it.
  it('keeps a customer_name untrimmed once it passes the blankness check', () => {
    const result = validateBookRequest({ ...bookRequest(), customer_name: '  Marko Horvat  ' });
    if ('ok' in result) {
      throw new Error('expected a valid request');
    }
    expect(result.customer_name).toBe('  Marko Horvat  ');
  });

  it('accepts an absent notes field and an empty one', () => {
    expect('ok' in validateBookRequest(bookRequestWithout('notes'))).toBe(false);
    expect('ok' in validateBookRequest({ ...bookRequest(), notes: '' })).toBe(false);
  });

  it('rejects a non-string notes field', () => {
    expectInvalid(validateBookRequest({ ...bookRequest(), notes: 42 }), 'notes');
  });
});

describe('bookSlot', () => {
  it('writes exactly one requested row for a well-formed request against an empty snapshot', () => {
    const { ports, append } = harness();

    expect(bookSlot(bookRequest(), ports)).toEqual(SUCCESS);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0][0]).toEqual({
      booking_id: BOOKING_A,
      created_at: NOW,
      slot_start: SLOT_START,
      slot_end: SLOT_END,
      service_id: 'colour',
      stylist: 'Ana',
      customer_name: 'Marko Horvat',
      customer_email: VERIFIED_EMAIL,
      status: 'requested',
      notes: 'first visit',
    });
  });

  // Two customers clicking the same slot, serialised by the lock the way the real runtime would:
  // the second request reads a snapshot that already contains the first one's row.
  it('refuses the second of two different customers racing for the same slot', () => {
    const { ports, snapshot, appended, append } = harness();

    expect(bookSlot(bookRequest({ booking_id: BOOKING_A }), ports)).toEqual(SUCCESS);
    expect(append).toHaveBeenCalledTimes(1);

    // The row the first call actually appended, fed back as the sheet now holds it.
    snapshot.push(rawRow(appended[0]));

    const second = bookSlot(
      bookRequest({ booking_id: BOOKING_B, customer_name: 'Ivana Novak' }),
      ports
    );
    expectError(second, 'slot_taken');
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('replays the original success response and writes nothing on an identical retry', () => {
    const { ports, snapshot, appended, append } = harness();
    const request = bookRequest();

    const first = bookSlot(request, ports);
    expect(append).toHaveBeenCalledTimes(1);
    snapshot.push(rawRow(appended[0]));

    const second = bookSlot(request, ports);
    expect(second).toEqual(first);
    expect(second).toEqual(SUCCESS);
    expect(append).toHaveBeenCalledTimes(1);
  });

  // The replay comparison is by instant, not by string: a cell Sheets auto-parsed comes back
  // re-rendered in the salon's offset, so the stored string rarely matches the request byte for
  // byte even when it names the same moment.
  it('replays when the stored slot names the same instant in a different notation', () => {
    const request = bookRequest({
      slot_start: '2026-11-07T09:00:00Z',
      slot_end: '2026-11-07T09:45:00Z',
    });
    const stored = storedRow(request, { slot_start: SLOT_START, slot_end: SLOT_END });
    const { ports, append } = harness({ snapshot: [rawRow(stored)] });

    expect(bookSlot(request, ports)).toEqual({
      ok: true,
      booking_id: BOOKING_A,
      status: 'requested',
      // The response echoes the request's own strings, never the sheet's.
      slot_start: '2026-11-07T09:00:00Z',
      slot_end: '2026-11-07T09:45:00Z',
    });
    expect(append).not.toHaveBeenCalled();
  });

  // The receipt is for the write that happened, not a live read of the row: a row the owner has
  // since confirmed by hand still replays as 'requested'.
  it('replays with status requested even when the stored row has since been confirmed', () => {
    const request = bookRequest();
    const { ports, append } = harness({
      snapshot: [rawRow(storedRow(request, { status: 'confirmed' }))],
    });

    expect(bookSlot(request, ports)).toEqual(SUCCESS);
    expect(append).not.toHaveBeenCalled();
  });

  it('refuses a reused booking_id that names a different slot, and writes nothing', () => {
    const { ports, snapshot, appended, append } = harness();
    const request = bookRequest();

    bookSlot(request, ports);
    expect(append).toHaveBeenCalledTimes(1);
    snapshot.push(rawRow(appended[0]));

    const second = bookSlot(
      {
        ...request,
        slot_start: '2026-11-07T14:00:00+01:00',
        slot_end: '2026-11-07T14:45:00+01:00',
      },
      ports
    );
    expectError(second, 'invalid_request', 'booking_id');
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('refuses a malformed booking_id without touching a single port', () => {
    const { ports, loadBookingsSnapshot, append, now, verify, tryAcquire, release } = harness();

    expectError(
      bookSlot(bookRequest({ booking_id: 'not-a-uuid' }), ports),
      'invalid_request',
      'booking_id'
    );
    expect(now).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(tryAcquire).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(loadBookingsSnapshot).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  // The identity provider is rate-limited, so a slot that has already happened must be refused on
  // arithmetic alone - before a single call is spent proving who the customer is.
  it('refuses a slot in the past before the token verifier is ever consulted', () => {
    const exploding = vi.fn((_accessToken: string): VerifyResult => {
      throw new Error('verify was called before the past-slot check');
    });
    const base = harness({ now: '2026-11-08T09:00:00+01:00' });
    const ports: BookSlotPorts = { ...base.ports, tokenVerifier: { verify: exploding } };

    const call = (): BookResult => bookSlot(bookRequest(), ports);
    expect(call).not.toThrow();
    expectError(call(), 'slot_in_past');
    expect(exploding).not.toHaveBeenCalled();
    expect(base.tryAcquire).not.toHaveBeenCalled();
    expect(base.loadBookingsSnapshot).not.toHaveBeenCalled();
    expect(base.append).not.toHaveBeenCalled();
  });

  // A slot starting exactly now is not in the past: isInPast is strict, and so is this.
  it('accepts a slot that starts exactly at the current instant', () => {
    const { ports, append } = harness({ now: SLOT_START });

    expect(bookSlot(bookRequest(), ports)).toEqual(SUCCESS);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('returns unauthenticated and writes nothing when the verifier rejects the token', () => {
    const { ports, append, tryAcquire } = harness({
      verify: { ok: false, error: 'unauthenticated' },
    });

    expectError(bookSlot(bookRequest(), ports), 'unauthenticated');
    expect(append).not.toHaveBeenCalled();
    // The lock is never even asked for on a request that was never going to be written.
    expect(tryAcquire).not.toHaveBeenCalled();
  });

  it('passes a rate-limited verifier straight through rather than calling it unauthenticated', () => {
    const { ports, append } = harness({ verify: { ok: false, error: 'rate_limited' } });

    expectError(bookSlot(bookRequest(), ports), 'rate_limited');
    expect(append).not.toHaveBeenCalled();
  });

  // Contention is not a verdict on the slot. There is deliberately no error code for a busy lock,
  // and `slot_taken` would be a lie about what the sheet holds.
  it('returns internal_error, never slot_taken, when the lock cannot be acquired', () => {
    const { ports, append, loadBookingsSnapshot, release, tryAcquire } = harness({
      acquires: false,
    });

    expectError(bookSlot(bookRequest(), ports), 'internal_error');
    expect(tryAcquire).toHaveBeenCalledTimes(1);
    expect(loadBookingsSnapshot).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    // Nothing was acquired, so nothing may be released: on a real LockService that would hand back
    // a lock belonging to whichever request actually holds it.
    expect(release).not.toHaveBeenCalled();
  });

  it('asks for the lock with the write path timeout', () => {
    const { ports, tryAcquire } = harness();

    bookSlot(bookRequest(), ports);
    expect(tryAcquire).toHaveBeenCalledWith(5000);
  });

  it('releases the lock once it has been acquired, on success and on a throw', () => {
    const { ports, release } = harness();
    bookSlot(bookRequest(), ports);
    expect(release).toHaveBeenCalledTimes(1);

    const base = harness();
    const explodingPorts: BookSlotPorts = {
      ...base.ports,
      repo: {
        loadBookingsSnapshot: base.loadBookingsSnapshot,
        append: () => {
          throw new Error('the sheet write failed');
        },
      },
    };
    expect(() => bookSlot(bookRequest(), explodingPorts)).toThrow('the sheet write failed');
    expect(base.release).toHaveBeenCalledTimes(1);
  });

  // There is no email field on BookRequest at all, so the only thing the written value can trace
  // to is the verifier's output - this pins that it does.
  it('writes the verified email from the token, never anything from the request', () => {
    const { ports, append } = harness({ verify: { ok: true, email: 'verified@example.com' } });

    bookSlot(bookRequest(), ports);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0][0].customer_email).toBe('verified@example.com');
  });

  it('reads the sheet exactly once per call that acquires the lock', () => {
    const { ports, loadBookingsSnapshot } = harness({
      snapshot: [rawRow(storedRow(bookRequest({ booking_id: BOOKING_B })))],
    });

    bookSlot(bookRequest(), ports);
    expect(loadBookingsSnapshot).toHaveBeenCalledTimes(1);
  });

  // The ordering case the deferred overlap flag exists for: an unrelated overlapping row sits
  // BEFORE this request's own prior row in the snapshot. Deciding on the overlap the moment it is
  // seen would reject a customer's retry of a booking they had already made.
  it('replays rather than returning slot_taken when an overlapping stranger precedes the replay row', () => {
    const request = bookRequest();
    const stranger = storedRow(bookRequest({ booking_id: BOOKING_B }), {
      customer_name: 'Ivana Novak',
      customer_email: 'ivana@example.com',
      notes: '',
    });
    const { ports, append } = harness({
      snapshot: [rawRow(stranger), rawRow(storedRow(request))],
    });

    expect(bookSlot(request, ports)).toEqual(SUCCESS);
    expect(append).not.toHaveBeenCalled();
  });

  it('ignores a cancelled row that overlaps the requested slot', () => {
    const cancelled = storedRow(bookRequest({ booking_id: BOOKING_B }), { status: 'cancelled' });
    const { ports, append } = harness({ snapshot: [rawRow(cancelled)] });

    expect(bookSlot(bookRequest(), ports)).toEqual(SUCCESS);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('accepts a booking that merely touches an existing one at the boundary', () => {
    const earlier = storedRow(
      bookRequest({
        booking_id: BOOKING_B,
        slot_start: '2026-11-07T09:15:00+01:00',
        slot_end: SLOT_START,
      })
    );
    const { ports, append } = harness({ snapshot: [rawRow(earlier)] });

    expect(bookSlot(bookRequest(), ports)).toEqual(SUCCESS);
    expect(append).toHaveBeenCalledTimes(1);
  });

  // One bad cell elsewhere in the tab must not fail a customer's booking, the same way it does not
  // fail the read path.
  it('skips an unparseable row rather than failing the request', () => {
    const broken = rawRow(storedRow(bookRequest({ booking_id: BOOKING_B })));
    broken[BOOKINGS_COLUMNS.indexOf('slot_start')] = 'garbage';
    const { ports, append } = harness({ snapshot: [broken] });

    expect(bookSlot(bookRequest(), ports)).toEqual(SUCCESS);
    expect(append).toHaveBeenCalledTimes(1);
  });

  // A misconfigured zone is not a bad cell: it fails every Date-typed row in the snapshot the same
  // way, so swallowing it here - unlike an ordinary unparseable row - would leave hasOverlap false
  // by construction and let the append below land on a slot that is genuinely taken. This must
  // surface as a thrown error (main.ts maps it to internal_error), never as a quiet, wrong success,
  // and the lock must still be released because that happens in `finally`.
  it('propagates a zone misconfiguration instead of treating it as an unparseable row', () => {
    const stranger = rawRow(storedRow(bookRequest({ booking_id: BOOKING_B })));
    stranger[BOOKINGS_COLUMNS.indexOf('slot_start')] = new Date('2026-11-07T09:00:00Z');
    const { ports, append, release } = harness({
      snapshot: [stranger],
      zone: { offsetFor: () => 'Z' },
    });

    expect(() => bookSlot(bookRequest(), ports)).toThrow(ZoneOffsetError);
    expect(append).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('refuses a booking_id already held by a different verified email', () => {
    const request = bookRequest();
    const stolen = storedRow(request, { customer_email: 'someone-else@example.com' });
    const { ports, append } = harness({ snapshot: [rawRow(stolen)] });

    expectError(bookSlot(request, ports), 'invalid_request', 'booking_id');
    expect(append).not.toHaveBeenCalled();
  });

  it('treats absent notes on the request and an empty notes cell as the same booking', () => {
    const stored = storedRow(bookRequest({ notes: undefined }), { notes: '' });
    const { ports, append } = harness({ snapshot: [rawRow(stored)] });

    expect(bookSlot(bookRequestWithout('notes'), ports)).toEqual(SUCCESS);
    expect(append).not.toHaveBeenCalled();
  });
});

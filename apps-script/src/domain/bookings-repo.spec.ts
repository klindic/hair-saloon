import { describe, expect, it } from 'vitest';
import { BOOKINGS_COLUMNS, type BookingRow } from '@contract/contract';
import { parseBookingRow, toSlotIso, type Zone } from './bookings-repo';

/** A zone pinned to one offset, so a test says which offset it is asserting against. */
function fixedZone(offset: string): Zone {
  return { offsetFor: () => offset };
}

/** A zone that fails the test if it is consulted at all. */
const unusedZone: Zone = {
  offsetFor: () => {
    throw new Error('the zone was consulted when it should not have been');
  },
};

describe('toSlotIso', () => {
  it('passes a string through unchanged without consulting the zone', () => {
    expect(toSlotIso('2026-11-07T10:00:00+01:00', unusedZone)).toBe('2026-11-07T10:00:00+01:00');
  });

  it('rejects an empty string rather than passing it through as a slot time', () => {
    expect(() => toSlotIso('', fixedZone('+01:00'))).toThrow(/unparseable/);
  });

  it('rejects a string Date cannot parse at all, rather than passing it through', () => {
    expect(() => toSlotIso('not a real date', fixedZone('+01:00'))).toThrow(/unparseable/);
  });

  // The host machine must get no vote on the instant. An offsetless string names a wall-clock
  // time and nothing else, and `new Date` resolves that against the host's own timezone: the same
  // cell would come back 10:00 on a CET machine and 11:00 under TZ=UTC. Rejecting it is what makes
  // "the zone - not the cell - decides the offset" true of the instant and not just of the label.
  it('rejects a datetime string with no offset rather than letting the host decide the instant', () => {
    expect(() => toSlotIso('2026-11-07T10:00:00', fixedZone('+01:00'))).toThrow(/unparseable/);
  });

  it('rejects an offsetless datetime written with a space instead of a T', () => {
    expect(() => toSlotIso('2026-11-07 10:00:00', fixedZone('+01:00'))).toThrow(/unparseable/);
  });

  it('rejects an offsetless datetime written without seconds', () => {
    expect(() => toSlotIso('2026-11-07T10:00', fixedZone('+01:00'))).toThrow(/unparseable/);
  });

  // A bare date is not a slot time, and `new Date` reads it as midnight UTC rather than refusing -
  // which used to surface as the fabricated '2026-11-07T01:00:00+01:00' on a +01:00 day.
  it('rejects a date-only string rather than inventing a time of day for it', () => {
    expect(() => toSlotIso('2026-11-07', fixedZone('+01:00'))).toThrow(/unparseable/);
  });

  // The other edge of the same check: an offset that *is* written down is recoverable whichever
  // of ISO-8601's spellings it uses, because none of them need the host to fill anything in.
  it('recovers a string whose offset is written in basic form, without the colon', () => {
    expect(toSlotIso('2026-11-07T10:00:00+0100', fixedZone('+01:00'))).toBe(
      '2026-11-07T10:00:00+01:00'
    );
  });

  it('recovers a string that carries an offset but no seconds', () => {
    expect(toSlotIso('2026-11-07T09:00Z', fixedZone('+01:00'))).toBe('2026-11-07T10:00:00+01:00');
  });

  // The shape check matters, not just typeof: a string that is *close* to the written shape -
  // a 'Z' suffix, a space instead of 'T' - must not be published verbatim. It goes through the
  // same instant-based recovery as a Date, so the zone decides the offset, not the cell.
  it('recovers a Z-suffixed string instead of publishing it verbatim', () => {
    expect(toSlotIso('2026-11-07T09:00:00Z', fixedZone('+01:00'))).toBe(
      '2026-11-07T10:00:00+01:00'
    );
  });

  it('recovers a space-separated string with its own offset, re-deriving the offset from the zone', () => {
    expect(toSlotIso('2026-11-07 10:00:00+01:00', fixedZone('+01:00'))).toBe(
      '2026-11-07T10:00:00+01:00'
    );
  });

  it('recovers a string carrying milliseconds, which the contract format has no room for', () => {
    expect(toSlotIso('2026-11-07T09:00:00.750Z', fixedZone('+01:00'))).toBe(
      '2026-11-07T10:00:00+01:00'
    );
  });

  it('rebuilds a Date as salon-local wall-clock time on a CET instant', () => {
    const value = new Date('2026-11-07T09:00:00Z');
    expect(toSlotIso(value, fixedZone('+01:00'))).toBe('2026-11-07T10:00:00+01:00');
  });

  it('rebuilds a Date as salon-local wall-clock time on a CEST instant', () => {
    const value = new Date('2026-07-15T08:30:00Z');
    expect(toSlotIso(value, fixedZone('+02:00'))).toBe('2026-07-15T10:30:00+02:00');
  });

  // The pair the ticket exists for: two instants an hour apart across the CEST->CET change on
  // 2026-10-25, which Zagreb makes at 01:00 UTC. Both are 02:30 on the salon's clock, and only
  // the offset the zone reports tells them apart. A hardcoded offset gets exactly one of these
  // two right, and silently.
  it('uses the offset the zone reports for the instant just before the October change', () => {
    const value = new Date('2026-10-25T00:30:00Z');
    expect(toSlotIso(value, fixedZone('+02:00'))).toBe('2026-10-25T02:30:00+02:00');
  });

  it('uses the offset the zone reports for the instant just after the October change', () => {
    const value = new Date('2026-10-25T01:30:00Z');
    expect(toSlotIso(value, fixedZone('+01:00'))).toBe('2026-10-25T02:30:00+01:00');
  });

  it('rolls the calendar date forward when the local offset crosses midnight', () => {
    const value = new Date('2026-11-06T23:30:00Z');
    expect(toSlotIso(value, fixedZone('+01:00'))).toBe('2026-11-07T00:30:00+01:00');
  });

  it('zero-pads month, day, hour, minute and second to two digits', () => {
    const value = new Date('2026-03-05T06:05:03Z');
    expect(toSlotIso(value, fixedZone('+01:00'))).toBe('2026-03-05T07:05:03+01:00');
  });

  it('drops milliseconds, which the contract format has no room for', () => {
    const value = new Date('2026-11-07T09:00:00.750Z');
    expect(toSlotIso(value, fixedZone('+01:00'))).toBe('2026-11-07T10:00:00+01:00');
  });

  it('subtracts for a negative offset', () => {
    const value = new Date('2026-11-07T01:00:00Z');
    expect(toSlotIso(value, fixedZone('-05:00'))).toBe('2026-11-06T20:00:00-05:00');
  });

  it('asks the zone about the instant in UTC, not about a local rendering of it', () => {
    const asked: string[] = [];
    const recordingZone: Zone = {
      offsetFor: (instant) => {
        asked.push(instant);
        return '+01:00';
      },
    };
    toSlotIso(new Date('2026-11-07T09:00:00Z'), recordingZone);
    expect(asked).toEqual(['2026-11-07T09:00:00.000Z']);
  });

  it('throws rather than emit a half-formed string when the zone answers nonsense', () => {
    expect(() => toSlotIso(new Date('2026-11-07T09:00:00Z'), fixedZone('CET'))).toThrow(
      /cannot parse/
    );
  });
});

describe('parseBookingRow', () => {
  const row = (): unknown[] => [
    'bk_001',
    new Date('2026-11-05T13:29:41Z'),
    new Date('2026-11-07T09:00:00Z'),
    new Date('2026-11-07T09:45:00Z'),
    'cut',
    'Ana',
    'Marko Horvat',
    'marko@example.com',
    'requested',
    'first visit',
  ];

  it('builds every BookingRow field from a raw row in BOOKINGS_COLUMNS order', () => {
    const expected: BookingRow = {
      booking_id: 'bk_001',
      created_at: '2026-11-05T13:29:41.000Z',
      slot_start: '2026-11-07T10:00:00+01:00',
      slot_end: '2026-11-07T10:45:00+01:00',
      service_id: 'cut',
      stylist: 'Ana',
      customer_name: 'Marko Horvat',
      customer_email: 'marko@example.com',
      status: 'requested',
      notes: 'first visit',
    };
    expect(parseBookingRow(row(), fixedZone('+01:00'))).toEqual(expected);
  });

  it('returns a key for each contract column and nothing else', () => {
    const parsed = parseBookingRow(row(), fixedZone('+01:00'));
    expect(Object.keys(parsed).sort()).toEqual([...BOOKINGS_COLUMNS].sort());
  });

  it('applies the zone offset to slot_start/slot_end and leaves the rest alone', () => {
    const parsed = parseBookingRow(row(), fixedZone('+02:00'));
    expect(parsed.slot_start).toBe('2026-11-07T11:00:00+02:00');
    expect(parsed.slot_end).toBe('2026-11-07T11:45:00+02:00');
    expect(parsed.customer_name).toBe('Marko Horvat');
    expect(parsed.notes).toBe('first visit');
  });

  // created_at is read with toISOString(), never with the zone-aware recovery slot_start/slot_end
  // get: it is written once by the app and never read back by anything, so two different zones
  // reading the exact same Date-shaped cell must produce the exact same created_at.
  it('never consults the zone for created_at, unlike slot_start and slot_end', () => {
    const viaZoneOne = parseBookingRow(row(), fixedZone('+01:00'));
    const viaZoneTwo = parseBookingRow(row(), fixedZone('+05:00'));
    expect(viaZoneOne.created_at).toBe(viaZoneTwo.created_at);
    expect(viaZoneOne.created_at).toBe('2026-11-05T13:29:41.000Z');
  });

  it('leaves datetime cells alone when Sheets handed back the strings as written', () => {
    const raw: unknown[] = [
      'bk_002',
      '2026-11-05T14:29:41+01:00',
      '2026-11-07T10:00:00+01:00',
      '2026-11-07T10:45:00+01:00',
      'colour',
      'Ana',
      'Iva Novak',
      'iva@example.com',
      'confirmed',
      '',
    ];
    const parsed = parseBookingRow(raw, unusedZone);
    expect(parsed.created_at).toBe('2026-11-05T14:29:41+01:00');
    expect(parsed.slot_start).toBe('2026-11-07T10:00:00+01:00');
    expect(parsed.slot_end).toBe('2026-11-07T10:45:00+01:00');
    expect(parsed.status).toBe('confirmed');
  });

  // The bug this fix closes: a blank or malformed created_at must never cost a row its
  // eligibility, since nothing reads created_at back from an existing row.
  it('does not throw on a blank created_at, unlike a blank slot_start or slot_end', () => {
    const raw = row();
    raw[BOOKINGS_COLUMNS.indexOf('created_at')] = '';
    expect(() => parseBookingRow(raw, fixedZone('+01:00'))).not.toThrow();
    expect(parseBookingRow(raw, fixedZone('+01:00')).created_at).toBe('');
  });

  it('stringifies a non-string, non-Date created_at rather than throwing', () => {
    const raw = row();
    raw[BOOKINGS_COLUMNS.indexOf('created_at')] = 42;
    expect(parseBookingRow(raw, fixedZone('+01:00')).created_at).toBe('42');
  });

  it('carries a status the app never writes straight through, without validating it', () => {
    const raw = row();
    raw[BOOKINGS_COLUMNS.indexOf('status')] = 'cancelled';
    expect(parseBookingRow(raw, fixedZone('+01:00')).status).toBe('cancelled');
  });

  it('stringifies a non-string cell in a non-datetime column', () => {
    const raw = row();
    raw[BOOKINGS_COLUMNS.indexOf('service_id')] = 42;
    expect(parseBookingRow(raw, fixedZone('+01:00')).service_id).toBe('42');
  });
});

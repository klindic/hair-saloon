// Contract test for the salon data that ships inside the build. It proves three things at once:
// the `@contract/*` path alias resolves, these JSON files still satisfy the frozen contract
// types, and the invariants the slot grid will depend on hold. Editing a price is safe; breaking
// the shape fails here rather than in someone's half-built booking page.
import { WEEKDAYS, type OpeningHours, type Service, type Weekday } from '@contract/contract';
import hoursJson from './hours.json';
import servicesJson from './services.json';

const services = servicesJson satisfies Service[] as Service[];
const hours = hoursJson satisfies OpeningHours as OpeningHours;

describe('shipped services', () => {
  it('is a non-empty list', () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = services.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a positive price and duration for every service', () => {
    for (const service of services) {
      expect(service.price, service.id).toBeGreaterThan(0);
      expect(service.duration_minutes, service.id).toBeGreaterThan(0);
    }
  });

  it('has durations that divide into whole minutes', () => {
    for (const service of services) {
      expect(Number.isInteger(service.duration_minutes), service.id).toBe(true);
    }
  });
});

describe('shipped opening hours', () => {
  it('covers every weekday', () => {
    for (const weekday of WEEKDAYS) {
      expect(hours[weekday], weekday).toBeDefined();
    }
  });

  it('uses HH:mm or null, and null on both sides of a closed day', () => {
    const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const weekday of WEEKDAYS) {
      const { open, close } = hours[weekday];
      expect(open === null, `${weekday} open/close must both be null or both be times`).toBe(
        close === null
      );
      if (open !== null && close !== null) {
        expect(pattern.test(open), `${weekday} open`).toBe(true);
        expect(pattern.test(close), `${weekday} close`).toBe(true);
        expect(open < close, `${weekday} opens before it closes`).toBe(true);
      }
    }
  });

  it('has at least one open weekday', () => {
    const open = WEEKDAYS.filter((weekday: Weekday) => hours[weekday].open !== null);
    expect(open.length).toBeGreaterThan(0);
  });

  it('lists closures as YYYY-MM-DD dates with a reason', () => {
    for (const closure of hours.closures) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(closure.date), closure.date).toBe(true);
      expect(closure.reason.trim().length, closure.date).toBeGreaterThan(0);
    }
  });
});

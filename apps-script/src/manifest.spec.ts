import { describe, expect, it } from 'vitest';
import manifest from './appsscript.json';
import { SALON_TIMEZONE } from '../../shared/contract';

describe('appsscript.json manifest', () => {
  it('timeZone matches SALON_TIMEZONE from the contract', () => {
    expect(manifest.timeZone).toBe(SALON_TIMEZONE);
  });
});

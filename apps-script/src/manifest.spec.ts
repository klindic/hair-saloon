/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SALON_TIMEZONE } from '../../shared/contract';

describe('appsscript.json manifest', () => {
  it('timeZone matches SALON_TIMEZONE from the contract', () => {
    const manifestPath = join(import.meta.dirname, 'appsscript.json');
    const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    expect(manifestTimeZone(manifest)).toBe(SALON_TIMEZONE);
  });
});

function manifestTimeZone(manifest: unknown): unknown {
  if (typeof manifest !== 'object' || manifest === null) {
    return undefined;
  }
  return (manifest as Record<string, unknown>).timeZone;
}

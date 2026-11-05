import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('ConfigService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves demoMode true for a blank config.json', async () => {
    stubFetch(() =>
      Promise.resolve(jsonResponse({ auth0Domain: '', auth0ClientId: '', apiBaseUrl: '' }))
    );

    const service = TestBed.inject(ConfigService);
    await service.load();

    expect(service.config().demoMode).toBe(true);
  });

  it('resolves demoMode false for a fully populated config.json', async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({
          auth0Domain: 'salon.eu.auth0.com',
          auth0ClientId: 'abc123',
          apiBaseUrl: 'https://script.google.com/macros/s/xyz/exec',
        })
      )
    );

    const service = TestBed.inject(ConfigService);
    await service.load();

    const config = service.config();
    expect(config.demoMode).toBe(false);
    expect(config.auth0Domain).toBe('salon.eu.auth0.com');
    expect(config.auth0ClientId).toBe('abc123');
    expect(config.apiBaseUrl).toBe('https://script.google.com/macros/s/xyz/exec');
  });

  it('resolves demoMode true and does not throw when fetch rejects', async () => {
    stubFetch(() => Promise.reject(new Error('network error')));

    const service = TestBed.inject(ConfigService);

    await expect(service.load()).resolves.toBeUndefined();
    expect(service.config().demoMode).toBe(true);
  });

  it('resolves demoMode true when the response is a 404', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({}, false)));

    const service = TestBed.inject(ConfigService);
    await service.load();

    expect(service.config().demoMode).toBe(true);
  });

  it('resolves demoMode true when the response body is invalid JSON', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as Response)
    );

    const service = TestBed.inject(ConfigService);
    await service.load();

    expect(service.config().demoMode).toBe(true);
  });

  it('resolves demoMode true when a value is whitespace-only', async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({
          auth0Domain: '   ',
          auth0ClientId: 'abc123',
          apiBaseUrl: 'https://script.google.com/macros/s/xyz/exec',
        })
      )
    );

    const service = TestBed.inject(ConfigService);
    await service.load();

    expect(service.config().demoMode).toBe(true);
  });
});

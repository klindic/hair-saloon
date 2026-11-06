import type { TokenVerifier, VerifyResult } from '../domain/booking';

/**
 * The `TokenVerifier` port, backed by Auth0's own `/userinfo` endpoint - the backend never
 * validates the token's signature itself, it simply asks the identity provider whose token it is.
 *
 * `domain` is the bare Auth0 tenant host (e.g. 'your-tenant.eu.auth0.com'), with no scheme and no
 * path: both are added here, so a caller cannot accidentally point this at the wrong path by
 * passing in something already assembled.
 */
export class Auth0TokenVerifier implements TokenVerifier {
  constructor(private readonly domain: string) {}

  verify(accessToken: string): VerifyResult {
    // muteHttpExceptions is required, not a style choice: without it, UrlFetchApp.fetch throws on
    // any non-2xx status instead of returning a response this method can inspect, which would make
    // the 429 and non-200 branches below unreachable - the call would throw before either is ever
    // checked.
    const response = UrlFetchApp.fetch(`https://${this.domain}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();
    if (status === 429) {
      // The identity provider declining to answer right now, not a verdict on the token - see
      // VerifyResult's own doc comment for why this must not collapse into 'unauthenticated'.
      return { ok: false, error: 'rate_limited' };
    }
    if (status !== 200) {
      return { ok: false, error: 'unauthenticated' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.getContentText());
    } catch {
      // Auth0 is expected to return JSON on a 200, but a malformed body must not throw an
      // uncaught exception out of this method - it is just another shape of "cannot verify".
      return { ok: false, error: 'unauthenticated' };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: 'unauthenticated' };
    }
    const email = (parsed as Record<string, unknown>).email;
    if (typeof email !== 'string') {
      return { ok: false, error: 'unauthenticated' };
    }

    return { ok: true, email };
  }
}

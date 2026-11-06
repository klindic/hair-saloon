/**
 * Entry point for the Apps Script web app. Bundled by build.mjs into
 * apps-script/dist/Code.js, where doGet and doPost become globals that
 * the Apps Script runtime dispatches HTTP requests to directly.
 *
 * This file is wiring only: it builds the real adapters, reads the request,
 * and hands off to `domain/`. Anything that could be wrong about a row, a
 * date, an offset or the booking rules is decided there, not here, so it can
 * be tested in plain Node. See `apps-script/src/domain/availability.ts` and
 * `apps-script/src/domain/booking.ts`.
 *
 * Two findings that shaped the write path's contract:
 *
 * 1. Apps Script web apps never answer a CORS preflight request, so the
 *    browser's POST has to stay a "simple request": no custom headers,
 *    Content-Type text/plain;charset=utf-8, body a JSON string. That
 *    rules out an Authorization header, so the Auth0 token travels inside
 *    the JSON body instead (`access_token` in `BookRequest`).
 *
 * 2. Apps Script has no RSA-verify primitive, so the token in that body
 *    cannot be verified locally. It is checked by calling Auth0's
 *    /userinfo endpoint over UrlFetchApp and reading the email back from
 *    Auth0's response - never trusting an email supplied in the request
 *    body, which has no such field at all.
 *
 * `AUTH0_DOMAIN` and `STYLIST_NAME` are read from the script's own
 * Properties Service rather than hardcoded, so they can be set per
 * deployment without a code change. Neither is defined anywhere yet -
 * setting them is a deployment step the handover document needs to cover.
 */

import type { EndpointResult } from '@contract/contract';
import { Auth0TokenVerifier } from './adapters/auth0-token-verifier';
import { ScriptLock } from './adapters/script-lock';
import { SheetBookingsRepo } from './adapters/sheet-bookings-repo';
import { SystemClock } from './adapters/system-clock';
import { ScriptZone } from './adapters/zone';
import { availabilityResponse } from './domain/availability';
import { bookSlot } from './domain/booking';

function respond(result: EndpointResult): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  try {
    const date = e.parameter.date ?? '';
    return respond(availabilityResponse(date, new SheetBookingsRepo(), new ScriptZone()));
  } catch (error) {
    return respond({
      ok: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    // A malformed body is the caller's mistake, not this backend's failure: invalid_request, not
    // internal_error, and this is the one place in the write path where that distinction is made
    // before bookSlot's own validation ever runs.
    let candidate: unknown;
    try {
      if (!e.postData) {
        return respond({
          ok: false,
          error: 'invalid_request',
          message: 'The request body is missing',
        });
      }
      candidate = JSON.parse(e.postData.contents);
    } catch {
      return respond({
        ok: false,
        error: 'invalid_request',
        message: 'The request body is not valid JSON',
      });
    }

    const properties = PropertiesService.getScriptProperties();
    const auth0Domain = properties.getProperty('AUTH0_DOMAIN');
    const stylistName = properties.getProperty('STYLIST_NAME');
    if (!auth0Domain || !stylistName) {
      return respond({
        ok: false,
        error: 'internal_error',
        message: 'The backend is not configured',
      });
    }

    const ports = {
      clock: new SystemClock(),
      tokenVerifier: new Auth0TokenVerifier(auth0Domain),
      lock: new ScriptLock(),
      repo: new SheetBookingsRepo(),
      zone: new ScriptZone(),
      stylist: stylistName,
    };
    return respond(bookSlot(candidate, ports));
  } catch (error) {
    return respond({
      ok: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Exported so build.mjs can pull doGet/doPost off the bundle's global
// wrapper and re-expose them as the top-level globals Apps Script expects.
export { doGet, doPost };

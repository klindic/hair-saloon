/**
 * Entry point for the Apps Script web app. Bundled by build.mjs into
 * apps-script/dist/Code.js, where doGet and doPost become globals that
 * the Apps Script runtime dispatches HTTP requests to directly.
 *
 * This file is wiring only: it builds the real adapters, reads the request,
 * and hands off to `domain/`. Anything that could be wrong about a row, a
 * date or an offset is decided there, not here, so it can be tested in
 * plain Node. See `apps-script/src/domain/availability.ts` and
 * `apps-script/src/domain/bookings-repo.ts`.
 *
 * Two findings worth recording before the write path gets built:
 *
 * 1. Apps Script web apps never answer a CORS preflight request, so the
 *    browser's POST has to stay a "simple request": no custom headers,
 *    Content-Type text/plain;charset=utf-8, body a JSON string. That
 *    rules out an Authorization header, so the Auth0 token must travel
 *    inside the JSON body instead.
 *
 * 2. Apps Script has no RSA-verify primitive, so the token in that body
 *    cannot be verified locally. It has to be checked by calling Auth0's
 *    /userinfo endpoint over UrlFetchApp and reading the email back from
 *    Auth0's response - never trust an email supplied in the request body.
 */

import type { AvailabilityResult } from '@contract/contract';
import { SheetBookingsRepo } from './adapters/sheet-bookings-repo';
import { ScriptZone } from './adapters/zone';
import { availabilityResponse } from './domain/availability';

function notImplemented(): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(
    JSON.stringify({
      error: 'not_implemented',
      message: 'This endpoint has not been implemented yet.',
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function respond(result: AvailabilityResult): GoogleAppsScript.Content.TextOutput {
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

function doPost(_e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return notImplemented();
}

// Exported so build.mjs can pull doGet/doPost off the bundle's global
// wrapper and re-expose them as the top-level globals Apps Script expects.
export { doGet, doPost };

/**
 * Entry point for the Apps Script web app. Bundled by build.mjs into
 * apps-script/dist/Code.js, where doGet and doPost become globals that
 * the Apps Script runtime dispatches HTTP requests to directly.
 *
 * Two findings worth recording before the real handlers get built:
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

function notImplemented(): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(
    JSON.stringify({
      error: 'not_implemented',
      message: 'This endpoint has not been implemented yet.',
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doGet(_e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  return notImplemented();
}

function doPost(_e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return notImplemented();
}

// Exported so build.mjs can pull doGet/doPost off the bundle's global
// wrapper and re-expose them as the top-level globals Apps Script expects.
export { doGet, doPost };

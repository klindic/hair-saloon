# 0001 — Apps Script as backend

**Status:** accepted
**Date:** 2026-11-05

## Context

The CEO owns a Gmail account, a GitHub account and a Google Sheet, and nothing
else. There is no cloud account, no paid hosting, and no server we operate.
The CEO asked for their own sheet to be the database.

## Decision

A Google Apps Script web app, deployed from the CEO's own Google account and
running as that account, is the backend. The Google Sheet is the database.

## Consequences

- Apps Script holds a script-wide lock via `LockService`, so concurrent writes
  serialise. This is what makes "two customers, one slot, exactly one row"
  possible.
- Apps Script has no RSA-verify primitive, so the Auth0 token is verified by
  an outbound call to Auth0's `/userinfo` endpoint instead of in-process. That
  call is an extra network round trip on every write, and it makes the write
  path's correctness depend on Auth0 being reachable from Google's servers.
- Apps Script does not answer a CORS preflight, so the browser POST must stay
  a CORS-simple request with a `text/plain` body. We cannot send a JSON
  `Content-Type` header on that request without triggering a preflight Apps
  Script cannot answer.
- A web app round trip costs on the order of seconds rather than milliseconds.
  This is why the slot grid is computed client-side, from opening hours and
  service durations shipped with the build, rather than fetched.
- The free consumer-account quotas are 100 email recipients per day and 20,000
  `UrlFetch` calls per day. That is adequate for one salon and is not a growth
  path: a second location or a busy day of confirmation emails would need a
  paid Google Workspace account or a different backend.
- Deployment cannot be automated. `clasp` authenticates as a Google user, and
  nobody at this company can sign into the CEO's account. Every deploy is a
  manual step the CEO or someone sitting at the CEO's logged-in browser must
  perform.

## Alternatives rejected

- A hosted backend (Cloud Run, a VPS, a PaaS): needs money and an account the
  CEO does not have.
- The Sheets REST API called directly from the browser: would ship a
  credential that can read and write the owner's sheet to every visitor.
- A serverless function on a free tier (Cloudflare Workers, Vercel, etc.):
  another account, another thing to hand over, and another set of credentials
  the CEO would have to manage alone.

## Trigger to revisit

If the `LockService` lock or the Auth0 token verification turns out not to
work under real traffic, the second backend engineer returns and the data
layer is re-planned.

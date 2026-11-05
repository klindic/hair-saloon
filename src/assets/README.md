# Runtime config and demo fixtures

This directory holds the files the app fetches over the network at runtime, not the salon data
compiled into the bundle — for that, see `src/data/README.md`.

- `config.json` — fetched at startup. The CEO fills this in with their Auth0 domain, Auth0 SPA
  client id and Apps Script `/exec` URL. A blank `config.json` (the three keys present with
  empty-string values) is what ships by default, and it is what makes the deployed site run in
  demo mode.
- `config.example.json` — the shape `config.json` is expected to have, for reference.
- `fixtures/busy.json` — fetched in demo mode only. It stands in for the availability endpoint's
  response, so the demo site has something to show as an overlay on the slot grid without ever
  calling the real backend.

We use a runtime JSON file fetched at startup rather than a `.env` or compiled-in environment
because one build artefact must serve both the demo deployment and the CEO's configured
deployment — the only difference between them is the contents of `config.json`, not the code.

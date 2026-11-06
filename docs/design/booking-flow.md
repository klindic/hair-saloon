# Booking flow — every state, and the exact copy

This is the specification of the booking flow: every screen, every state each screen can be in,
and the word-for-word copy of all of it. T-07 (the stylesheet), T-08 (the submission flow), T-09
(the slot grid) and T-14 build against this document, not against the ticket it came from, so a
state that is not here is a state somebody will invent, and a sentence that is not here is a
sentence somebody will write at 2am in a template string.

The customer this is designed for is on a phone at 11pm, wants a haircut on Saturday morning, and
does not want to phone the salon tomorrow to find out whether that is possible. Every decision
below that looks fussy is in service of that one person: no spinner where Saturday should be, no
dead end, and no screen that makes them wonder whether the thing they just did worked.

## How to read this

- Values live in `docs/design/tokens.md`. This document names tokens by role and never restates a
  hex or a px. If a value you need is not in that file, that is a conversation on a ticket — not a
  literal in a component stylesheet, and not a new token invented here.
- **Fifteen strings in this document are locked.** They are reproduced in "Copy" below, and
  `node tools/check-copy.mjs` (run by `npm run verify`) fails the build the moment one of them
  stops appearing verbatim in this file. Locked means locked to the character: the em dash is `—`
  (U+2014, not a hyphen) and the ellipsis is `…` (U+2026, one character, not three periods).
- Each locked string appears twice on purpose: once in "Screens and states", where it has its
  context, and once in "Copy", where all of them are in one table. **If the two ever disagree, the
  "Copy" table is the transcription of record** and the other is the typo.
- Three strings this flow needs were never drafted in the design session, and one conflicts with a
  decision recorded on another ticket. They are in "Open" at the end, with an owner. Recording
  them as open is this document's job; drafting them is not.

## Flow

The whole path, end to end:

1. **Marketing page** — the salon, what it does, what it costs. One call to action into the
   booking flow.
2. **Day selector** — the customer picks a date. Until they pick one, no grid is drawn and no slot
   is implied; see "Before a day is picked".
3. **Slot grid** — every slot the static data says is bookable on that day paints **immediately**,
   from `src/data/hours.json` and `src/data/services.json`, which are compiled into the bundle.
   There is no spinner, no skeleton and no network wait in front of the grid.
4. **Live-availability overlay** — the busy ranges for that day arrive afterwards, up to a couple
   of seconds later, and dim the slots they cover. The overlay is additive and late by design: it
   never blocks, delays, or re-lays-out first paint. A customer whose network is slow sees a real
   grid and then sees some of it dim; they never see nothing.
5. **Tap a slot** — the slot is selected and the booking form opens.
6. **Booking form** — one field the customer fills in: their **name**. Their email comes from
   Auth0 and is **never typed and never shown as an editable field** (the backend derives it from
   the verified token and ignores anything the body claims — see `shared/contract.ts`).
7. **Submit** → **sending** → (if needed) **one automatic retry** → **confirmation**.
8. **Recovery** — any step can fail without ending the flow. The three designed failures are: a
   name that does not validate (caught before any request leaves the browser), a day with nothing
   bookable (the shared card in "Fully-unavailable day"), and a submission that has failed after
   its one retry (the `unconfirmed` state). None of them is a dead end and none of them clears
   what the customer has already typed.

**The first time, with nothing picked and nothing fetched**, the customer sees the day selector
and one headline. Not an empty grid, not fifteen grey rectangles, not a loading state.

**The one failure designed to interrupt mid-flow** is the slot being taken by somebody else
between the tap and the submit. The lock at write time is what detects it (see ARCHITECTURE.md's
performance contract), and it recovers **in place**: the same grid, one tile changed, no refetch,
no navigation, no toast.

**Demo mode** is the whole path, completed, with no call to the salon's endpoint, no Auth0 sign-in
and no row written anywhere: a submission in demo mode reaches the confirmation screen locally.
Demo mode is not a reduced flow with parts missing — it is the same flow with the network replaced.
It is on whenever `config.json` is absent, unreadable or has any of its three values blank, which
is what ships by default (`src/app/core/config/config.service.ts`).

The one network fetch demo mode does make is the shipped availability fixture
(`src/assets/fixtures/busy.json`, per `src/assets/README.md`), which stands in for the read path so
the overlay has something to dim. It is a static file in our own build, never the salon's endpoint,
and nothing a customer does in demo mode leaves the browser.

## Screens and states

### Demo-mode banner

Persistent and non-dismissible. The same single line, in the same place, regardless of scroll
position or which step of the flow the customer is on:

> This is a preview — bookings made here are not sent to the salon.

**There is no close affordance.** No close button, no "dismiss", no "got it", no auto-hide after
a few seconds. A customer who dismissed it would spend the rest of the flow believing they had
booked a haircut. Do not build one, and do not treat its absence as an oversight to fix later.

Surface `--surface-raised`, corner `--radius-md`, text `--text-primary`.

**Absent entirely in configured mode** — not hidden with CSS, not rendered empty: not in the DOM.

### Before a day is picked

Headline only. No subtext, no grid, no placeholder tiles, no "loading times…":

> Pick a day to see open times.

This is the resting state of the booking page on arrival, and it is the state a customer returns to
only by picking a different day — never by a slot grid emptying itself out.

### Slot grid, day selected

| State             | What it is                                       | Treatment                                                       |
| ----------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `default`         | Every slot the static data computes for that day | Tile, `--radius-sm`, `--border-strong` edge, tappable           |
| `dimmed` (busy)   | Covered by a busy range from the live sheet      | `--state-unavailable`, not tappable, **no copy under the tile** |
| `past`            | A slot whose start time has already gone by      | `--state-unavailable`, not tappable, microcopy **open, item 1** |
| `selected`        | The slot the customer tapped                     | `--accent` ring (use 2 of 3 in `docs/design/tokens.md`)         |
| `taken-at-submit` | Rejected as taken when the customer submitted    | `--state-unavailable` plus the microcopy below                  |

- **`default` renders with no network wait.** The grid is computed in the browser; it does not wait
  for, and is not gated on, the availability response.
- **`dimmed` lands asynchronously** — tiles that were tappable a moment ago become dimmed when the
  overlay arrives. That is the intended behaviour, not a flicker to design away. There is **no copy
  under a dimmed tile**: fifteen tiles each explaining themselves is noise, and the treatment
  already says "not this one".
- **`past` uses the same `--state-unavailable` token** as a busy slot. One visual language for all
  unavailable causes is a deliberate rule in `docs/design/tokens.md`, and this flow keeps it.
  **But the cause differs and the words should**: "nobody can book this any more" and "somebody
  just took this" are different facts. The past-slot line is **open item 1**; do not reuse the
  `taken-at-submit` line for it.
- **`taken-at-submit`** flips that one tile to `--state-unavailable` and shows, on the tile:

  > Just taken — pick another time.

  **Only that one tile changes.** No grid refetch, no re-request of availability, no reload, and
  **no toast and no banner, ever**. The customer stays where they are, with the form still filled
  in, and picks another time.

  _Flagged, not decided here:_ the tile is the only signal of this event, and a customer who has
  scrolled down to the form may not have it on screen when the rejection arrives. Keeping the
  changed tile in view is an implementation question for whoever builds the submission flow; the
  answer to it is not a toast, because a toast is ruled out above. Raise it on that ticket.

### Fully-unavailable day — `DayUnavailableCard`

A day with nothing bookable — whether the salon is **structurally closed** (no opening hours for
that weekday, or a closure date in `src/data/hours.json`) or **fully booked** by the live sheet —
replaces the slot grid with one card that offers a way forward. Never an empty grid, never a dead
end.

**This is ONE component with a `reason` variant, not three separately-built empty states.** Its
content contract, specified here and built by another ticket:

```ts
reason: 'closed' | 'fully-booked';
```

Rendered on `--surface-raised`, corner `--radius-md`, with its heading at the
`--type-display-section` type role (`docs/design/tokens.md` reuses that role for exactly this kind
of shared empty-state card) and its body at `--type-body`.

Two things it is explicitly not:

- **Not three empty states.** Closed, fully booked, and any later variant are one component with a
  reason, because three independently-built cards drift in wording, spacing and heading level
  within two sprints, and a customer who hits two of them sees two different products.
- **Not `--state-unavailable` applied across a whole grid of tiles.** That reads as fifteen
  identical grey rectangles the customer has to scan one by one to confirm there is nothing there
  — the exact opposite of an instant read. One card says it in one glance.

| `reason`         | Heading            | Body                                                |
| ---------------- | ------------------ | --------------------------------------------------- |
| `'closed'`       | Closed today       | The salon isn't open on [weekday]. Try another day. |
| `'fully-booked'` | Fully booked today | Every slot today has been taken. Try another day.   |

In the `'closed'` body, the literal string `[weekday]` is the placeholder marker; whoever builds
this substitutes the real day name there.

#### The next-open-day link

Both variants carry a link to the next open day.

- **It is computed by walking forward over the static hours and closures data only**
  (`src/data/hours.json`). It has **no knowledge of live availability**. A day it points at can
  itself turn out to be fully booked once the customer gets there, in which case they land on the
  `'fully-booked'` variant of this same card and can follow its link onward. **That is an accepted,
  documented limitation, not a bug** — and it is the price of the whole design: the grid paints
  with no round trip, so nothing on this screen can know what the sheet knows.
- **Bounded to 14 days ahead.** The walk stops there.

| Case                                   | Label                   | Example           |
| -------------------------------------- | ----------------------- | ----------------- |
| Next open day within 6 days            | `See {Weekday}`         | See Monday        |
| Beyond 6 days, within the 14-day bound | `See {Weekday} {D MMM}` | See Monday 17 Nov |
| No open day found within 14 days       | No link renders at all  | — (see below)     |

Within 6 days a weekday name is unambiguous and a date would be clutter. Beyond that it stops being
unambiguous, so the date comes back.

**When no open day is found within 14 days, no link renders at all** and the card instead shows the
one thing that always works:

> Please call the salon at {{salonPhone}} to book directly.

This is **not** the `unconfirmed` submission message reused verbatim. The two are deliberately
different sentences sharing one idea: on this card, the customer has submitted nothing, so a
sentence beginning "We couldn't confirm your request" would tell them a submission had failed when
none was ever made. Both sentences end on the identical phone-number clause, so a customer who sees
both over the course of one visit does not meet two differently-worded versions of "phone us" — see
the note on this in "Copy".

**Behaviour when the link is activated:**

- It **selects that day through the same code path as tapping a date in the day selector**. It is
  not a separate navigation, not a route change of its own, and not a second implementation of day
  selection.
- Focus **moves to the newly-rendered slot grid** once it appears — or to the next
  `DayUnavailableCard`, if that day also turns out to be unavailable.
- **Focus is never left on an element that has just been removed from the page.** The link the
  customer activated is gone the moment the card it lives in is replaced; focus has to land
  somewhere real, or a keyboard and screen-reader user is dropped back to the top of the document
  with no idea what happened.

**Styling: plain underlined `--text-primary`. Never `--accent` as its text colour or fill.** The
focus ring is still `--accent` under use 3 (the focus ring on every interactive element). It is a way
out of a dead end, not a second call to action, and giving this link the CTA's colour would oversell
what it actually promises. It promises a day the salon is _scheduled to be open_, not a free slot.

### Sign-in control, demo mode

The label is **unchanged from its configured-mode text**:

> Sign in with Google

In demo mode the control is **visibly disabled** — `--state-unavailable`, which is also what a
disabled control looks like in this system (verified at 4.85:1 light / 5.40:1 dark in
`docs/design/tokens.md`). No opacity trick.

Beneath it, a **separate sibling DOM node** carries:

> Sign-in isn't connected in this preview.

That is a genuinely separate element in the markup. **Not** a `title`, **not** an `aria-label`,
**not** an attribute of the button, **not** a tooltip, **not** revealed on hover. Browsers and
screen readers disagree about whether a disabled control's own name and description are announced
at all, and hover does not exist on the phone this flow is designed for. A sibling node is
reachable either way.

Text `--text-secondary` at `--type-body-small` — helper text under a control is body-small in this
system, not caption, because it is a sentence somebody has to read.

### Submit control

Four label states. Three strings, because one state deliberately has none of its own:

| State      | Label                                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| `default`  | Request this appointment                                                      |
| `sending`  | Sending your request…                                                         |
| `retrying` | Still sending…                                                                |
| `disabled` | Request this appointment (the `default` label, verbatim — no separate string) |

- **`retrying` deliberately does not contain the word "retry".** Naming it would tell the customer
  something has gone wrong, when nothing has: the automatic retry exists because the browser could
  not tell whether the first POST landed, and the usual outcome is a successful booking. "Still
  sending…" is the honest description of what is happening.
- **`disabled` reuses the `default` label verbatim** and has no string of its own. A disabled
  control that also changes its words reads as a different button.
- Visual treatment is fixed in `docs/design/tokens.md` ("The submit control") and is not redefined
  here.

#### `unconfirmed` — after the original attempt and its one automatic retry have both failed

The customer's entered form **stays filled in**. It is never cleared on failure, in this state or
any other. Making somebody retype their name at 11pm because our round trip failed is the one thing
this state must not do.

The message:

> We couldn't confirm your request — please call the salon at {{salonPhone}} to book directly.

- **`{{salonPhone}}` is a literal placeholder token.** The phone number is substituted from a
  runtime config value. It is **never hardcoded text in the component** and never typed into a
  template — the salon's number is the salon's to change without a code deploy.
- Surface `--state-error` with `--text-primary` text (that pairing is mandatory, not a preference —
  see Note 2 in `docs/design/tokens.md`), corner `--radius-md`. This is the **only** state in the
  product that uses `--state-error`.
- The `--state-error` icon shown alongside is **decorative** and must be marked
  `aria-hidden="true"`. **The sentence alone, in words, carries both the fact that it failed and
  the number to call.** Nothing here is communicated by the icon or by colour alone.

### Confirmation screen

What is fixed:

- It **must state that the salon will confirm the appointment.** The backend only ever writes
  `status: 'requested'`; the owner moves a row to confirmed by hand in the sheet
  (`shared/contract.ts`). A screen that implies otherwise is a promise this product does not keep.
- The word **"confirmed" must never appear on its own, anywhere on this screen.** A customer who
  reads one word out of a sentence must not come away believing their slot is locked in.
- A **replayed success** — a retry that turns out to have succeeded the first time, which the
  backend answers with the original success response and no new row — shows the **identical screen
  as a first-time success**. No "we already had this", no second confirmation, and **nothing in the
  copy that implies a second email was sent**.
- In demo mode this screen is reached with no network call, no sign-in and no row written. It looks
  the same; the demo-mode banner above it is what says it is not real.

The exact sentence is **open item 3** and is deliberately not drafted here.

### Validation

The name field is validated **before any request is sent** — an empty or malformed name never
reaches the network, in demo mode or configured mode.

- The message **must name the field** ("name"). A message that says only "invalid input" fails the
  product's acceptance criteria.
- It renders next to the field as `--text-primary` at `--type-body-small`, the helper-text role.
  **It does not use `--state-error`**, which is reserved in `docs/design/tokens.md` for the
  `unconfirmed` state alone and explicitly not for validation messages.
- Nothing the customer typed is cleared by a failed validation.

The exact wording is **open item 2** and is deliberately not drafted here.

## Tokens

Every token below is declared in `docs/design/tokens.md`. **The values themselves live in that
document**; this section names which token plays which role in this flow, and nothing here is a new
token.

| Token                    | Role in this flow                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `--state-unavailable`    | Dimmed (busy) tiles, past tiles, the `taken-at-submit` tile, the disabled sign-in control |
| `--state-error`          | The `unconfirmed` submission state, and nothing else in this flow                         |
| `--surface-raised`       | The demo-mode banner and the `DayUnavailableCard`                                         |
| `--text-primary`         | Body copy, `--state-error` text, and the next-open-day link (underlined, not accented)    |
| `--text-secondary`       | The disabled sign-in explanation; the text half of `--state-unavailable`                  |
| `--accent`               | The submit control's fill and the selected-slot ring — and the focus ring. Nothing else   |
| `--text-on-accent`       | The submit control's label, on that fill                                                  |
| `--border-strong`        | The edge of a tappable slot tile, where the edge is the only cue it is interactive        |
| `--type-display-section` | The `DayUnavailableCard` heading                                                          |
| `--type-body`            | The `DayUnavailableCard` body and screen body copy                                        |
| `--type-body-small`      | Helper text: the disabled sign-in explanation, the validation message                     |
| `--type-control-label`   | The submit control's label and the sign-in control's label                                |
| `--radius-sm`            | Slot tiles, the name input, the submit control                                            |
| `--radius-md`            | The demo-mode banner, the `DayUnavailableCard`, the `--state-error` surface               |

No token in this flow is `--accent` beyond the three uses that document already permits, and no
state here uses `opacity` to look unavailable — that would invalidate every contrast ratio recorded
there.

## Layout and responsive

**Mobile-first, and not as a slogan**: the primary user is on a phone at 11pm. The phone layout is
the design; wider screens get more columns of the same thing.

- **Slot tiles never go below the minimum tap target** fixed in `docs/design/tokens.md` ("The
  minimum tap target"), in both dimensions, including their padding — a thumb target, not a mouse
  target. Inner padding is `--space-3`; the gap between tiles is `--space-4`.
- Tiles never shrink below that minimum to fit more per row. Fewer columns is the correct answer to
  a narrow screen.
- **The submit control is full-width in its container at narrow breakpoints**, 48px high, with
  `--space-5` horizontal padding. All three are already fixed in `docs/design/tokens.md` ("The
  submit control") and are not redefined here. It is never a pill and it never shrinks to fit its
  label.
- The `DayUnavailableCard` is full-width in the grid's place at narrow widths — it replaces the
  grid, it does not sit above a leftover empty one.
- Page gutters and block separation come from the `--space-*` scale, asymmetrically, per that
  document's "Asymmetry is the point".

_Not settled, and not invented here:_ neither `docs/design/tokens.md` nor this document names a
numeric breakpoint. "Narrow" is the phone. Whoever builds the stylesheet (T-07) picks the threshold
where the tile grid gains columns and records the value in `docs/design/tokens.md`, where
breakpoints would belong — it is not recorded in this file, so that two documents cannot disagree
about it.

## Copy

Every locked string in this flow, in one place, so nobody has to hunt for one through the section
above. **Transcribe from this table, not from memory.** `node tools/check-copy.mjs` checks these
against this file on every `npm run verify`, and it fails on a hyphen where the em dash `—`
(U+2014) belongs, on three periods where the ellipsis `…` (U+2026) belongs, or on a curly
apostrophe where the straight one (U+0027, which is what every apostrophe in this document is)
belongs.

Rows 1 to 15 are the fifteen locked strings, and they are exactly the list
`tools/check-copy.mjs` guards. The sign-in button's own label is in the table too, unnumbered: it is
existing configured-mode copy this flow reuses unchanged, so it is not one of the fifteen the
checker holds — which is not permission for it to drift.

| #   | Screen / state                                         | String                                                                                       |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | Demo-mode banner                                       | This is a preview — bookings made here are not sent to the salon.                            |
| 2   | Booking page, before a day is picked                   | Pick a day to see open times.                                                                |
| 3   | Slot tile, rejected as taken at submit                 | Just taken — pick another time.                                                              |
| 4   | `DayUnavailableCard`, `reason="closed"` heading        | Closed today                                                                                 |
| 5   | `DayUnavailableCard`, `reason="closed"` body           | The salon isn't open on [weekday]. Try another day.                                          |
| 6   | `DayUnavailableCard`, `reason="fully-booked"` heading  | Fully booked today                                                                           |
| 7   | `DayUnavailableCard`, `reason="fully-booked"` body     | Every slot today has been taken. Try another day.                                            |
| 8   | Next-open-day link, within 6 days                      | See {Weekday}                                                                                |
| 9   | Next-open-day link, 7–14 days out                      | See {Weekday} {D MMM}                                                                        |
| —   | Sign-in control, label (both modes)                    | Sign in with Google                                                                          |
| 10  | Sign-in control, demo-mode sibling node                | Sign-in isn't connected in this preview.                                                     |
| 11  | Submit control, `default` and `disabled`               | Request this appointment                                                                     |
| 12  | Submit control, `sending`                              | Sending your request…                                                                        |
| 13  | Submit control, `retrying`                             | Still sending…                                                                               |
| 14  | Submission `unconfirmed`                               | We couldn't confirm your request — please call the salon at {{salonPhone}} to book directly. |
| 15  | `DayUnavailableCard`, no open day found within 14 days | Please call the salon at {{salonPhone}} to book directly.                                    |

Notes on this table, none of which change a string:

- **Rows 14 and 15 are deliberately two different sentences, not one string reused.** Row 14 says a
  submission failed, because one did. Row 15 never says that, because on that card no submission was
  ever made — see "The next-open-day link". Both end on the identical phone-number clause, which is
  the only part of the two that is meant to feel the same.
- **Four different placeholder syntaxes appear in locked copy** — `[weekday]` (row 5),
  `{Weekday}` and `{D MMM}` (rows 8 and 9), and `{{salonPhone}}` (rows 14 and 15). They are locked as
  written and **must not be normalised to one convention**: normalising them changes locked strings.
  What each means: `[weekday]` and `{Weekday}`/`{D MMM}` are substituted from the date being
  rendered; `{{salonPhone}}` is substituted from a runtime config value.
- **`{{salonPhone}}` has no home in the config shape yet.** `RuntimeConfig` in
  `src/app/core/config/app-config.ts` carries `auth0Domain`, `auth0ClientId` and `apiBaseUrl` and
  nothing else today. Whoever builds the `unconfirmed` state or the `DayUnavailableCard` needs that
  field added, and a blank or missing value needs a defined behaviour. That is a config-shape change
  on another ticket, not a copy decision, and not a reason to hardcode a number.
- **Three strings are not drafted and so are not in this table**: the past-slot microcopy, the
  name-validation message and the confirmation-screen sentence. All three are in "Open".
- `notes` is optional in `shared/contract.ts` and this document specifies **no state and no copy**
  for a notes field. If one ships, its label and placeholder are copy nobody has drafted; raise it
  rather than invent it.

## Accessibility

Restated as rules, because each one is a thing that gets quietly undone by a later "cleanup":

- **The demo-mode banner has no close affordance, by design.** Not a hidden one, not a keyboard-only
  one. Do not add it; its absence is the decision.
- **The disabled sign-in explanation is a separate DOM node**, a sibling of the button — not a
  `title`, not an `aria-label`, not an `aria-describedby` on a disabled control, not a tooltip.
  Whether a disabled control's accessible name and description are announced varies by
  browser/screen-reader pair; a sibling node does not.
- **Focus moves after the next-open-day link is activated** — to the newly-rendered slot grid, or to
  the next `DayUnavailableCard` if that day is also unavailable. **Focus is never left on an element
  that has just been removed from the page.** This is the one place in the flow where the element
  the customer interacted with is guaranteed to be destroyed by the interaction.
- **The `--state-error` icon is `aria-hidden="true"`** and carries no meaning. Its meaning is
  carried entirely by the adjacent sentence, which names both the failure and the phone number.
  Nothing in this flow is communicated by colour or by a glyph alone.
- **Stacked or hidden button-label variants carry `aria-hidden="true"`.** If the submit control is
  built by rendering all four label states and showing one (an implementation detail owned
  elsewhere), the inactive ones must be hidden from assistive technology, so a screen reader hears
  exactly one label — the active one — and never "Request this appointment Sending your request…
  Still sending…".
- A **dimmed or past tile is not focusable and is not clickable**, and its unavailability is
  conveyed by more than its colour: it is not an actionable control at all, so assistive technology
  does not offer it as one.
- Headings run in order: the page's `h1`, then section headings. The `DayUnavailableCard`'s heading
  takes the `--type-display-section` type role, which is a _type role, not a heading level_ — it
  takes whatever level its position in the document demands.
- Every contrast pairing this flow relies on is already measured and recorded in the Contrast table
  of `docs/design/tokens.md` (disabled control label and helper text, error-surface text, the CTA
  label, every focus ring). None of them is re-derived here, and none of them should be re-derived
  by eye in a component.

## Open

Four items. Each one is a string or a conflict that a real decision is still missing, with the
person accountable for closing it. **Nobody downstream drafts a replacement** — inventing copy here
fails this ticket as surely as leaving it blank would.

### 1. Past-slot tile microcopy

**Missing:** the short line shown on a slot whose time has already passed.

**Why it is open:** a past slot and a just-taken slot share the `--state-unavailable` visual token
by design, which makes it tempting to share their words too. They must not: reusing "Just taken —
pick another time." for a past slot states a fact that is simply untrue — nobody took it, it just is
not offered any more — and a customer reading it at 2pm would believe somebody had beaten them to
the 9am slot.

**Owner: Ren**

**Shape the answer needs:** one short line, calm in tone, as brief as the "Just taken" line it sits
beside. It states that the time has passed, implies no competition for the slot, and does not
instruct the customer to do anything they are already doing. It is tile microcopy, so length is a
hard constraint, not a preference.

### 2. Empty/malformed-name validation message

**Missing:** the exact wording shown when the name field is empty or malformed.

**Why it is open:** the product's acceptance criteria require the message to **name the field**, and
the design session agreed that requirement without drafting the sentence that satisfies it.

**Owner: Ren**

**Shape the answer needs:** one sentence containing the word "name", reading as a direct instruction
to the customer rather than a technical error about a field's state. Not "invalid input", not
"customer_name is required", not a validation vocabulary of its own. It renders as helper text next
to the field (see "Validation"), so it is one line, and it must work for both the empty case and the
malformed case, or the answer is two strings and needs to say so.

### 3. Confirmation-screen sentence

**Missing:** the sentence the confirmation screen leads with.

**Why it is open:** this is the hardest sentence in the product and the room knew it. It has to say
the salon will confirm the appointment, without using the word **"confirmed"** in isolation anywhere
— a customer who reads only that word must not conclude their slot is locked in, because the
backend only ever records `status: 'requested'` and a human confirms it by hand. The risk this
ticket exists to prevent is precisely this wording sliding from "requested" back to "confirmed" in a
later review.

**Owner: Ren**

**Shape the answer needs:** reassuring rather than bureaucratic — this is the last thing a customer
sees after booking at 11pm, and "your request has been logged" is not what that moment needs. It
states what has happened (the salon has their request, with the day and time), what happens next
(the salon confirms it), and it reads identically to a customer whose retry replayed an earlier
success, implying no second email. One or two sentences, not a paragraph.

### 4. Cross-ticket conflict — two customer-facing sentences for the same `slot_taken` event

**Missing:** a single decision about what a customer sees when their slot is taken at submit time.

**Why it is open:** two decisions were made in two separate meetings, by two different people, and
neither meeting produced a committed document — **both sentences below exist only as this
document's record of what was said in the room, not as a citation to a file**. Whoever reconciles
this starts from these two quotes, not from a document to go and read.

- In a backend-contract grooming session, **Priya** was recorded as owning the exact `slot_taken`
  POST-response copy: **"That time has just been taken — here are the next free slots."** That
  session did not commit the string to any file; `shared/contract.ts` defines a `message: string`
  field on the `slot_taken` response with no statement of whether it is customer-facing.
- In this flow's own design session, **Ren** (this document) committed the tile microcopy **"Just
  taken — pick another time."** for the same event, together with an explicit decision of **no
  toast and no banner** for it.

Both cannot be customer-facing for the same event: the customer would read two different sentences
describing one thing, one of which also promises a list of next free slots that the no-toast
decision gives it nowhere to appear — and which the read path's privacy shape (busy ranges only)
does not hand the browser as "next free slots" anyway.

**This needs reconciling between Ren and Priya before either document is treated as fully final.**
**The working assumption recorded here is that only the tile microcopy ships**, and that the
`slot_taken` response's `message` field is diagnostic, not customer-facing. That assumption is this
document's, not a decision Priya has agreed to.

**Owner: Ren, to reconcile with Priya.**

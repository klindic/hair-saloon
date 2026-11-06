# Design tokens

Every colour, space, radius and type size this product uses is named here, once, by role. If you
are building a screen and you need a value, take it from this file. If the value you need is not
here, that is a conversation on the ticket — not a literal you add to a component stylesheet.

The visual direction is editorial: warm paper, warm near-black ink, one clay accent used three
times in the whole product, a real display face for the salon name and section headings, and
whitespace that is generous and deliberately lopsided. It is not a component-library landing
page. Most of the rules below exist to stop it drifting into one, and each says why, because a
constraint whose reason is missing gets optimised away by the next person.

Light and dark are defined together, in the same tables, on purpose. A dark theme bolted on later
is a dark theme nobody checked.

## How to read this

- A token is `--kebab-case` in CSS and is referred to here with its `--` prefix everywhere.
- Hex values in the "Contrast" table are written as bare text, with no backticks, because
  `tools/check-contrast.mjs` parses that table and re-derives every ratio in it. Everywhere else
  hexes are in backticks.
- Every ratio in this document came out of `node tools/check-contrast.mjs '#hexA' '#hexB'`. None
  of them was computed by hand. `npm run check:contrast` re-checks the table on every
  `npm run verify`, so a value edited here without re-running the maths fails CI.
- The "Colour" table is the declared value of every colour token, and the checker treats it that
  way: each hex in the "Contrast" table must equal the value the named token carries in that table
  for that mode. A ratio that is internally consistent but names a hex the token no longer has is
  a failure, not a pass.
- Every "Pairing" cell therefore **ends with `(light)` or `(dark)`**, and that marker is parsed,
  not decoration — it is how the checker knows which of a token's two columns to compare against.
  Keep it at the end of the cell. A row without it fails.

## Naming

Tokens are named after the **role** they play, never after the first component that happens to use
them. `--surface-raised` is the name; `--banner-background` is not, even though a banner is the
first thing that will use it. `--text-secondary` is the name; `--disabled-button-text` is not,
even though the disabled sign-in control is where you will first see it. Those two negative
examples are the only place in this document those strings appear.

The reason is mechanical, not aesthetic. Four engineers are building five tickets against this
file in parallel worktrees. A component-shaped name is only correct for one component, so the
second component that needs the same value either invents a second token for the same hex or
reuses a name that now lies about its purpose. Both outcomes are how a palette becomes eleven
greys.

## How these are declared

Light values live on `:root`. Dark values are a single override block —
`@media (prefers-color-scheme: dark)` — in the same stylesheet, immediately below, so both modes
are visible in one screenful of code. There is no third place a token is redefined: no component
overrides a token for itself, and no feature ships its own palette block.

T-07 owns the stylesheet that declares these (`src/styles.scss`). This document is the source of
truth for the values; that file is the implementation of it.

## Colour

| Token              | Light     | Dark      | Role                                                           |
| ------------------ | --------- | --------- | -------------------------------------------------------------- |
| `--surface-page`   | `#F6F1EA` | `#16120F` | The page itself. Warm paper, never white.                      |
| `--surface-raised` | `#ECE4D8` | `#201A14` | Cards, banners, slot tiles. Also `--state-unavailable`'s base. |
| `--text-primary`   | `#171412` | `#F4EDE4` | Body copy, headings, anything that must be read.               |
| `--text-secondary` | `#6B6056` | `#9C8E7E` | Metadata, helper text, unavailable labels.                     |
| `--text-on-accent` | `#FDF6EF` | `#FDF6EF` | The only text allowed on an `--accent` fill.                   |
| `--border-default` | `#D8CFC2` | `#332B23` | Decorative hairline between surfaces. Never the only cue.      |
| `--border-strong`  | `#7F7367` | `#80725F` | The edge of an interactive element, when the edge is the cue.  |
| `--accent`         | `#B5472D` | `#B5472D` | Clay terracotta. Three permitted uses, listed below.           |
| `--state-error`    | `#D9CBB8` | `#2A1C16` | Background of the one failure state. See "State tokens".       |

`--state-unavailable` is deliberately not in that table: it is a composite, not a colour. See
"State tokens".

### Why these dark values

The light values were fixed in the design session. The dark ones are this ticket's work, and the
rule they follow is that dark mode is the same two pigments on different paper — not a grey theme
with the warmth drained out.

- **`--surface-page` `#16120F`** — the light mode's ink, taken deeper: still visibly brown-black
  rather than charcoal, so the page reads warm at full screen instead of neutral.
- **`--surface-raised` `#201A14`** — only 1.08:1 lighter than the page (measured). That is
  intentional and the reason is in "The dark-mode luminance ceiling" below; a card or a banner in
  dark mode is found by its content, not by a lighter slab or a visible edge — `--border-default`
  stays the same decorative seam it is in light mode (see Note 1), not a boundary anyone is meant
  to see. An element that genuinely needs a visible edge to be found — a slot tile, an input — is
  interactive, and takes `--border-strong` instead.
- **`--text-primary` `#F4EDE4`** — a shade below the light mode's paper, because paper-bright text
  on a near-black page glares; 16.04:1 on the page is still far past what AA asks.
- **`--text-secondary` `#9C8E7E`** — warm taupe, landing at 5.40:1 on a raised surface: clearly
  subordinate to `--text-primary`'s 14.83:1 while staying comfortably above 4.5. A dimmer value
  would have been prettier and would have failed AA on exactly the screens that need it most.
- **`--border-default` `#332B23`** — the same decorative role as in light mode, at the same
  kind of ratio (1.24:1 on a raised surface). It is a seam, not information, in either mode.
- **`--border-strong` `#80725F`** — picked so it clears 3:1 against both dark surfaces (3.98:1 and
  3.68:1), because in dark mode it is doing more work than in light: it is what makes a card's
  edge findable.
- **`--accent` `#B5472D`, unchanged** — see below; this is the one dark-mode decision with a real
  trade-off in it.
- **`--state-error` `#2A1C16`** — a red-shifted step off `--surface-raised` rather than a lighter
  one. In dark mode "a darker step" of the raised surface would collapse into the page, so the step
  is in hue instead of lightness, and the lightness stays under the ceiling below. The surface was
  never the signal anyway — the glyph and the sentence are.

### The accent in dark mode, and what it costs

The instinct is to brighten a terracotta for a dark page. Measured against `--text-on-accent`
(`#FDF6EF`), every brighter clay fails AA for the CTA label: `#C4553A` gives 4.16:1, `#CE5E3F`
gives 3.70:1, `#D4674A` gives 3.36:1. The label is text a customer reads on the one button that
submits their booking, so it keeps its 4.5. **`--accent` therefore holds `#B5472D` in both
modes**, which gives 5.02:1 under the label, 3.46:1 as a ring on the dark page and 3.20:1 as a
ring on a dark raised surface — all three verified, all three pass.

What it costs: the accent is the same pigment in both modes, so dark mode does not get a livelier
CTA, and the ring's margin over the 3:1 floor in dark mode is thin rather than roomy. The
alternative — brighten the accent and darken the label to near-black — buys margin everywhere
and was rejected because it makes `--text-on-accent` mean two opposite things in two modes,
which is a token that will be used wrongly within a week.

### The dark-mode luminance ceiling

Holding `--accent` at `#B5472D` puts a hard cap on how light any dark-mode surface may be: a
surface lighter than **1.30:1 against `#000000`** pushes the accent focus ring below 3:1 and the
ring stops being a compliant affordance. Every dark surface here sits under that cap —
`--surface-page` 1.13:1, `--surface-raised` 1.22:1, `--state-error` 1.28:1 (all measured against
`#000000` with the tool).

If a later ticket needs a new dark surface, check it against `#000000` first. Under 1.30:1 and the
ring still works. Over it, and you are changing the accent, which changes the CTA label, which is
a conversation and not a commit.

## The accent, and where it is allowed

`--accent` has exactly three uses in this product:

1. The fill of the primary CTA (with `--text-on-accent` as its label).
2. The selected-slot ring.
3. The focus ring on every interactive element — link, tile, button, input.

Nowhere else. Not on a secondary link, not on a heading, not as a hover tint, not as an icon
colour, not on a price. The restraint is the design: one warm red that appears three times reads
as an editorial decision, and the same red sprinkled across eight elements reads as a theme
colour picked from a palette generator.

Use 3 is the stated exception to "nowhere else" — a focus ring is a functional affordance, not
decoration, and it deliberately uses the loudest colour in the system on every focusable element
precisely because it must be impossible to miss.

## State tokens

### `--state-unavailable`

`--surface-raised` as the background, `--text-secondary` as the text. That is the whole token, and
it is reused with no variation for all three unavailable causes: a slot already taken, a slot in
the past, and a slot the owner blocked out. Three causes, one visual language — a customer does
not need three greys to understand that they cannot tap something, and a disabled control that
looks different on three screens reads as three bugs.

It is also what a disabled control looks like: the disabled sign-in control is
`--state-unavailable`, verified at 4.85:1 in light mode and 5.40:1 in dark.

No opacity trick. Dropping a tile to `opacity: 0.5` to "make it look more disabled" changes its
real contrast to something nobody measured, and all the ratios recorded here stop being true.

### `--state-error`

Background `--state-error`, text `--text-primary`, plus a distinct icon glyph. Reserved
exclusively for one state in this product: **T-08's `unconfirmed` state** — a booking submission
that has failed after an automatic retry. It is not a general error colour, it is not for
validation messages, and it is not for the `slot_taken` rejection.

Two rules that are not negotiable:

- **The text is `--text-primary`, not `--text-secondary`.** Secondary text on the light error
  surface measures 3.84:1 and fails AA. It happens to clear AA on the dark error surface (5.16:1),
  which is exactly the trap: one rule that holds in both modes beats two rules that differ by
  mode, so `--state-error` pairs with `--text-primary` everywhere.
- **The glyph is decorative and carries no meaning.** Mark it `aria-hidden="true"`. The adjacent
  sentence must state the full situation and what to do about it, in words, because a reader who
  cannot distinguish the surface from a normal card — colour-blind, low vision, a phone in
  sunlight, a forced-colours mode — has to lose nothing. Colour and glyph are reinforcement; the
  text is the message.

## Spacing

Eight steps. The bottom half is a 4px grid for things inside a component; the top steps grow by
roughly 1.6 so that separation between blocks is unmistakable rather than merely present.

| Token       | Value   | Role                                                              |
| ----------- | ------- | ----------------------------------------------------------------- |
| `--space-1` | `4px`   | Icon to label, hairline inset.                                    |
| `--space-2` | `8px`   | Tight inner padding; gap inside a small group.                    |
| `--space-3` | `12px`  | Inner padding of a slot tile.                                     |
| `--space-4` | `16px`  | Inner padding of a card; gap in a tile grid.                      |
| `--space-5` | `24px`  | Horizontal padding of the submit control; paragraph separation.   |
| `--space-6` | `40px`  | Separation between blocks inside a section.                       |
| `--space-7` | `64px`  | Separation between sections.                                      |
| `--space-8` | `104px` | Page-edge gutter and the top of the page; the big asymmetric one. |

`--space-5` is `24px` and was fixed in the design session — the submit control's horizontal
padding is defined in terms of it, so changing it changes a dimension that is already signed off.

**There is no 32px step and no 48px step.** That is not an omission. A scale with a value every
8px is a scale where every gap is defensible and nothing is deliberate, and it is how a layout
ends up with the even, dense rhythm of a dashboard. If something feels like it wants 32, it takes
`--space-5` or `--space-6` and the layout is better for having to choose. (`48px` does appear in
this system, as the submit control's height. That is a dimension, not a space step; it is not
`--space-anything` and nothing pads by it.)

**The minimum tap target** is `44px`, in both dimensions, including padding — a slot tile never
goes below it. Like the submit control's `48px`, this is a dimension, not a `--space-*` step:
nothing pads by it and it does not become a new token.

**Asymmetry is the point.** Editorial whitespace is lopsided: pair a large step on one side with a
small one on the other — `--space-8` leading in from the left and `--space-5` on the right, a
section with `--space-7` above it and `--space-6` below. Equal padding on all four sides of
everything is the look this palette is trying to get away from.

## Radius

| Token         | Value | Role                                                      |
| ------------- | ----- | --------------------------------------------------------- |
| `--radius-sm` | `2px` | Inputs, slot tiles, the submit control.                   |
| `--radius-md` | `4px` | Cards, banners, the `--state-error` surface.              |
| `--radius-lg` | `8px` | A full-width panel or an image mask. This is the ceiling. |

Close to sharp, on purpose. Heavy rounding on every surface is the single clearest tell of a
default component library, and a 2px corner on a slot tile reads as something printed rather than
something generated. `8px` is the largest radius in the product; there is nothing above it.

**There is no pill radius.** No `9999px`, no `border-radius: 50%` on a control. The submit control
is a rectangle with a 2px corner, full-width in its container — see below.

## Type

### Fonts and packaging

`--font-display` is **Fraunces**, variable, via `@fontsource-variable/fraunces`, importing only
the standard-axes subset (`wght` and `opsz`). This design uses `wght` 560–620 and leaves `opsz` on
automatic. That is the range this system uses, not a claim about the typeface's full range.

Fraunces' custom `SOFT` and `WONK` axes are **excluded entirely** — not shipped, not imported, not
pinned at `0` in CSS. The controlled, non-quirky letterform is a deliberate choice, and an axis
that is present in the font file is an axis somebody nudges later "just a little" on one heading.
Not shipping them is the only version of that decision that holds.

`--font-body` is **Work Sans**, static weights 400, 500 and 600 only, via `@fontsource/work-sans`
— the plain package, not `-variable`. Nothing in this UI interpolates weight continuously, so the
variable package would ship a larger file to buy a capability no screen uses.

**Note for ticket T-07**, which will be the first to import a font file: both fonts are
self-hosted from those npm packages. Never a `fonts.googleapis.com` link. Several screens in this
product have a hard "no network request" requirement, and a CDN font tag violates it on the very
first paint.

A known risk, not a confirmed bug: Angular's esbuild `application` builder has reported cases of
not resolving `url()` references inside third-party CSS pulled in through a plain `@import`. Plan
for an explicit `angular.json` assets entry that copies the `.woff2` files out of `node_modules`
into the build output, rather than trusting `@import` alone — and verify the built output actually
contains the font files, because the failure mode is a silent fallback to a system serif that
looks almost right in review.

### Type scale

Two display sizes exist and the rest of the scale is built around them. The hero at `56px` and the
section heading at `28px` were fixed in the design session; the section-heading role is reused at
its own size for the shared empty-state cards elsewhere in the product.

| Role                     | Font             | Weight       | Size   | Line height |
| ------------------------ | ---------------- | ------------ | ------ | ----------- |
| `--type-display-hero`    | `--font-display` | 560 (`wght`) | `56px` | `1.04`      |
| `--type-display-section` | `--font-display` | 600 (`wght`) | `28px` | `1.18`      |
| `--type-body-lead`       | `--font-body`    | 400          | `20px` | `1.55`      |
| `--type-body`            | `--font-body`    | 400          | `16px` | `1.60`      |
| `--type-body-small`      | `--font-body`    | 400          | `14px` | `1.55`      |
| `--type-caption`         | `--font-body`    | 500          | `13px` | `1.45`      |
| `--type-eyebrow`         | `--font-body`    | 500          | `12px` | `1.30`      |
| `--type-control-label`   | `--font-body`    | 600          | `16px` | `1.00`      |

Line heights are unitless so they scale with the size they are applied to.

Notes on the choices, because a type scale that nobody understands is a type scale people round:

- The hero is the **lighter** of the two display weights (560) and the section heading the heavier
  (600). Large type carries presence from its size; small display type needs the weight to hold
  the page. Clamping the axis to 560–620 is what stops someone reaching for a 300 or a 700.
- Only two display sizes. A third would be a judgement call on every screen, and the display face
  earns its keep by being rare.
- `--type-display-hero` takes a tracking of `-0.01em`; nothing else in the scale adjusts tracking,
  except `--type-eyebrow`, which takes `+0.08em` because it is set in small caps-height uppercase
  and would otherwise be unreadable.
- `--type-caption` is for metadata — a price, a duration, a timestamp. Helper text under a control
  is `--type-body-small`, not caption: it is a sentence a customer has to read, so it gets `14px`,
  not `13px`.
- `--type-control-label` is a role, not a component. It is the label of any control that looks like
  a button, and the submit control is simply the first of them.

## The submit control

Fixed in the design session; recorded here so nobody re-derives it:

- Height **`48px`**, fixed. Not padding-derived, not line-height-derived.
- Horizontal padding `--space-5` (`24px`) on each side.
- Label: `--type-control-label` — `--font-body`, `16px`, weight 600, no letter-spacing adjustment.
- **Full-width within its container at narrow breakpoints.** It never shrinks to fit its label and
  it is never a pill. A thumb at 11pm on a phone gets the whole width.
- Fill `--accent`, label `--text-on-accent`, corner `--radius-sm`.

The `48px` height and `1.00` label line height work together: the control's height does the
vertical centring, so the label needs no line-height padding of its own.

## Contrast

Every row below is the real output of `node tools/check-contrast.mjs '#hexA' '#hexB'`. Nothing in
this table was estimated. `npm run check:contrast` re-derives all of it from the two hex columns
and fails if a number, a threshold or a verdict has drifted — and, because a row recomputed from
its own hexes would agree with itself no matter what those hexes said, it also checks both hex
columns against the "Colour" table, reading the mode from the `(light)`/`(dark)` marker that ends
each "Pairing" cell. Changing a token's value in the "Colour" table without re-measuring the rows
that use it fails the check.

| Pairing                                                                       | Foreground token   | Background token   | Foreground hex | Background hex | Ratio | Required              | Result                            |
| ----------------------------------------------------------------------------- | ------------------ | ------------------ | -------------- | -------------- | ----- | --------------------- | --------------------------------- |
| Body text on the page (light)                                                 | `--text-primary`   | `--surface-page`   | #171412        | #F6F1EA        | 16.32 | 4.5 (AA, normal text) | Pass                              |
| Secondary text on a raised surface — `--state-unavailable`'s own pair (light) | `--text-secondary` | `--surface-raised` | #6B6056        | #ECE4D8        | 4.85  | 4.5 (AA, normal text) | Pass                              |
| Disabled sign-in control label (light)                                        | `--text-secondary` | `--surface-raised` | #6B6056        | #ECE4D8        | 4.85  | 4.5 (AA, normal text) | Pass                              |
| Disabled sign-in helper text (light)                                          | `--text-secondary` | `--surface-page`   | #6B6056        | #F6F1EA        | 5.44  | 4.5 (AA, normal text) | Pass                              |
| Primary CTA label on its accent fill (light)                                  | `--text-on-accent` | `--accent`         | #FDF6EF        | #B5472D        | 5.02  | 4.5 (AA, normal text) | Pass                              |
| Focus ring on a page-level control (light)                                    | `--accent`         | `--surface-page`   | #B5472D        | #F6F1EA        | 4.79  | 3.0 (AA, non-text)    | Pass                              |
| Focus ring on a raised surface or tile (light)                                | `--accent`         | `--surface-raised` | #B5472D        | #ECE4D8        | 4.27  | 3.0 (AA, non-text)    | Pass                              |
| Selected-slot ring (light)                                                    | `--accent`         | `--surface-raised` | #B5472D        | #ECE4D8        | 4.27  | 3.0 (AA, non-text)    | Pass                              |
| Focus ring inside the error surface (light)                                   | `--accent`         | `--state-error`    | #B5472D        | #D9CBB8        | 3.38  | 3.0 (AA, non-text)    | Pass                              |
| Error-surface text (light)                                                    | `--text-primary`   | `--state-error`    | #171412        | #D9CBB8        | 11.51 | 4.5 (AA, normal text) | Pass                              |
| Secondary text on the error surface — rejected (light)                        | `--text-secondary` | `--state-error`    | #6B6056        | #D9CBB8        | 3.84  | 4.5 (AA, normal text) | Fail — rejected, see note 2       |
| Decorative hairline on the page (light)                                       | `--border-default` | `--surface-page`   | #D8CFC2        | #F6F1EA        | 1.37  | 3.0 (decorative)      | Fail — not applicable, see note 1 |
| Decorative hairline on a raised surface (light)                               | `--border-default` | `--surface-raised` | #D8CFC2        | #ECE4D8        | 1.22  | 3.0 (decorative)      | Fail — not applicable, see note 1 |
| Interactive edge on the page (light)                                          | `--border-strong`  | `--surface-page`   | #7F7367        | #F6F1EA        | 4.11  | 3.0 (AA, non-text)    | Pass                              |
| Interactive edge on a raised surface (light)                                  | `--border-strong`  | `--surface-raised` | #7F7367        | #ECE4D8        | 3.66  | 3.0 (AA, non-text)    | Pass                              |
| Body text on the page (dark)                                                  | `--text-primary`   | `--surface-page`   | #F4EDE4        | #16120F        | 16.04 | 4.5 (AA, normal text) | Pass                              |
| Secondary text on a raised surface — `--state-unavailable`'s own pair (dark)  | `--text-secondary` | `--surface-raised` | #9C8E7E        | #201A14        | 5.40  | 4.5 (AA, normal text) | Pass                              |
| Disabled sign-in control label (dark)                                         | `--text-secondary` | `--surface-raised` | #9C8E7E        | #201A14        | 5.40  | 4.5 (AA, normal text) | Pass                              |
| Disabled sign-in helper text (dark)                                           | `--text-secondary` | `--surface-page`   | #9C8E7E        | #16120F        | 5.84  | 4.5 (AA, normal text) | Pass                              |
| Primary CTA label on its accent fill (dark)                                   | `--text-on-accent` | `--accent`         | #FDF6EF        | #B5472D        | 5.02  | 4.5 (AA, normal text) | Pass                              |
| Focus ring on a page-level control (dark)                                     | `--accent`         | `--surface-page`   | #B5472D        | #16120F        | 3.46  | 3.0 (AA, non-text)    | Pass                              |
| Focus ring on a raised surface or tile (dark)                                 | `--accent`         | `--surface-raised` | #B5472D        | #201A14        | 3.20  | 3.0 (AA, non-text)    | Pass                              |
| Selected-slot ring (dark)                                                     | `--accent`         | `--surface-raised` | #B5472D        | #201A14        | 3.20  | 3.0 (AA, non-text)    | Pass                              |
| Focus ring inside the error surface (dark)                                    | `--accent`         | `--state-error`    | #B5472D        | #2A1C16        | 3.06  | 3.0 (AA, non-text)    | Pass                              |
| Error-surface text (dark)                                                     | `--text-primary`   | `--state-error`    | #F4EDE4        | #2A1C16        | 14.17 | 4.5 (AA, normal text) | Pass                              |
| Secondary text on the error surface — not used (dark)                         | `--text-secondary` | `--state-error`    | #9C8E7E        | #2A1C16        | 5.16  | 4.5 (AA, normal text) | Pass, but not used — see note 2   |
| Decorative hairline on the page (dark)                                        | `--border-default` | `--surface-page`   | #332B23        | #16120F        | 1.34  | 3.0 (decorative)      | Fail — not applicable, see note 1 |
| Decorative hairline on a raised surface (dark)                                | `--border-default` | `--surface-raised` | #332B23        | #201A14        | 1.24  | 3.0 (decorative)      | Fail — not applicable, see note 1 |
| Interactive edge on the page (dark)                                           | `--border-strong`  | `--surface-page`   | #80725F        | #16120F        | 3.98  | 3.0 (AA, non-text)    | Pass                              |
| Interactive edge on a raised surface (dark)                                   | `--border-strong`  | `--surface-raised` | #80725F        | #201A14        | 3.68  | 3.0 (AA, non-text)    | Pass                              |

### Note 1 — the hairline rows are "not applicable", recorded as a numeric fail

A warm hairline on warm paper does not reach 3:1 and never will: `--border-default` measures
1.37:1 on the page in light mode and 1.34:1 in dark. That is recorded honestly rather than dressed
up, because the alternative — a hairline dark enough to pass — is a visible ruled line through
every card and the end of the warm-on-warm palette.

It is also not a violation. WCAG 1.4.11 applies to visual information required to identify a UI
component or its state. `--border-default` identifies nothing: it is a seam between two surfaces
that are already distinguishable by their fill and their content, and no control's presence, type
or state is communicated by it. Read those two rows as **not applicable — decorative**.

They carry `3.0` in the Required column and `Fail` in the Result column for a mechanical reason:
`tools/check-contrast.mjs` requires a numeric threshold and a literal Pass or Fail in those two
cells, so `n/a` there would stop the whole table being machine-checked. The numeric fail is the
true measurement; this note is its scope.

**When a border is the only cue for an interactive element** — a tile edge, an input outline, a
button outline with no fill — use `--border-strong`, which clears 3:1 against both surfaces in
both modes (4.11:1 / 3.66:1 light, 3.98:1 / 3.68:1 dark). That is what it exists for. T-09 does
not have to invent a compliant border; it already has one.

### Note 2 — why `--state-error` pairs with `--text-primary`

`--text-secondary` works on every other surface in this system and does not work on the light
error surface: 3.84:1, a fail. On the dark error surface the same pairing measures 5.16:1 and
would pass, which is precisely why it is still not used — a token that is legal in one mode and
illegal in the other is a token that ships broken in the mode nobody opened. `--state-error`
always pairs with `--text-primary`.

## Do not

- Do not use `--accent` as foreground text on `--surface-page` (e.g. for links) — this pairing is
  tight and the resolution is to not use `--accent` there at all, not to find a workaround size.
- Do not let any component invent its own grey or disabled colour — `--state-unavailable` and
  `--state-error` are the only two unavailable/error surfaces in this system.
- Do not add a fourth use of `--accent`. Three are listed above and the list is the design.
- Do not introduce a spacing value that is not a `--space-*` step, and do not add a 32px or 48px
  step to make an existing layout easier.
- Do not round a corner past `--radius-lg`, and do not make any control a pill.
- Do not use `opacity` to express a disabled or unavailable state. It invalidates every ratio in
  the table above.
- Do not ship Fraunces' `SOFT` or `WONK` axes, and do not pin them to `0` as a compromise — they
  are excluded at the import level.
- Do not load a font from `fonts.googleapis.com`, in any screen, for any reason.
- Do not edit a ratio in the Contrast table by hand. Run
  `node tools/check-contrast.mjs '#hexA' '#hexB'` and transcribe what it prints.

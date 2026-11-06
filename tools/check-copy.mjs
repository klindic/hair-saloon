// Fails the build if any of the fifteen locked, word-for-word customer-facing strings is
// missing from docs/design/booking-flow.md. These strings are the copy T-06 specifies for the
// booking flow's states — the pre-day empty state, the demo banner, the closed/fully-booked
// states, the just-taken tile, the unconfirmed fallback, the disabled sign-in helper, the submit
// button's three labels, the next-open-day link's two variants, and the DayUnavailableCard's own
// phone-only fallback when no open day is found — and they are checked as exact substrings so a
// rewrite that drifts a single character (a hyphen for an em dash, three periods for an
// ellipsis) is caught rather than shipped.
//
// Run: node tools/check-copy.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './dist-dir.mjs';

const DOC_PATH = 'docs/design/booking-flow.md';

const LOCKED_STRINGS = [
  { label: 'pre-day empty state', text: 'Pick a day to see open times.' },
  {
    label: 'demo banner',
    text: 'This is a preview — bookings made here are not sent to the salon.',
  },
  { label: 'closed-day heading', text: 'Closed today' },
  {
    label: 'closed-day body',
    text: "The salon isn't open on [weekday]. Try another day.",
  },
  { label: 'fully-booked heading', text: 'Fully booked today' },
  {
    label: 'fully-booked body',
    text: 'Every slot today has been taken. Try another day.',
  },
  { label: 'just-taken tile', text: 'Just taken — pick another time.' },
  {
    label: 'unconfirmed/phone fallback',
    text: "We couldn't confirm your request — please call the salon at {{salonPhone}} to book directly.",
  },
  {
    label: 'DayUnavailableCard phone fallback',
    text: 'Please call the salon at {{salonPhone}} to book directly.',
  },
  { label: 'disabled sign-in helper', text: "Sign-in isn't connected in this preview." },
  { label: 'submit default label', text: 'Request this appointment' },
  { label: 'submit sending label', text: 'Sending your request…' },
  { label: 'submit retrying label', text: 'Still sending…' },
  {
    label: 'next-open-day link (near)',
    text: 'See {Weekday}',
    // "See {Weekday}" is a prefix of the far variant below, so an occurrence immediately
    // followed by " {D MMM}" belongs to that string, not to this one, and must not count here.
    excludeIfFollowedBy: ' {D MMM}',
  },
  { label: 'next-open-day link (far)', text: 'See {Weekday} {D MMM}' },
];

function countOccurrences(markdown, text, excludeIfFollowedBy) {
  let count = 0;
  let index = markdown.indexOf(text);
  while (index !== -1) {
    const after = markdown.slice(
      index + text.length,
      index + text.length + (excludeIfFollowedBy?.length ?? 0)
    );
    if (!excludeIfFollowedBy || after !== excludeIfFollowedBy) {
      count++;
    }
    index = markdown.indexOf(text, index + text.length);
  }
  return count;
}

function checkCopyDoc(markdown) {
  const failures = [];
  for (const { label, text, excludeIfFollowedBy } of LOCKED_STRINGS) {
    if (countOccurrences(markdown, text, excludeIfFollowedBy) < 1) {
      failures.push(`${label}: missing locked string "${text}"`);
    }
  }
  return failures;
}

function runDocCheck() {
  let markdown;
  try {
    markdown = readFileSync(join(REPO_ROOT, DOC_PATH), 'utf8');
  } catch {
    console.error(
      `check:copy found 1 problem(s):\n\n  - ${DOC_PATH} does not exist — T-06 specifies the booking flow's copy there, so a missing file is a broken build, not a pass`
    );
    process.exit(1);
  }

  const failures = checkCopyDoc(markdown);
  if (failures.length > 0) {
    console.error(`check:copy found ${failures.length} problem(s):\n`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log(`check:copy: all ${LOCKED_STRINGS.length} locked strings are present in ${DOC_PATH}`);
}

runDocCheck();

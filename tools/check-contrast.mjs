// Computes WCAG 2.x contrast ratios and checks that docs/design/tokens.md has not drifted from
// the maths. A self-test runs first, every time, against two of WCAG's own published reference
// pairs — this is the one place a silent rounding or ordering bug would hide, so it is never
// skipped and never bypassable by a flag.
//
// CLI usage — reach for this instead of eyeballing a ratio whenever a ticket adds a colour pairing:
//   node tools/check-contrast.mjs '#6B6056' '#FFFFFF'
//     -> prints the contrast ratio, rounded to 2 decimals, and exits 0.
//
// Doc-check usage (also runs inside npm run verify):
//   node tools/check-contrast.mjs
//     -> re-derives every row of the ratio table in docs/design/tokens.md from its hex columns
//        and fails if the recorded ratio disagrees with the recomputed one, if the Pass/Fail
//        verdict disagrees with whether that ratio clears its required threshold, or if the
//        threshold itself can't be parsed. It also cross-checks both hex columns against the
//        Colour table, so a hex that no longer matches the token it names in the row is a
//        failure rather than a row that agrees with itself. The mode is read from the
//        "(light)"/"(dark)" marker that ends every Pairing cell; a row without one fails,
//        because without it the hex cannot be checked at all.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './dist-dir.mjs';

function linearize(channel) {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) {
    throw new Error(`not a 6-digit hex colour: "${hex}"`);
  }
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function runSelfTest() {
  const cases = [
    ['#000000', '#FFFFFF', 21.0],
    ['#767676', '#FFFFFF', 4.54],
  ];
  for (const [a, b, expected] of cases) {
    const actual = contrastRatio(a, b);
    if (Math.abs(actual - expected) > 0.02) {
      console.error(
        `check:contrast self-test failed: contrastRatio(${a}, ${b}) = ${actual.toFixed(2)}, expected ~${expected}`
      );
      process.exit(1);
    }
  }
}

runSelfTest();

const HEADER =
  '| Pairing | Foreground token | Background token | Foreground hex | Background hex | Ratio | Required | Result |';
const COLOUR_HEADER = '| Token | Light | Dark | Role |';
const normalizeHeader = (line) => line.trim().replace(/\s+/g, ' ');

function cellsOf(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

// The Colour table writes tokens and hexes in backticks; the ratio table writes tokens in
// backticks and hexes bare. Strip backticks on both sides so the two tables compare.
const unbacktick = (cell) => cell.replace(/`/g, '').trim();

// `#f6f1ea` and `#F6F1EA` are the same colour. Compare on that basis rather than on the string,
// so a lowercase transcription is not reported as drift.
const normalizeHex = (cell) => unbacktick(cell).replace(/^#/, '').toUpperCase();

// Rows of the Colour table, as token -> { light, dark }. This is the declared value of every
// token; the ratio table's hex columns are checked against it so the two cannot drift apart.
function parseColourTable(lines, failures) {
  const headerIndex = lines.findIndex(
    (line) => normalizeHeader(line) === normalizeHeader(COLOUR_HEADER)
  );
  if (headerIndex === -1) {
    failures.push(
      "docs/design/tokens.md has no Colour table with the expected header row, so the ratio table's hexes cannot be checked against the tokens they name"
    );
    return null;
  }

  const tokens = new Map();
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) {
      break;
    }
    const cells = cellsOf(line);
    if (cells.length < 4) {
      continue;
    }
    const token = unbacktick(cells[0]);
    if (!token.startsWith('--')) {
      continue;
    }
    const light = unbacktick(cells[1]);
    const dark = unbacktick(cells[2]);
    for (const [mode, hex] of [
      ['light', light],
      ['dark', dark],
    ]) {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        failures.push(`Colour table row "${token}": ${mode} value "${hex}" is not a 6-digit hex`);
      }
    }
    tokens.set(token, { light, dark });
  }

  if (tokens.size === 0) {
    failures.push('docs/design/tokens.md has a Colour table header but no token rows beneath it');
    return null;
  }

  return tokens;
}

function checkHexMatchesToken(tokens, { pairing, column, tokenCell, hexCell, mode, failures }) {
  const token = unbacktick(tokenCell);
  const declared = tokens.get(token);
  if (!declared) {
    failures.push(
      `row "${pairing}": ${column} token ${token} is not a row of the Colour table, so its hex cannot be checked`
    );
    return;
  }
  if (normalizeHex(hexCell) !== normalizeHex(declared[mode])) {
    failures.push(
      `row "${pairing}": ${column} hex ${hexCell} is not ${token}'s ${mode} value ${declared[mode]} in the Colour table`
    );
  }
}

function checkTokensDoc(markdown) {
  const failures = [];
  const lines = markdown.split('\n');
  const colourTokens = parseColourTable(lines, failures);
  const headerIndex = lines.findIndex((line) => normalizeHeader(line) === normalizeHeader(HEADER));
  if (headerIndex === -1) {
    failures.push(
      'docs/design/tokens.md exists but has no ratio table with the expected header row'
    );
    return failures;
  }

  let checked = 0;
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) {
      break;
    }
    const cells = cellsOf(line);
    if (cells.length < 8) {
      failures.push(
        `row "${cells[0] || line.trim()}" has ${cells.length} cell(s), expected 8 — the row is malformed and was not checked`
      );
      continue;
    }
    const [
      pairing,
      foregroundToken,
      backgroundToken,
      foregroundHex,
      backgroundHex,
      ratioCell,
      requiredCell,
      resultCell,
    ] = cells;

    // A row that only agrees with itself proves nothing: the ratio below is recomputed from these
    // two hexes, so a hex that has drifted from the token it names would still recompute cleanly.
    // The Colour table is the declared value, and these two cells have to equal it. The mode comes
    // from the marker that ends the Pairing cell, which is why that marker is required, not prose.
    const modeMatch = /\((light|dark)\)$/.exec(pairing);
    if (!modeMatch) {
      failures.push(
        `row "${pairing}": the Pairing cell must end with "(light)" or "(dark)" — without it the hexes cannot be checked against the Colour table`
      );
    } else if (colourTokens) {
      const mode = modeMatch[1];
      checkHexMatchesToken(colourTokens, {
        pairing,
        column: 'Foreground',
        tokenCell: foregroundToken,
        hexCell: foregroundHex,
        mode,
        failures,
      });
      checkHexMatchesToken(colourTokens, {
        pairing,
        column: 'Background',
        tokenCell: backgroundToken,
        hexCell: backgroundHex,
        mode,
        failures,
      });
    }

    let actual;
    try {
      actual = contrastRatio(foregroundHex, backgroundHex);
    } catch (error) {
      failures.push(`row "${pairing}": ${error.message}`);
      continue;
    }

    const recordedRatio = Number.parseFloat(ratioCell);
    if (Number.isNaN(recordedRatio) || Math.abs(actual - recordedRatio) > 0.01) {
      failures.push(
        `row "${pairing}": recorded ratio ${ratioCell} does not match recomputed ratio ${actual.toFixed(2)}`
      );
    }

    const requiredMatch = /^[\d.]+/.exec(requiredCell.trim());
    const required = requiredMatch ? Number.parseFloat(requiredMatch[0]) : NaN;
    const actuallyPasses = !Number.isNaN(required) && actual >= required;
    if (Number.isNaN(required)) {
      failures.push(`row "${pairing}": could not parse a required ratio from "${requiredCell}"`);
    } else {
      const resultSaysPass = /pass/i.test(resultCell);
      const resultSaysFail = /fail/i.test(resultCell);
      if (resultSaysPass && !actuallyPasses) {
        failures.push(
          `row "${pairing}": Result says Pass but ${actual.toFixed(2)} is below the required ${required}`
        );
      } else if (resultSaysFail && actuallyPasses) {
        failures.push(
          `row "${pairing}": Result says Fail but ${actual.toFixed(2)} meets the required ${required}`
        );
      } else if (!resultSaysPass && !resultSaysFail) {
        failures.push(`row "${pairing}": Result column "${resultCell}" is neither Pass nor Fail`);
      }
    }

    checked += 1;
  }

  if (checked === 0) {
    failures.push(
      'docs/design/tokens.md has a ratio table header but no data rows were checked beneath it'
    );
  }

  return failures;
}

function runDocCheck() {
  let markdown;
  try {
    markdown = readFileSync(join(REPO_ROOT, 'docs/design/tokens.md'), 'utf8');
  } catch {
    console.error(
      'check:contrast found 1 problem(s):\n\n  - docs/design/tokens.md does not exist — T-07, T-08, T-09, T-13 and T-14 read their token ' +
        'values from it, so a missing file is a broken build, not a pass'
    );
    process.exit(1);
  }

  const failures = checkTokensDoc(markdown);
  if (failures.length > 0) {
    console.error(`check:contrast found ${failures.length} problem(s):\n`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    'check:contrast: every hex in docs/design/tokens.md matches the Colour table and every ratio matches the recomputed value'
  );
}

const args = process.argv.slice(2);
if (args.length === 0) {
  runDocCheck();
} else if (args.length === 2) {
  console.log(contrastRatio(args[0], args[1]).toFixed(2));
} else {
  console.error('usage: node tools/check-contrast.mjs [<hexA> <hexB>]');
  process.exit(1);
}

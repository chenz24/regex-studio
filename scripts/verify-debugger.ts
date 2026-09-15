/**
 * Reproducible native-engine differential checks. Run with pnpm verify:debugger;
 * set REGEX_FUZZ_SEED to replay another seed. Generated inputs are short and
 * nesting/repetition is bounded so the native oracle cannot run away.
 */
import assert from 'node:assert/strict';
import { parseRegex } from '../src/utils/regexParser';
import { debugRegex } from '../src/utils/steppingMatcher';

const seed = Number(process.env.REGEX_FUZZ_SEED ?? 0x51eed) >>> 0;
let state = seed;
function pick<T>(items: readonly T[]): T {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return items[Math.floor((state / 0x1_0000_0000) * items.length)];
}

const stats = { cases: 0, valid: 0, invalid: 0, matched: 0, truncated: 0 };
function check(pattern: string, text: string, flags = '') {
  const context = JSON.stringify({ seed, case: stats.cases++, pattern, text, flags });
  let native: RegExp;
  try {
    native = new RegExp(pattern, `${flags}d`);
  } catch (error) {
    assert(error instanceof SyntaxError, context);
    stats.invalid++;
    const result = debugRegex(parseRegex(pattern, flags), text, flags);
    assert(result.error, context);
    assert.equal(result.matched, false, context);
    assert.equal(result.steps.length, 0, context);
    return;
  }

  stats.valid++;
  const expected = native.exec(text);
  const actual = debugRegex(parseRegex(pattern, flags), text, flags);
  if (actual.truncated) stats.truncated++;
  assert.equal(actual.error, undefined, context);
  assert.equal(actual.truncated, false, context);
  assert.equal(actual.matched, expected !== null, context);
  assert.equal(actual.matchStart, expected?.index ?? -1, context);
  assert.equal(actual.matchEnd, expected ? expected.index + expected[0].length : -1, context);
  if (expected) {
    stats.matched++;
    const captures = actual.steps[actual.steps.length - 1]?.captureGroups ?? {};
    for (let i = 1; i < expected.length; i++) {
      assert.equal(captures[i]?.value, expected[i], `${context} capture ${i}`);
      const span = captures[i] ? [captures[i]!.start, captures[i]!.end] : undefined;
      assert.deepEqual(span, expected.indices![i], `${context} capture ${i} span`);
    }
  }
}

// Every legacy octal character, including NUL and the 2/3-digit boundaries.
// Appending an 8 forces the lexer to end the escape before the quantified atom.
for (let value = 0; value <= 255; value++) {
  const octalEscape = `\\${value.toString(8)}`;
  const char = String.fromCharCode(value);
  check(`${octalEscape}{2}`, char.repeat(2));
  check(`${octalEscape}{2}`, '');
  check(`${octalEscape}8{2}`, `${char}88`);
}

const atoms = [
  'a',
  'b',
  'A',
  '[ab]',
  '[0-9]',
  '.',
  '\\d',
  '\\w',
  '\\s',
  '\\0',
  '\\1',
  '\\2',
  '\\7',
  '\\8',
  '\\9',
  '\\10',
  '\\11',
  '\\18',
  '\\118',
  '\\123',
  '\\377',
  '\\400',
  '\\0123',
] as const;

function expression(depth: number): string {
  if (depth === 0) return pick(atoms);
  const child = expression(depth - 1);
  switch (pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    case 0:
      return `${child}${expression(depth - 1)}`;
    case 1:
      return `(?:${child}|${expression(depth - 1)})`;
    case 2:
      return `(${child})`;
    case 3:
      return `(?:${child})${pick(['?', '{0,2}', '{1,2}', '{2}', '{0,2}?'])}`;
    case 4:
      return `(?=${child})${expression(depth - 1)}`;
    case 5:
      return `(?!${child})${expression(depth - 1)}`;
    case 6:
      return `(?<=${child})${expression(depth - 1)}`;
    case 7:
      return `(?<!${child})${expression(depth - 1)}`;
    case 8:
      return `^${child}$`;
    default:
      return child;
  }
}

const alphabet = ['a', 'b', 'A', '1', '2', '8', '9', ' ', '\n', '\t', '\x00', '\x01', 'ÿ'];
for (let i = 0; i < 10_000; i++) {
  let pattern = expression(3);
  // Mix valid backward/forward references and repeated capture resets into
  // the same generated patterns as the legacy escape fallbacks.
  pattern = pick([
    pattern,
    `(a?)${pattern}\\1`,
    `\\1(a?)${pattern}`,
    `(?<n>a?)${pattern}\\k<n>`,
    `(?:(a)|(b)){0,2}${pattern}\\2`,
  ]);
  const length = pick([0, 1, 2, 3, 4, 5, 6]);
  const text = Array.from({ length }, () => pick(alphabet)).join('');
  check(pattern, text, pick(['', 'i', 'm', 's', 'u', 'v', 'im', 'is', 'iu', 'iv', 'ms']));
}

console.log(JSON.stringify({ seed, ...stats, failures: 0 }));

import { describe, expect, it } from 'vitest';
import { parseRegex } from './regexParser';
import { debugRegex } from './steppingMatcher';

/**
 * The debugger walks the pattern itself instead of handing it to the engine,
 * so its answer has to be checked against the engine's. Every case here is
 * run both ways and the verdict — and the span of the match — must agree.
 */
function bothWays(pattern: string, text: string, flags = '') {
  const native = new RegExp(pattern, flags).exec(text);
  const debug = debugRegex(parseRegex(pattern), text, flags);
  return {
    native: native
      ? { matched: true, start: native.index, end: native.index + native[0].length }
      : { matched: false, start: -1, end: -1 },
    debug: { matched: debug.matched, start: debug.matchStart, end: debug.matchEnd },
    truncated: debug.truncated,
  };
}

const CASES: Array<[pattern: string, text: string, flags?: string]> = [
  // Literals and classes
  ['abc', 'abc'],
  ['abc', 'xabcx'],
  ['abc', 'abd'],
  ['\\d+', 'no digits here'],
  ['[a-z]+', 'ABC abc'],
  ['\\x41+', 'AAA'],
  ['\\p{L}+', 'héllo', 'u'],

  // Scanning: the match does not start at position 0
  ['b', 'ab'],
  ['\\w+', '  hello'],
  ['$', 'abc'],

  // Greedy backtracking
  ['a.*b', 'aXbY'],
  ['a+a', 'aa'],
  ['a+ab', 'aaab'],
  ['\\w+@\\w+', 'mail: user@host'],
  ['".*"', 'say "hi" now'],
  ['^(a+)+$', 'aaaa'],

  // Lazy quantifiers
  ['a.*?b', 'aXXb'],
  ['a+?b', 'aab'],
  ['<.+?>', '<a><b>'],

  // Counted quantifiers
  ['a{2,3}b', 'aaab'],
  ['a{2}', 'a'],
  ['a{2,}x', 'aaax'],
  ['(ab){2,}', 'ababab'],

  // Alternation must be retried when the continuation fails
  ['(a|ab)c', 'abc'],
  ['(ab|a)c', 'abc'],
  ['^(foo|foobar)$', 'foobar'],
  ['x(a|b|c)y', 'xby'],

  // Groups and backreferences
  ['(a)(b)', 'ab'],
  ['(\\w)\\1', 'aa'],
  ['(\\w)\\1', 'ab'],
  ['(?<c>\\w)\\k<c>', 'zz'],
  ['(?:ab)+c', 'ababc'],

  // Lookaround
  ['a(?=b)', 'ab'],
  ['a(?=b)', 'ac'],
  ['a(?!b)', 'ac'],
  ['(?<=a)b', 'ab'],
  ['(?<!a)b', 'cb'],
  ['\\d+(?= dollars)', 'pay 100 dollars'],

  // Anchors and flags
  ['^abc$', 'abc'],
  ['^b', 'a\nb', 'm'],
  ['ABC', 'abc', 'i'],
  ['a.c', 'a\nc', 's'],
  ['a.c', 'a\nc'],
  ['\\bword\\b', 'a word here'],

  // Empty-ish
  ['a*', 'bbb'],
  ['(a*)*b', 'b'],
];

describe('debugRegex agrees with the native engine', () => {
  it.each(CASES)('/%s/%s on %o', (pattern, text, flags = '') => {
    const { native, debug, truncated } = bothWays(pattern, text, flags);
    expect(truncated).toBe(false);
    expect(debug).toEqual(native);
  });
});

describe('step log', () => {
  it('records backtracking when a greedy quantifier gives characters back', () => {
    const result = debugRegex(parseRegex('a.*b'), 'aXbY', '');
    expect(result.matched).toBe(true);
    expect(result.steps.some((s) => s.action === 'backtrack')).toBe(true);
  });

  it('records the capture as it is made', () => {
    const result = debugRegex(parseRegex('(\\w+)@'), 'user@host', '');
    const exit = result.steps.find((s) => s.action === 'exit-group');
    expect(exit?.description).toContain('user');
  });

  it('keeps only the captures that survived backtracking', () => {
    // The first alternative matches "ab" but dooms the rest, so group 1 must
    // end up holding "a", not "ab".
    const result = debugRegex(parseRegex('(ab|a)bc'), 'abc', '');
    expect(result.matched).toBe(true);
    const last = result.steps[result.steps.length - 1];
    expect(last.captureGroups[1]?.value ?? null).toBe('a');
  });

  it('stops at the step limit instead of running forever', () => {
    const result = debugRegex(parseRegex('^(a+)+$'), `${'a'.repeat(40)}!`, '');
    expect(result.truncated).toBe(true);
    expect(result.matched).toBe(false);
    expect(result.steps.length).toBeLessThanOrEqual(10000);
  });
});

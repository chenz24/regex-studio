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
  const debug = debugRegex(parseRegex(pattern, flags), text, flags);
  expect(debug.error).toBeUndefined();
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

  // Decimal escapes use the total capture count, then Annex B octal/identity
  // fallback. Remaining digits must keep their own quantifiers.
  ['\\1{2}', ''],
  ['\\1{2}', '\x01\x01'],
  ['\\1{1,2}', 'abab'],
  ['\\8+', '888'],
  ['\\9{2}', '99'],
  ['\\81+', '8111'],
  ['\\18{2}', '\x0188'],
  ['\\118{2}', '\t88'],
  ['\\1234+', 'S444'],
  ['\\377{2}', 'ÿÿ'],
  ['\\400{2}', ' 00'],
  ['\\777+', '?777'],
  ['\\0123{2}', '\n33'],
  ['\\0000+', '\x00000'],
  ['\\08+', '\x00888'],
  ['(a)\\10', 'a\b'],
  ['(a)\\18{2}', 'a\x0188'],
  ['(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)\\10', 'abcdefghijj'],
  ['\\10(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)', 'abcdefghij'],
  ['\\1(a)', 'a'],
  ['\\1(a)', 'a', 'u'],
  ['\\1(a)', 'a', 'v'],
  ['(a)?\\1', ''],
  ['[\\141-\\143]+', 'abc'],
  ['[\\1]{2}', '\x01\x01'],
  ['(?<=\\118{2})a', '\t88a'],

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

  // Empty iterations still count towards the quantifier's minimum.
  ['(a?)+b', 'b'],
  ['(a?){2}b', 'b'],
  ['(a?){2,3}?b', 'b'],
  ['^(a|(b))+\\2$', 'aba'],
  ['^(a(b)?)+\\2$', 'aba'],

  // Unicode sets must retain v semantics rather than being compiled with u.
  ['[a&&b]', 'a', 'v'],
  ['[a--b]', 'a', 'v'],
  ['[\\p{ASCII}&&\\p{Letter}]+', '12abc', 'v'],

  // Lookbehind reads backwards, including greediness and capture order.
  ['(?<=([ab]+))c\\1', 'abcab'],
  ['(?<=([ab]+))c\\1', 'abcb'],
  ['(?<=([ab]+?))c\\1', 'abcb'],
  ['(?<=([ab]+)([bc]+))$', 'abc'],
  ['(?<=\\1(a))b', 'aab'],
  ['(?<=(a)\\1)b', 'ab'],
  ['(?<=a(?=b))b', 'ab'],
  ['(?<=(?<=a)b)c', 'abc'],
  ['(?<!(a+))b', 'aab'],
];

describe('debugRegex agrees with the native engine', () => {
  it.each(CASES)('/%s/%s on %o', (pattern, text, flags = '') => {
    const { native, debug, truncated } = bothWays(pattern, text, flags);
    expect(truncated).toBe(false);
    expect(debug).toEqual(native);
  });
});

describe('step log', () => {
  it.each(['u', 'v'])('reports invalid decimal escapes before stepping with %s', (flags) => {
    for (const pattern of ['\\1{2}', '\\1*', '(?:\\8|)', '(a)\\2?', '\\01', '[\\1]']) {
      expect(() => new RegExp(pattern, flags)).toThrow(SyntaxError);
      const result = debugRegex(parseRegex(pattern, flags), '', flags);
      expect(result.error).toBeTruthy();
      expect(result.matched).toBe(false);
      expect(result.steps).toEqual([]);
      expect(result.truncated).toBe(false);
    }
  });

  it.each([
    'a+',
    '(?:a)+',
    'a+?$',
    'a+a',
  ])('handles long repetition of %s without overflowing the stack', (pattern) => {
    const { native, debug, truncated } = bothWays(pattern, 'a'.repeat(2000));
    expect(debug).toEqual(native);
    expect(truncated).toBe(false);
  });

  it('truncates a very long match at the step budget', () => {
    const result = debugRegex(parseRegex('a+'), 'a'.repeat(20_000), '');
    expect(result.truncated).toBe(true);
    expect(result.steps).toHaveLength(10_000);
  });

  it.each([
    ['(a(b)?)+', 'aba'],
    ['(a?){2}', ''],
    ['(?<=([ab]+)([bc]+))$', 'abc'],
    ['(?<=([ab]+?))c', 'abc'],
    ['(?<=(a)+)b', 'aaab'],
  ])('retains native capture values and spans for %s', (pattern, text) => {
    const native = new RegExp(pattern, 'd').exec(text)!;
    const debug = debugRegex(parseRegex(pattern), text, '');
    expect(debug.matched).toBe(true);
    const captures = debug.steps[debug.steps.length - 1].captureGroups;
    for (let i = 1; i < native.length; i++) {
      expect(captures[i]?.value).toBe(native[i]);
      expect(captures[i] ? [captures[i]!.start, captures[i]!.end] : undefined).toEqual(
        native.indices![i],
      );
    }
  });
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

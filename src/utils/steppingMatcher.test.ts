import { describe, expect, it } from 'vitest';
import { parseRegex } from './regexParser';
import { debugRegex, SteppingMatcher } from './steppingMatcher';

describe('duplicate names in disjoint alternatives', () => {
  it.each<[string, string, string | null]>([
    [String.raw`(?:(?<x>a)|(?<x>b))\k<x>`, 'aa', 'aa'],
    [String.raw`(?:(?<x>a)|(?<x>b))\k<x>`, 'bb', 'bb'],
    [String.raw`(?:(?<x>a)|(?<x>b))\k<x>`, 'ab', null],
    [String.raw`(?:(?<x>a)|(?<x>b))\k<x>`, 'ba', null],
    [String.raw`(?:(?<x>a)|(?<x>b))+\k<x>$`, 'abb', 'abb'],
    [String.raw`(?:(?<x>a)|(?<x>b))+\k<x>$`, 'baa', 'baa'],
    [String.raw`^(?:(?<x>)a|(?<x>b))\k<x>$`, 'a', 'a'],
    [String.raw`^(?:(?<x>a)|(?<x>b))?\k<x>$`, '', ''],
    [String.raw`(?<=\k<x>(?:(?<x>a)|(?<x>b)))c`, 'aac', 'c'],
    [String.raw`(?<=\k<x>(?:(?<x>a)|(?<x>b)))c`, 'bbc', 'c'],
  ])('%s on %j', (pattern, text, expected) => {
    // The browser E2E suite supplies native validation; Node 22 rejects this syntax.
    const result = new SteppingMatcher(parseRegex(pattern), text, '').execute();
    expect(result.truncated).toBe(false);
    expect(result.matched ? text.slice(result.matchStart, result.matchEnd) : null).toBe(expected);
  });
});

// Older Node versions reject scoped modifiers at compilation. Exercise the
// parser and stepping engine directly here; E2E compares to browser RegExp.
describe('scoped modifiers', () => {
  it.each<[string, string, string, string | null]>([
    ['(?i:a)', 'A', '', 'A'],
    ['(?-i:a)', 'A', 'i', null],
    ['(?i:a)b', 'AB', '', null],
    ['(?i:a)b', 'Ab', '', 'Ab'],
    ['(?i:a(?-i:b)c)', 'AbC', '', 'AbC'],
    ['(?i:a(?-i:b)c)', 'ABC', '', null],
    ['(?i:a|ab)c', 'ABc', '', 'ABc'],
    ['(?i:a+)a', 'AAa', '', 'AAa'],
    ['(?i:a+)a', 'AAA', '', null],
    ['(?s:a.b)', 'a\rb', '', 'a\rb'],
    ['(?s:a.b).', 'a\rb\n', '', null],
    ['(?-s:a.b)', 'a\nb', 's', null],
    ['(?m:^b$)', 'a\rb\nc', '', 'b'],
    ['(?-m:^b$)', 'a\nb', 'm', null],
    [String.raw`(?i:\bK\b)`, 'K', 'u', 'K'],
    [String.raw`(?-i:\bK\b)`, 'K', 'iu', null],
    [String.raw`(a)(?i:\1)`, 'aA', '', 'aA'],
    [String.raw`(?i:(a))\1`, 'Aa', '', null],
    ['(?i:(?<=a)b)', 'AB', '', 'B'],
    ['(?i:(?=a)a)b', 'Ab', '', 'Ab'],
    [String.raw`(?i:[\q{Ab|C}])d`, 'abd', 'v', 'abd'],
  ])('%s on %j (%s)', (pattern, text, flags, expected) => {
    const ast = parseRegex(pattern, flags);
    const result = new SteppingMatcher(ast, text, flags).execute();
    expect(result.truncated).toBe(false);
    expect(result.matched ? text.slice(result.matchStart, result.matchEnd) : null).toBe(expected);
  });

  it('retains enabled and disabled flags on nested groups', () => {
    const ast = parseRegex('(?im-s:a(?-i:b))');
    expect(ast.flagSpec).toBe('im-s');
    expect(ast.children?.[1].flagSpec).toBe('-i');
  });
});

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
  // Unicode set operations and strings, including retries and reverse matching.
  ['[a&&[ab]]', 'a', 'v'],
  ['[a&&[ab]]', 'b', 'v'],
  ['[[a-z]--[aeiou]]+', 'aeiobcdf', 'v'],
  ['[^[[a-z]--[aeiou]]]', 'a', 'v'],
  [String.raw`[\q{ab|cd}]`, 'xab', 'v'],
  [String.raw`[\q{a|ab}]`, 'ab', 'v'],
  [String.raw`([\q{a|ab}])b`, 'ab', 'v'],
  [String.raw`([\q{ab|cd}])+`, 'abcd', 'v'],
  [String.raw`[\q{a\]b|c}]`, 'a]b', 'v'],
  [String.raw`[\q{ab|}]`, '', 'v'],
  [String.raw`[\q{ab|}]ab`, 'ab', 'v'],
  [String.raw`[\q{ab|}]*c`, 'abc', 'v'],
  [String.raw`(?<=([\q{ab|b}]))c`, 'abc', 'v'],
  [String.raw`(?<=a([\q{ab|b}]))c`, 'abc', 'v'],
  [String.raw`(?<=([\q{ab|}]))c`, 'c', 'v'],
  [String.raw`[\q{😀a|😀}]a`, '😀a', 'v'],
  [String.raw`(?<=😀[\q{😀a|a}])b`, '😀ab', 'v'],
  [String.raw`[\q{Ab|C}]`, 'ab', 'iv'],
  [String.raw`\p{RGI_Emoji}`, '👨‍👩‍👧‍👦', 'v'],
  [String.raw`[\p{RGI_Emoji}]`, '👨‍👩‍👧‍👦', 'v'],
  [String.raw`[\q{abc|ab|a}]bc`, 'abc', 'v'],
  [String.raw`[\q{abc|ab|a}]z`, 'abc', 'v'],
  // Annex B identity escapes must retain literal text and quantifier boundaries.
  [String.raw`\u{2}`, 'uu'],
  [String.raw`\p{2}`, 'pp'],
  [String.raw`\P{2}`, 'PP'],
  [String.raw`\p{L}`, 'p{L}'],
  [String.raw`\u{61}`, 'u'.repeat(61)],
  [String.raw`\u{61}`, 'a', 'u'],
  [String.raw`\k<a>`, 'k<a>'],
  [String.raw`\k<a>`, 'other'],
  [String.raw`\k<a>(?<a>x)`, 'x'],
  // Unicode atoms, canonical case folding, boundaries and escaped group names.
  ...['u', 'v'].flatMap(
    (flag): Array<[string, string, string]> => [
      ['😀+', '😀😀', flag],
      ['😀{2}', 'x😀😀', flag],
      ['(?<=(😀+))a', '😀😀a', flag],
      [String.raw`\uD83D\uDE00+`, '😀😀', flag],
      ['s', 'ſ', `i${flag}`],
      ['σ', 'ς', `i${flag}`],
      ['(s)\\1', 'sſ', `i${flag}`],
      ['(σ)\\1', 'σς', `i${flag}`],
      ['\\bK', 'K', `i${flag}`],
      ['K\\b', 'K', `i${flag}`],
    ],
  ),
  ['k', 'K', 'i'],
  ['(k)\\1', 'kK', 'i'],
  ['σ', 'ς', 'i'],
  ['(σ)\\1', 'σς', 'i'],
  [String.raw`(?<\u0061>x)\k<a>`, 'x'],
  [String.raw`(?<\u0061>x)\k<a>`, 'xx'],
  [String.raw`(?<a>x)\k<\u0061>`, 'xx'],
  [String.raw`(?<\u{61}>x)\k<a>`, 'xx'],
  ...['\r', '\n', '\r\n', '\u2028', '\u2029'].flatMap(
    (newline): Array<[string, string, string]> => [
      ['^b', `a${newline}b`, 'm'],
      ['a$', `a${newline}b`, 'm'],
      ['^b', `a${newline}b`, ''],
      ['a$', `a${newline}b`, ''],
    ],
  ),
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
  it.each([
    [String.raw`([\q{ab|a}])b`, 'ab'],
    [String.raw`(?<=a([\q{ab|b}]))c`, 'abc'],
    [String.raw`(?<=([\q{ab|b}])+)c`, 'ababc'],
    [String.raw`([\q{ab|a|}])+b`, 'aab'],
    [String.raw`([\q{😀a|😀}])a`, '😀a'],
    [String.raw`([\q{ab|a}])\1`, 'abab'],
  ])('preserves native captures when Unicode strings backtrack: %s', (pattern, text) => {
    const native = new RegExp(pattern, 'dv').exec(text)!;
    const result = debugRegex(parseRegex(pattern, 'v'), text, 'v');
    expect(result.matched).toBe(true);
    expect(result.truncated).toBe(false);
    const captures = result.steps[result.steps.length - 1].captureGroups;
    for (let i = 1; i < native.length; i++) {
      expect(captures[i] ?? null).toEqual(
        native[i] === undefined
          ? null
          : {
              value: native[i],
              start: native.indices![i]![0],
              end: native.indices![i]![1],
            },
      );
    }
  });

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

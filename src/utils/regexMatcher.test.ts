import { describe, expect, it } from 'vitest';
import { findMatches, isValidRegex, replaceMatches } from './regexMatcher';

describe('findMatches', () => {
  it('collects every match under the g flag', () => {
    const matches = findMatches('\\w+', 'g', 'foo bar');
    expect(matches.map((m) => [m.start, m.end])).toEqual([
      [0, 3],
      [4, 7],
    ]);
  });

  it('returns only the first match without the g flag', () => {
    expect(findMatches('\\w+', '', 'foo bar')).toHaveLength(1);
  });

  it('returns nothing for an invalid pattern instead of throwing', () => {
    expect(findMatches('(', 'g', 'abc')).toEqual([]);
  });

  describe('zero-length matches', () => {
    it('advances past a zero-length match', () => {
      const matches = findMatches('^', 'gm', 'a\nb\nc');
      expect(matches.map((m) => m.start)).toEqual([0, 2, 4]);
    });

    // Bumping lastIndex by one lands inside a surrogate pair, and the engine
    // snaps back to the start of the code point — the same empty match is
    // then found forever. Anything but a terminating call here is a hang.
    it.each(['gu', 'gv'])('terminates on an astral character with flags %s', (flags) => {
      const matches = findMatches('(?=.)', flags, '😀');
      expect(matches.map((m) => m.start)).toEqual([0]);
    });

    it('steps over astral characters by code point', () => {
      const matches = findMatches('a*', 'gu', '😀a😀');
      expect(matches.map((m) => [m.start, m.end])).toEqual([
        [0, 0],
        [2, 3],
        [3, 3],
        [5, 5],
      ]);
    });
  });

  describe('empty input', () => {
    it('matches the empty string, like the native engine', () => {
      expect(findMatches('^$', '', '')).toHaveLength(1);
      expect(findMatches('^$', 'g', '')).toHaveLength(1);
    });

    it('has nothing to match without a pattern', () => {
      expect(findMatches('', 'g', 'abc')).toEqual([]);
    });
  });

  describe('capture groups', () => {
    it.each([
      String.raw`\u0061`,
      String.raw`\u{61}`,
      String.raw`\uD835\uDC9C`,
    ])('reports the native name for escaped identifier %s', (name) => {
      const pattern = `(?<${name}>x)`;
      const native = new RegExp(pattern).exec('x')!;
      expect(findMatches(pattern, '', 'x')[0].groups[0].name).toBe(Object.keys(native.groups!)[0]);
    });
    it('reports the offsets of the groups themselves, not of equal text', () => {
      const [match] = findMatches('(\\w+)\\s(\\w+)', 'g', 'foo foo');
      expect(match.groups.map((g) => [g.start, g.end])).toEqual([
        [0, 3],
        [4, 7],
      ]);
    });

    it('names groups by position, not by captured value', () => {
      const [match] = findMatches('(?<first>a)(?<second>a)', '', 'aa');
      expect(match.groups.map((g) => g.name)).toEqual(['first', 'second']);
    });

    it('marks a group that did not participate', () => {
      const [match] = findMatches('(a)|(b)', 'g', 'b');
      expect(match.groups[0]).toMatchObject({ value: undefined, start: -1, end: -1 });
      expect(match.groups[1]).toMatchObject({ value: 'b', start: 0, end: 1 });
    });

    it('ignores parentheses that do not open a capturing group', () => {
      const [nonCapturing] = findMatches('(?:x)(?<n>y)', '', 'xy');
      expect(nonCapturing.groups).toHaveLength(1);
      expect(nonCapturing.groups[0]).toMatchObject({ name: 'n', start: 1, end: 2 });

      const [lookbehind] = findMatches('(?<=a)(b)', '', 'ab');
      expect(lookbehind.groups.map((g) => g.name)).toEqual([null]);

      const [escaped] = findMatches('\\((\\d)\\)', '', '(7)');
      expect(escaped.groups[0]).toMatchObject({ value: '7', start: 1, end: 2 });

      const [inClass] = findMatches('[(](\\d)', '', '(7)');
      expect(inClass.groups[0]).toMatchObject({ value: '7', start: 1, end: 2 });
    });
  });
});

describe('replaceMatches', () => {
  it('replaces every match under the g flag', () => {
    expect(replaceMatches('a', 'g', 'banana', 'o')).toBe('bonono');
  });

  it('deletes matches when the replacement is empty', () => {
    expect(replaceMatches('a', 'g', 'banana', '')).toBe('bnn');
  });

  it('expands group references', () => {
    expect(replaceMatches('(\\w+)\\s(\\w+)', '', 'foo bar', '$2 $1')).toBe('bar foo');
  });

  it('returns the input unchanged for an invalid pattern', () => {
    expect(replaceMatches('(', 'g', 'abc', 'x')).toBe('abc');
  });
});

describe('isValidRegex', () => {
  it('accepts a valid pattern', () => {
    expect(isValidRegex('\\d+', 'g')).toEqual({ valid: true });
  });

  it('reports the engine error for an invalid one', () => {
    const result = isValidRegex('(', 'g');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

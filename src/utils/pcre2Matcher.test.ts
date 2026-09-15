import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPcre2Matcher } from './pcre2Matcher';
import type { MatchInput, MatchOutcome } from './matchEngine';
import { findMatches, replaceMatches } from './regexMatcher';

let execute: (input: MatchInput) => MatchOutcome;
beforeAll(async () => {
  execute = await createPcre2Matcher(
    await readFile(new URL('../vendor/pcre2/pcre2.wasm', import.meta.url)),
  );
});

const run = (pattern: string, text: string, flags = 'g', replacement = '') =>
  execute({
    engine: 'pcre2',
    pattern,
    text,
    flags,
    replacement,
    testInputs: [],
  });

describe('the real PCRE2 10.47 WASM runtime', () => {
  it('resets the reported match start with \\K, preserving captures outside the match', () => {
    const result = run('(foo)\\Kbar', 'foobar fooKbar');
    expect(result.validation).toEqual({ valid: true });
    expect(result.matches).toEqual([
      {
        index: 3,
        start: 3,
        end: 6,
        match: 'bar',
        groups: [{ index: 1, name: null, value: 'foo', start: 0, end: 3 }],
      },
    ]);
    expect(result.replacedText).toBe('foo fooKbar');
  });

  it.each([
    ['(?<=foo)bar', 'foobar', 'g', ['bar']],
    ['a++a', 'aaa', 'g', []],
    ['(?>a+)a', 'aaa', 'g', []],
    ['(?<pair>a(?&pair)?b)', 'aabb', 'g', ['aabb']],
    ['a # ignored\n b', 'ab', 'gx', ['ab']],
    ['a# ignored\rb', 'ab', 'gx', ['a']],
    ['a+', 'aaa', 'gU', ['a', 'a', 'a']],
    ['[a-z]+', 'AbC', 'gi', ['AbC']],
    ['^a.b$', 'x\na\nb\ny', 'gms', ['a\nb']],
    ['\\p{L}+', '汉字 café', 'gu', ['汉字', 'café']],
    ['(*SKIP)(*FAIL)', 'abc', 'g', []],
  ])('executes %s using PCRE2 semantics', (pattern, text, flags, expected) => {
    const result = run(pattern, text, flags);
    expect(result.validation?.valid).toBe(true);
    expect(result.executionError).toBeUndefined();
    expect(result.matches.map((match) => match.match)).toEqual(expected);
  });

  it('reads names and exact capture offsets from the compiled pattern', () => {
    const result = run('(?<first>ab)(?<second>ab)(?<absent>z)?', 'abab');
    expect(result.matches[0].groups).toEqual([
      { index: 1, name: 'first', value: 'ab', start: 0, end: 2 },
      { index: 2, name: 'second', value: 'ab', start: 2, end: 4 },
      { index: 3, name: 'absent', value: undefined, start: -1, end: -1 },
    ]);
  });

  it('handles duplicate names and branch-reset numbering', () => {
    expect(run('(?<x>a)|(?<x>b)', 'ab', 'gJ').matches.map((m) => m.groups)).toEqual([
      [
        { index: 1, name: 'x', value: 'a', start: 0, end: 1 },
        { index: 2, name: 'x', value: undefined, start: -1, end: -1 },
      ],
      [
        { index: 1, name: 'x', value: undefined, start: -1, end: -1 },
        { index: 2, name: 'x', value: 'b', start: 1, end: 2 },
      ],
    ]);
    expect(run('(?|(a)|(b))', 'ab').matches.map((m) => m.groups[0].value)).toEqual(['a', 'b']);
    expect(run('(?<x>a)|(?<x>b)', 'ab').validation?.valid).toBe(false);
  });

  it('uses UTF-16 offsets for astral characters and preserves embedded NULs', () => {
    expect(run('(😀)', 'x😀y', 'gu').matches[0]).toMatchObject({
      start: 1,
      end: 3,
      groups: [{ start: 1, end: 3, value: '😀' }],
    });
    expect(run('a\0b', 'xa\0by').matches[0]).toMatchObject({ start: 1, end: 4, match: 'a\0b' });
    expect(run('x', 'x', 'g', 'a\0b').replacedText).toBe('a\0b');
    expect(run('.', '\ud800').matches[0].match).toBe('\ud800');
    expect(run('.', '\ud800', 'gu').executionError).toBeDefined();
  });

  it('lets PCRE2 retry a nonempty alternative at the same position after an empty match', () => {
    expect(run('(?:|a)', 'a').matches.map((m) => [m.start, m.end])).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(run('(?:)', '😀', 'gu').matches.map((m) => m.start)).toEqual([0, 2]);
    expect(run('(?:)', '😀', 'g').matches.map((m) => m.start)).toEqual([0, 1, 2]);
    expect(run('(?:|a)', 'a', 'g', 'X').replacedText).toBe('XXX');
  });

  it('supports native PCRE2 substitutions, escaped dollars, and empty subjects', () => {
    expect(run('(?<x>a)', 'aa', 'g', `\${x}:$0:$$`).replacedText).toBe('a:a:$a:a:$');
    expect(run('a', 'aa', '', 'X').replacedText).toBe('Xa');
    expect(run('^', '', 'g', 'X').replacedText).toBe('X');
    expect(run('a', 'a', 'g', '$$&').replacedText).toBe('$&');
    const error = run('(a)', 'a', 'g', `\${missing}`);
    expect(error.replacementError).toBeDefined();
    expect(error.matches).toHaveLength(1);
    expect(error.validation?.valid).toBe(true);
  });

  it('resizes the replacement output buffer and bounds excessive output', () => {
    const result = run('a', 'aa', 'g', 'x'.repeat(3000));
    expect(result.replacementError).toBeUndefined();
    expect(result.replacedText).toBe('x'.repeat(6000));
    expect(run('a', 'a'.repeat(3000), 'g', 'x'.repeat(1000)).replacementError).toBeDefined();
  });

  it('reports compile errors separately from no-match and resets after failure', () => {
    expect(run('(', 'text').validation).toMatchObject({ valid: false, offset: 1 });
    expect(run('a', 'text').validation).toEqual({ valid: true });
    expect(run('a', 'a').matches).toHaveLength(1);
    expect(run('a', 'a', 'v').validation?.valid).toBe(false);
    expect(run('(?<=a{1,3})b', 'aaab').matches[0].match).toBe('b');
    expect(run('(?<=a+)b', 'aaab').validation?.valid).toBe(false);
  });

  it('uses the selected engine for fixed grading inputs, even when the editor text is empty', () => {
    const result = execute({
      engine: 'pcre2',
      pattern: 'foo\\Kbar',
      flags: 'g',
      text: '',
      replacement: '',
      testInputs: ['foobar', 'fooKbar'],
    });
    expect(result.testMatchCounts).toEqual([1, 0]);
  });

  it('enforces backtracking limits and recovers for the next request', () => {
    expect(run('(*NO_START_OPT)(a+)+$', `${'a'.repeat(30)}!`).timedOut).toBe(true);
    expect(run('a+', 'aaa').matches[0].match).toBe('aaa');
  });

  it('agrees with JavaScript on 600 seeded cases in their shared, nonempty syntax', () => {
    let seed = 0x52454758;
    const random = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    const atoms = ['a', 'b', '[ab]', '[A-Z]', '\\d', '.', '[^b]'];
    const repeats = ['', '+', '+?', '{1,3}', '{1,3}?'];
    const letters = ['a', 'b', 'A', 'B', '1', '2', '\n', '😀'];
    for (let i = 0; i < 600; i++) {
      const part = () => `(${atoms[random(atoms.length)]}${repeats[random(repeats.length)]})`;
      const pattern = random(2) ? `${part()}${part()}` : `(?:${part()}|${part()})`;
      const text = Array.from({ length: random(24) }, () => letters[random(letters.length)]).join(
        '',
      );
      const flags = ['g', 'gi', 'gs', 'gu', 'gisu'][random(5)];
      const actual = run(pattern, text, flags, 'X');
      expect(actual.validation?.valid, `${pattern}/${flags}`).toBe(true);
      expect(actual.matches, `${pattern}/${flags} on ${JSON.stringify(text)}`).toEqual(
        findMatches(pattern, flags, text),
      );
      expect(actual.replacedText).toBe(replaceMatches(pattern, flags, text, 'X'));
    }
  });
});

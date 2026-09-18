import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { parsePcre2 } from './pcre2Parser';
import { editPcre2Node, pcre2EditTarget } from './pcre2PatternEditor';
import { createPcre2Matcher } from './pcre2Matcher';
import type { ASTNode } from '../types/regex';

let execute: Awaited<ReturnType<typeof createPcre2Matcher>>;
beforeAll(async () => {
  execute = await createPcre2Matcher(
    await readFile(new URL('../vendor/pcre2/pcre2.wasm', import.meta.url)),
  );
});
function find(pattern: string, predicate: (n: ASTNode) => boolean, flags = '') {
  const { ast, supported } = parsePcre2(pattern, flags);
  expect(supported).toBe(true);
  const walk = (n: ASTNode): ASTNode | undefined =>
    predicate(n) ? n : n.children?.map(walk).find(Boolean);
  return { ast, node: walk(ast)! };
}
function matches(pattern: string, text: string, flags = '') {
  const outcome = execute({
    pattern,
    text,
    flags,
    replacement: '$0',
    testInputs: [],
    engine: 'pcre2',
  });
  expect(outcome.validation?.valid, outcome.validation?.error).toBe(true);
  expect(outcome.executionError).toBeUndefined();
  return outcome.matches.map((m) => m.match);
}

describe('lossless PCRE2 visual editing', () => {
  it('edits the visible literal run and repeats the whole replacement', () => {
    const pattern = '^abc$';
    const { ast, node } = find(pattern, (n) => n.type === 'literal');
    expect(pcre2EditTarget(ast, node.id)).toBe(node);
    const next = editPcre2Node(pattern, node, 'x.y #', '+');
    expect(matches(next, 'x.y #x.y #', 'x')).toEqual(['x.y #x.y #']);
    expect(matches(next, 'xay #', 'x')).toEqual([]);
  });
  it.each(['x', 'xU', ''])('preserves comments and exact suffix boundaries under %s', (flags) => {
    const pattern = '^(?:a(?# keep this){ 1, 3 }+)$';
    const { node } = find(pattern, (n) => n.type === 'quantifier', flags);
    const next = editPcre2Node(pattern, node, 'a', '{,2}?');
    expect(next).toBe('^(?:a(?# keep this){,2}?)$');
    expect(matches(next, 'aa', flags)).toEqual(['aa']);
    expect(matches(next, 'aaa', flags)).toEqual([]);
  });
  it('preserves x-mode trivia and can remove an existing possessive quantifier', () => {
    const pattern = '^a # untouched\n ++$';
    const { node, ast } = find(pattern, (n) => n.type === 'literal', 'x');
    const target = pcre2EditTarget(ast, node.id)!;
    const next = editPcre2Node(pattern, target, 'bc', '');
    expect(next).toBe('^(?:bc) # untouched\n $');
    expect(matches(next, 'bc', 'x')).toEqual(['bc']);
  });
  it.each([
    '^\\Qab.\\E+$',
    '^\\Qab.\\E(?#suffix)+$',
  ])('escapes edited quoted text without changing the original quote scope: %s', (pattern) => {
    const { node } = find(pattern, (n) => n.type === 'quantifier');
    const next = editPcre2Node(pattern, node, 'x\\Ey', '{2}');
    expect(next.startsWith('^\\Qab')).toBe(true);
    expect(matches(next, 'abx\\Eyx\\Ey')).toEqual(['abx\\Eyx\\Ey']);
  });
  it('adds repetition inside an unterminated quoted span without exposing its neighbours', () => {
    const pattern = '\\Q(a)+#';
    const { node } = find(pattern, (n) => n.type === 'literal', 'x');
    const next = editPcre2Node(pattern, node, '(b)*#', '+');
    expect(matches(next, '(b)*#(b)*#', 'x')).toEqual(['(b)*#(b)*#']);
  });
  it('keeps capture numbering and native POSIX classes while editing', () => {
    const pattern = '(a)[[:alpha:]]++(b)';
    const { node } = find(pattern, (n) => n.type === 'quantifier');
    const next = editPcre2Node(pattern, node, '[[:digit:]]', '{2}');
    expect(next).toBe('(a)[[:digit:]]{2}(b)');
    expect(matches(next, 'a12b')).toEqual(['a12b']);
    expect(() => editPcre2Node(pattern, node, '[0-9]|(z)', '+')).toThrow('class');
    expect(() => editPcre2Node(pattern, node, '[0-9]', '*foo')).toThrow('quantifier');
  });
  it('compiles edits without executing catastrophic inputs or replacement syntax', () => {
    const outcome = execute({
      engine: 'pcre2',
      validateOnly: true,
      pattern: '(*NO_START_OPT)(a+)+$',
      text: `${'a'.repeat(100)}!`,
      flags: '',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: native PCRE2 replacement syntax.
      replacement: '${absent}',
      testInputs: ['a'],
    });
    expect(outcome).toMatchObject({
      validation: { valid: true },
      timedOut: false,
      matches: [],
      testMatchCounts: [],
    });
    expect(outcome.replacementError).toBeUndefined();
    const invalid = execute({
      engine: 'pcre2',
      validateOnly: true,
      pattern: '[z-a]',
      text: '',
      flags: '',
      replacement: '',
      testInputs: [],
    });
    expect(invalid.validation?.valid).toBe(false);
  });
  it('validates new conditional and long-form diagrams against real PCRE2', () => {
    for (const pattern of [
      '(?(?=(a|b))(a)|(c))',
      '(*atomic:a|b)',
      '(*pla:a)a',
      'a(*plb:a)',
      '(?(*pla:a)a|b)',
      '(?(VERSION>=10.47)a|b)',
    ]) {
      expect(parsePcre2(pattern).supported, pattern).toBe(true);
      expect(matches(pattern, 'a')).toEqual(['a']);
    }
  });
  it('keeps escaped literal edits selectable for a second edit', () => {
    const original = '^abc$';
    const { node } = find(original, (n) => n.type === 'literal');
    const next = editPcre2Node(original, node, 'x.y #', '+');
    const second = find(next, (n) => n.type === 'literal');
    expect(second.node.value).toBe('x.y #');
    const final = editPcre2Node(next, pcre2EditTarget(second.ast, second.node.id)!, 'a*b', '');
    expect(matches(final, 'a*ba*b')).toEqual(['a*ba*b']);
  });
  it('round-trips 600 seeded literal edits through native PCRE2', () => {
    let seed = 0x2cfe197;
    const random = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    const alphabet = [
      'a',
      'E',
      '\\',
      '.',
      '*',
      '?',
      '(',
      ')',
      '[',
      ']',
      '{',
      '}',
      '#',
      ' ',
      '\t',
      '\n',
      '\0',
      '汉',
      '😀',
    ];
    for (let i = 0; i < 600; i++) {
      const value = Array.from(
        { length: random(6) + 1 },
        () => alphabet[random(alphabet.length)],
      ).join('');
      const flags = ['', 'x', 'u', 'xu', 'xU'][random(5)];
      const quote = random(2) === 0;
      const pattern = quote ? '^\\Qab.\\E(?# untouched)+$' : '^(?:a(?# untouched)+)$';
      const { node } = find(pattern, (n) => n.type === 'quantifier', flags);
      const next = editPcre2Node(pattern, node, value, '{2}');
      const expected = (quote ? 'ab' : '') + value.repeat(2);
      expect(matches(next, expected, flags), next).toEqual([expected]);
    }
  });
  it('rejects stale source ranges', () => {
    const { node } = find('abc', (n) => n.type === 'literal');
    expect(() => editPcre2Node('xyz', node, 'a', '+')).toThrow('stale');
  });
});

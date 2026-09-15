import { describe, expect, it } from 'vitest';
import type { ASTNode } from '../types/regex';
import { parsePcre2 } from './pcre2Parser';
import { buildIR } from './diagramIR';
import { layoutAST } from './diagramLayout';
import { parseRegex } from './regexParser';

function nodes(pattern: string, flags = '') {
  const result = parsePcre2(pattern, flags);
  expect(result.supported, result.reason).toBe(true);
  const out: ASTNode[] = [];
  const visit = (node: ASTNode) => {
    out.push(node);
    node.children?.forEach(visit);
  };
  visit(result.ast);
  for (const node of out) expect(pattern.slice(node.start, node.end)).toBe(node.raw);
  return out;
}

describe('PCRE2 visual parser', () => {
  it('distinguishes resets, atomic groups and possessive repetition', () => {
    const all = nodes('(foo)\\K(?>bar)++');
    expect(all.find((n) => n.type === 'resetStart')?.raw).toBe('\\K');
    expect(all.find((n) => n.type === 'quantifier')?.quantifier).toMatchObject({
      min: 1,
      max: null,
      possessive: true,
      lazy: false,
    });
    const layout = layoutAST(parsePcre2('(foo)\\K(?>bar)++').ast);
    expect(layout.texts.map((t) => t.text)).toContain('\\K · Reset match start');
    expect(layout.texts.map((t) => t.text)).toContain('Atomic');
    expect(layout.badges.map((t) => t.text)).toContain('1..∞ (possessive)');
  });
  it('handles scoped x/xx, comments, quoted literals, and escaped spaces', () => {
    const all = nodes('(?x:a # ) ignored\n b)(?-x: c )\\ d');
    expect(
      all
        .filter((n) => n.type === 'literal')
        .map((n) => n.value)
        .join(''),
    ).toBe('ab c  d');
    expect(
      nodes('\\Qa+b #()\\E+', 'x')
        .filter((n) => n.type === 'literal')
        .map((n) => n.value)
        .join(''),
    ).toBe('a+b #()');
    expect(nodes('a(?# comment)+').find((n) => n.type === 'quantifier')?.raw).toBe(
      'a(?# comment)+',
    );
    expect(nodes('(?xx)[ a [:digit:] ]').find((n) => n.type === 'pcreEscape')?.raw).toBe(
      '[ a [:digit:] ]',
    );
  });
  it('honors ungreedy defaults and restores options outside scoped groups', () => {
    expect(
      nodes('a+ b+? c++', 'xU')
        .filter((n) => n.quantifier)
        .map((n) => [n.quantifier?.lazy, n.quantifier?.possessive]),
    ).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    expect(
      nodes('(?U:a+)b+')
        .filter((n) => n.quantifier)
        .map((n) => n.quantifier?.lazy),
    ).toEqual([true, false]);
    expect(nodes('(?x)a #comment\n +').find((n) => n.quantifier)?.quantifier?.min).toBe(1);
  });
  it('numbers branch-reset groups and respects no-auto-capture', () => {
    expect(
      nodes('(?|(a)|(b)(c))(d)')
        .filter((n) => n.groupIndex)
        .map((n) => n.groupIndex),
    ).toEqual([1, 1, 2, 3]);
    expect(
      nodes('(?n)(a)(?<x>b)(?-n:(c))(d)')
        .filter((n) => n.groupIndex)
        .map((n) => n.groupIndex),
    ).toEqual([1, 2]);
  });
  it('shows recursive calls without expanding them, and distinguishes explicit references', () => {
    for (const pattern of [
      '(?R)',
      '(?0)',
      '(?1)',
      '(?-1)',
      '(?&pair)',
      '(?P>pair)',
      '\\g<pair>',
      "\\g'pair'",
    ]) {
      expect(nodes(pattern).some((n) => n.type === 'subroutine')).toBe(true);
    }
    for (const pattern of ['\\g{1}', '\\g{-1}', '\\k<pair>', "\\k'pair'", '(?P=pair)']) {
      expect(nodes(pattern).some((n) => n.type === 'backreference')).toBe(true);
    }
  });
  it('shows conditional branches and non-executing definitions', () => {
    const all = nodes('(a)?(?(1)b|c)(?(DEFINE)(?<pair>a(?&pair)?b))');
    expect(all.filter((n) => n.type === 'conditional').map((n) => n.value)).toEqual([
      '1',
      'DEFINE',
    ]);
    const layout = layoutAST(parsePcre2('(?(1)b|c)').ast);
    expect(layout.texts.map((t) => t.text)).toEqual(
      expect.arrayContaining(['If 1', 'Then', 'Else']),
    );
  });
  it('preserves complete PCRE2 classes and escapes', () => {
    for (const pattern of [
      '[[:alpha:]]+',
      '[^a]',
      '[]a]',
      '[\\Q]a\\E]',
      '\\x{1F600}+',
      '\\p{L}+',
      '\\o{123}+',
      '\\N{U+0041}',
    ]) {
      const all = nodes(pattern);
      expect(all.some((n) => n.type === 'pcreEscape')).toBe(true);
    }
    expect(nodes('😀+', 'u').find((n) => n.type === 'literal')?.value).toBe('😀');
  });
  it('declines unsupported or excessive syntax without throwing', () => {
    for (const pattern of [
      '(?C1)a',
      '(?(?=a)b|c)',
      '(?i:a',
      '(?*a)',
      '\\1234+',
      '(*atomic:a)',
      '(*CR)a#x',
      '('.repeat(100) + 'a' + ')'.repeat(100),
      'a'.repeat(3000),
    ]) {
      expect(parsePcre2(pattern).supported, pattern).toBe(false);
    }
  });
  it('keeps negated single-element JS classes negated in the diagram', () => {
    for (const pattern of ['[^a]', '[^a-z]', '[^\\d]'])
      expect(buildIR(parseRegex(pattern))).toMatchObject({ type: 'CharClass', negated: true });
  });
});

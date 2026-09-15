import { describe, expect, it } from 'vitest';
import type { ASTNode } from '../types/regex';
import { parseRegex } from './regexParser';

/** Flatten the tree into `type(raw)` strings, depth-first. */
function shape(node: ASTNode): string {
  const children = node.children?.length ? `[${node.children.map(shape).join(' ')}]` : '';
  return `${node.type}(${node.raw})${children}`;
}

describe('parseRegex', () => {
  it('reconstructs the source from the node spans', () => {
    for (const pattern of [
      'abc',
      'a|b',
      '(a)(b)',
      '[a-z]+',
      '\\d{2,3}',
      '(?<year>\\d{4})-(?<month>\\d{2})',
      'a(?=b)c',
      '[\\]]',
    ]) {
      expect(parseRegex(pattern).raw).toBe(pattern);
    }
  });

  describe('escape sequences', () => {
    // Stopping after the first character left the payload to be parsed as
    // literals: `\x41+` came out as `\x`, `4` and `1+`, so the quantifier
    // was bound to the wrong atom.
    it.each([
      ['\\x41', '\\x41'],
      ['\\u0041', '\\u0041'],
      ['\\u{1F600}', '\\u{1F600}'],
      ['\\p{L}', '\\p{L}'],
      ['\\P{L}', '\\P{L}'],
      ['\\cJ', '\\cJ'],
      ['\\d', '\\d'],
      ['\\0', '\\0'],
    ])('keeps %s as a single escape node', (pattern, raw) => {
      const node = parseRegex(pattern);
      expect(node.type).toBe('escape');
      expect(node.raw).toBe(raw);
    });

    it('binds a quantifier to the whole escape', () => {
      expect(shape(parseRegex('\\x41+'))).toBe('quantifier(\\x41+)[escape(\\x41)]');
      expect(shape(parseRegex('\\p{L}*'))).toBe('quantifier(\\p{L}*)[escape(\\p{L})]');
    });

    it('keeps a partial escape intact rather than consuming more', () => {
      // Too few hex digits: `\x` is a literal `x` to the engine.
      expect(parseRegex('\\xZZ').children?.[0].raw).toBe('\\x');
    });

    it('reads multi-character escapes inside a character class', () => {
      const node = parseRegex('[\\x41-\\x5A]');
      expect(node.type).toBe('characterClass');
      expect(node.children).toHaveLength(1);
      expect(node.children?.[0]).toMatchObject({ type: 'range', raw: '\\x41-\\x5A' });
    });
  });

  describe('backreferences', () => {
    it('reads all digits of a numbered backreference', () => {
      const node = parseRegex('\\10');
      expect(node).toMatchObject({ type: 'backreference', value: '10', raw: '\\10' });
    });

    it('recognises a named backreference', () => {
      const node = parseRegex('\\k<name>');
      expect(node).toMatchObject({
        type: 'backreference',
        value: 'name',
        groupName: 'name',
        raw: '\\k<name>',
      });
    });
  });

  describe('groups', () => {
    it('numbers capturing groups and skips non-capturing ones', () => {
      const ast = parseRegex('(a)(?:b)(?<c>c)');
      const indices = (ast.children ?? []).map((n) => n.groupIndex);
      expect(indices).toEqual([1, undefined, 2]);
    });

    it('keeps the whole body as children', () => {
      expect(parseRegex('(abc)').children?.map((c) => c.raw)).toEqual(['a', 'b', 'c']);
    });
  });
});

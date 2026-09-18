import { describe, expect, it } from 'vitest';
import type { ASTNode } from '../types/regex';
import { parseRegex } from './regexParser';
import { buildIR } from './diagramIR';

/** Flatten the tree into `type(raw)` strings, depth-first. */
function shape(node: ASTNode): string {
  const children = node.children?.length ? `[${node.children.map(shape).join(' ')}]` : '';
  return `${node.type}(${node.raw})${children}`;
}

describe('parseRegex', () => {
  it.each(['u', 'v'])('keeps Unicode atoms and source spans intact with %s', (flags) => {
    const ast = parseRegex('😀+', flags);
    expect(ast).toMatchObject({
      type: 'quantifier',
      start: 0,
      end: 3,
      children: [{ type: 'literal', value: '😀', raw: '😀', start: 0, end: 2 }],
    });
    expect(parseRegex('[😀-🙏]', flags).children?.[0]).toMatchObject({
      type: 'range',
      children: [
        { value: '😀', start: 1, end: 3 },
        { value: '🙏', start: 4, end: 6 },
      ],
    });
    expect(parseRegex('😀+').children?.[0]).toMatchObject({ start: 0, end: 1 });
  });

  it('decodes group and reference identifiers while preserving escaped source text', () => {
    const pattern = String.raw`(?<\u0061>x)\k<\u{61}>`;
    const ast = parseRegex(pattern);
    expect(ast.raw).toBe(pattern);
    expect(ast.children?.map((node) => node.groupName)).toEqual(['a', 'a']);
    expect(ast.children?.[0].raw).toBe(String.raw`(?<\u0061>x)`);
  });

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
      '(?i)abc',
      '(?i:ab)',
      '(?>ab)',
      '(?P<n>a)(?P=n)',
      'a)b',
      '(abc',
      '[a-\\d]',
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
      const node = parseRegex(pattern, 'u');
      expect(node.type).toBe('escape');
      expect(node.raw).toBe(raw);
    });

    it('binds a quantifier to the whole escape', () => {
      expect(shape(parseRegex('\\x41+'))).toBe('quantifier(\\x41+)[escape(\\x41)]');
      expect(shape(parseRegex('\\p{L}*', 'u'))).toBe('quantifier(\\p{L}*)[escape(\\p{L})]');
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
      const node = parseRegex('\\10(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)').children?.[0];
      expect(node).toMatchObject({ type: 'backreference', value: '10', raw: '\\10' });
    });

    it.each(['', 'u', 'v'])('counts forward and named captures with flags %s', (flags) => {
      const ast = parseRegex('\\2(a)(?:b)(?=c)(?!d)(?<=e)(?<!f)(?<last>g)', flags);
      expect(ast.children?.[0]).toMatchObject({ type: 'backreference', value: '2' });
    });

    it.each([
      String.raw`\1\(a\)`,
      String.raw`\1[(]`,
      String.raw`\1[\](]`,
      String.raw`\1(?:a)(?=b)(?!c)(?<=d)(?<!e)`,
    ])('does not count escaped parentheses or non-capturing groups in %s', (pattern) => {
      expect(parseRegex(pattern).children?.[0]).toMatchObject({ type: 'escape', raw: '\\1' });
    });

    it.each([
      ['\\1', ['\\1']],
      ['\\8', ['\\8']],
      ['\\9', ['\\9']],
      ['\\118{2}', ['\\11', '8{2}']],
      ['\\1234+', ['\\123', '4+']],
      ['\\400{2}', ['\\40', '0{2}']],
      ['\\777+', ['\\77', '7+']],
      ['\\0123{2}', ['\\012', '3{2}']],
      ['\\08+', ['\\0', '8+']],
    ])('splits legacy decimal escape %s at the native atom boundary', (pattern, rawAtoms) => {
      const ast = parseRegex(pattern);
      const atoms = ast.type === 'sequence' ? ast.children! : [ast];
      expect(atoms.map((atom) => atom.raw)).toEqual(rawAtoms);
      expect(atoms[0].type).toBe('escape');
      for (const atom of atoms) {
        expect(pattern.slice(atom.start, atom.end)).toBe(atom.raw);
      }
      if (atoms.length > 1) expect(atoms[1].type).toBe('quantifier');
    });

    it.each(['u', 'v'])('keeps invalid Unicode references out of capture nodes: %s', (flags) => {
      expect(parseRegex('\\118', flags)).toMatchObject({ type: 'escape', raw: '\\118' });
      expect(parseRegex('\\0123', flags).children?.map((node) => node.raw)).toEqual([
        '\\0',
        '1',
        '2',
        '3',
      ]);
    });

    it('reads octal ranges inside character classes even when captures exist', () => {
      const ast = parseRegex('(a)[\\141-\\143]');
      expect(ast.children?.[1].children?.[0]).toMatchObject({
        type: 'range',
        raw: '\\141-\\143',
        children: [{ raw: '\\141' }, { raw: '\\143' }],
      });
    });

    it('recognises a named backreference', () => {
      const node = parseRegex('(?<name>a)\\k<name>').children?.[1];
      expect(node).toMatchObject({
        type: 'backreference',
        value: 'name',
        groupName: 'name',
        raw: '\\k<name>',
      });
    });
  });

  describe('Unicode sets and legacy identity escapes', () => {
    it.each([
      '[a&&[ab]]',
      '[[a-z]--[aeiou]]',
      String.raw`[\q{ab|cd}]`,
      String.raw`[\q{a\]b|c}]`,
      String.raw`[\p{RGI_Emoji}]`,
    ])('keeps %s intact in the AST and diagram', (pattern) => {
      const ast = parseRegex(`${pattern}+x`, 'v');
      const node = ast.children?.[0].children?.[0];
      expect(node).toMatchObject({
        type: 'characterClass',
        unicodeSet: true,
        raw: pattern,
        start: 0,
        end: pattern.length,
      });
      expect(ast.children?.[1]).toMatchObject({ type: 'literal', raw: 'x' });
      expect(buildIR(node!)).toMatchObject({ type: 'Token', kind: 'unicodeSet', label: pattern });
    });

    it.each(['u', 'p', 'P'])('binds legacy \\%s{2} to the identity escape', (letter) => {
      const node = parseRegex(`\\${letter}{2}`);
      expect(node).toMatchObject({
        type: 'quantifier',
        quantifier: { min: 2, max: 2 },
        children: [{ type: 'escape', raw: `\\${letter}` }],
      });
    });

    it('treats \\k as an identity escape only when named groups are absent', () => {
      expect(parseRegex(String.raw`\k<a>`).children?.[0]).toMatchObject({
        type: 'escape',
        raw: String.raw`\k`,
      });
      expect(parseRegex(String.raw`\k<a>(?<a>x)`).children?.[0]).toMatchObject({
        type: 'backreference',
        groupName: 'a',
      });
      expect(parseRegex(String.raw`\k<a>[(?<a>)]`).children?.[0]).toMatchObject({ type: 'escape' });
    });
  });

  describe('syntax from other flavours', () => {
    it('reads inline flags as their own node, not a capturing group', () => {
      const ast = parseRegex('(?i)abc');
      expect(ast.children?.[0]).toMatchObject({
        type: 'inlineFlags',
        value: 'i',
        raw: '(?i)',
      });
    });

    it('reads a flag set with a negation', () => {
      expect(parseRegex('(?im-sx)a').children?.[0]).toMatchObject({
        type: 'inlineFlags',
        value: 'im-sx',
      });
    });

    it('treats scoped flags as a non-capturing group', () => {
      const ast = parseRegex('(?i:ab)');
      expect(ast).toMatchObject({ type: 'nonCapturingGroup', openLen: 4 });
      expect(ast.children?.map((c) => c.raw)).toEqual(['a', 'b']);
    });

    it('reads an atomic group', () => {
      const ast = parseRegex('(?>ab)');
      expect(ast).toMatchObject({ type: 'atomicGroup', openLen: 3 });
      expect(ast.children?.map((c) => c.raw)).toEqual(['a', 'b']);
    });

    it("reads Python's named group and backreference", () => {
      const group = parseRegex('(?P<n>a)');
      expect(group).toMatchObject({
        type: 'namedGroup',
        groupName: 'n',
        groupIndex: 1,
        openLen: 6,
      });

      const backref = parseRegex('(?P=n)');
      expect(backref).toMatchObject({ type: 'backreference', groupName: 'n', value: 'n' });
    });
  });

  describe('unbalanced input', () => {
    it('keeps a stray closing parenthesis and everything after it', () => {
      // The trailing `b` used to be dropped, so the diagram quietly showed
      // less than the user had typed.
      const ast = parseRegex('a)b');
      expect(ast.children?.map((c) => c.raw)).toEqual(['a', ')', 'b']);
      expect(ast.raw).toBe('a)b');
    });

    it('tolerates a group that is never closed', () => {
      const ast = parseRegex('(abc');
      expect(ast).toMatchObject({ type: 'group', raw: '(abc' });
      expect(ast.children?.map((c) => c.raw)).toEqual(['a', 'b', 'c']);
    });

    it('parses a lone closing parenthesis', () => {
      expect(parseRegex(')')).toMatchObject({ type: 'literal', raw: ')' });
    });
  });

  describe('character classes', () => {
    it('does not build a range out of a shorthand class', () => {
      // `[a-\d]` is a, a literal dash, and \d — `\d` has no code point to
      // count to.
      const ast = parseRegex('[a-\\d]');
      expect(ast.children?.map((c) => `${c.type}:${c.raw}`)).toEqual([
        'literal:a',
        'literal:-',
        'escape:\\d',
      ]);
    });

    it('still builds ordinary ranges', () => {
      expect(parseRegex('[a-z]').children?.[0]).toMatchObject({ type: 'range', raw: 'a-z' });
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

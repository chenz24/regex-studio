import { describe, expect, it } from 'vitest';
import { findNodeById, diagramNodeMatches } from '../lib/ast';
import { buildIR, type IR } from './diagramIR';
import { parseRegex } from './regexParser';
import { deleteNodeFromPattern, replaceNodeInPattern, wrapNodeInGroup } from './patternEditor';

function literals(ir: IR): IR[] {
  if (ir.type === 'Literal') return [ir];
  if ('child' in ir) return literals(ir.child);
  if ('children' in ir) return ir.children.flatMap(literals);
  if ('alts' in ir) return ir.alts.flatMap(literals);
  return [];
}

describe('merged literal source mapping', () => {
  it.each([
    'abc',
    'a\\.b',
    'a[b]c',
    '(?:abc)',
    '^abc$',
    'ab|cd',
    '😀abc',
  ])('edits the entire visible literal in %s', (pattern) => {
    const ast = parseRegex(pattern, 'u');
    for (const literal of literals(buildIR(ast))) {
      const node = findNodeById(ast, literal.id);
      expect(node).not.toBeNull();
      if (!node) continue;
      expect(node.raw).toBe(pattern.slice(node.start, node.end));
      const before = pattern.slice(0, node.start);
      const after = pattern.slice(node.end);
      expect(replaceNodeInPattern(pattern, node, 'XYZ')).toBe(`${before}XYZ${after}`);
      expect(deleteNodeFromPattern(pattern, node)).toBe(before + after);
      expect(wrapNodeInGroup(pattern, node, 'nonCapturing')).toBe(
        `${before}(?:${node.raw})${after}`,
      );
      for (const child of node.children ?? [node]) {
        expect(diagramNodeMatches(literal.id, new Set([child.id]))).toBe(true);
      }
    }
  });

  it('rejects missing or noncontiguous merged source nodes', () => {
    const ast = parseRegex('abc');
    expect(findNodeById(ast, 'merged:missing,missing')).toBeNull();
    expect(findNodeById(ast, `merged:${ast.children![0].id},${ast.children![2].id}`)).toBeNull();
  });
});

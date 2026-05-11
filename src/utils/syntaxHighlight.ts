import type { ASTNode, ASTNodeType } from '../types/regex';

export interface HighlightToken {
  start: number;
  end: number;
  type: ASTNodeType;
  nodeId: string;
  color: string;
  darkColor: string;
}

const TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  group: { light: '#059669', dark: '#34d399' },
  nonCapturingGroup: { light: '#059669', dark: '#34d399' },
  namedGroup: { light: '#059669', dark: '#34d399' },
  lookahead: { light: '#0891b2', dark: '#22d3ee' },
  negativeLookahead: { light: '#0891b2', dark: '#22d3ee' },
  lookbehind: { light: '#0891b2', dark: '#22d3ee' },
  negativeLookbehind: { light: '#0891b2', dark: '#22d3ee' },
  characterClass: { light: '#d97706', dark: '#fbbf24' },
  negatedCharacterClass: { light: '#d97706', dark: '#fbbf24' },
  escape: { light: '#ea580c', dark: '#fb923c' },
  dot: { light: '#ea580c', dark: '#fb923c' },
  anchor: { light: '#e11d48', dark: '#fb7185' },
  quantifier: { light: '#2563eb', dark: '#60a5fa' },
  alternation: { light: '#2563eb', dark: '#60a5fa' },
  backreference: { light: '#7c3aed', dark: '#a78bfa' },
  range: { light: '#d97706', dark: '#fbbf24' },
  literal: { light: '#374151', dark: '#d1d5db' },
  sequence: { light: '#374151', dark: '#d1d5db' },
};

function getColor(type: ASTNodeType): { light: string; dark: string } {
  return TYPE_COLORS[type] || TYPE_COLORS.literal;
}

export function collectLeafTokens(node: ASTNode): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  collectTokens(node, tokens);
  tokens.sort((a, b) => a.start - b.start);

  const merged: HighlightToken[] = [];
  for (const t of tokens) {
    const last = merged[merged.length - 1];
    if (last && t.start < last.end) continue;
    merged.push(t);
  }
  return merged;
}

function collectTokens(node: ASTNode, tokens: HighlightToken[]): void {
  const col = getColor(node.type);

  if (node.type === 'sequence') {
    for (const child of node.children || []) {
      collectTokens(child, tokens);
    }
    return;
  }

  if (node.type === 'quantifier') {
    const child = node.children?.[0];
    if (child) {
      collectTokens(child, tokens);
    }
    const qRaw = node.quantifier?.raw || '';
    if (qRaw) {
      const qStart = node.end - qRaw.length;
      tokens.push({
        start: qStart,
        end: node.end,
        type: 'quantifier',
        nodeId: node.id,
        color: TYPE_COLORS.quantifier.light,
        darkColor: TYPE_COLORS.quantifier.dark,
      });
    }
    return;
  }

  if (node.type === 'alternation') {
    const children = node.children || [];
    for (let i = 0; i < children.length; i++) {
      collectTokens(children[i], tokens);
      if (i < children.length - 1) {
        const childEnd = children[i].end;
        tokens.push({
          start: childEnd,
          end: childEnd + 1,
          type: 'alternation',
          nodeId: node.id,
          color: col.light,
          darkColor: col.dark,
        });
      }
    }
    return;
  }

  if (
    node.type === 'group' ||
    node.type === 'nonCapturingGroup' ||
    node.type === 'namedGroup' ||
    node.type === 'lookahead' ||
    node.type === 'negativeLookahead' ||
    node.type === 'lookbehind' ||
    node.type === 'negativeLookbehind'
  ) {
    const openLen = getGroupOpenLen(node);
    tokens.push({
      start: node.start,
      end: node.start + openLen,
      type: node.type,
      nodeId: node.id,
      color: col.light,
      darkColor: col.dark,
    });
    for (const child of node.children || []) {
      collectTokens(child, tokens);
    }
    if (node.end > 0) {
      tokens.push({
        start: node.end - 1,
        end: node.end,
        type: node.type,
        nodeId: node.id,
        color: col.light,
        darkColor: col.dark,
      });
    }
    return;
  }

  if (node.type === 'characterClass' || node.type === 'negatedCharacterClass') {
    tokens.push({
      start: node.start,
      end: node.end,
      type: node.type,
      nodeId: node.id,
      color: col.light,
      darkColor: col.dark,
    });
    return;
  }

  tokens.push({
    start: node.start,
    end: node.end,
    type: node.type,
    nodeId: node.id,
    color: col.light,
    darkColor: col.dark,
  });
}

function getGroupOpenLen(node: ASTNode): number {
  switch (node.type) {
    case 'group':
      return 1;
    case 'nonCapturingGroup':
      return 3;
    case 'lookahead':
      return 3;
    case 'negativeLookahead':
      return 3;
    case 'lookbehind':
      return 4;
    case 'negativeLookbehind':
      return 4;
    case 'namedGroup':
      return 3 + (node.groupName?.length || 0) + 1;
    default:
      return 1;
  }
}

export function collectAllNodeIds(node: ASTNode): Map<string, ASTNode> {
  const map = new Map<string, ASTNode>();
  function walk(n: ASTNode) {
    map.set(n.id, n);
    for (const child of n.children || []) {
      walk(child);
    }
  }
  walk(node);
  return map;
}

export function findAncestorIds(node: ASTNode, targetId: string): Set<string> {
  const result = new Set<string>();
  function walk(n: ASTNode, ancestors: string[]): boolean {
    if (n.id === targetId) {
      for (const a of ancestors) result.add(a);
      result.add(n.id);
      return true;
    }
    for (const child of n.children || []) {
      if (walk(child, [...ancestors, n.id])) return true;
    }
    return false;
  }
  walk(node, []);
  return result;
}

export function findNodeAtPosition(node: ASTNode, position: number): ASTNode | null {
  if (position < node.start || position >= node.end) return null;

  if (node.children) {
    for (const child of node.children) {
      const found = findNodeAtPosition(child, position);
      if (found) return found;
    }
  }

  if (node.type !== 'sequence') return node;
  return null;
}

import type { ASTNode } from '../types/regex';

export type IRCharItem =
  | {
      kind: 'token';
      token: 'whitespace' | 'digit' | 'word' | 'any' | 'nonDigit' | 'nonWord' | 'nonWhitespace';
      label: string;
    }
  | { kind: 'literal'; text: string }
  | { kind: 'range'; from: string; to: string };

export type IR =
  | { type: 'Start'; id: string }
  | { type: 'End'; id: string }
  | {
      type: 'Anchor';
      kind: 'begin' | 'end' | 'wordBoundary' | 'nonWordBoundary';
      label: string;
      id: string;
    }
  | { type: 'Token'; kind: string; label: string; id: string }
  | { type: 'Literal'; text: string; id: string }
  | { type: 'CharClass'; negated: boolean; items: IRCharItem[]; id: string }
  | { type: 'Sequence'; children: IR[]; id: string }
  | { type: 'Choice'; alts: IR[]; id: string }
  | {
      type: 'Group';
      capturing: boolean;
      name?: string;
      index?: number;
      child: IR;
      id: string;
      assertionType?: 'lookahead' | 'negativeLookahead' | 'lookbehind' | 'negativeLookbehind';
    }
  | { type: 'Quantifier'; min: number; max: number | null; greedy: boolean; child: IR; id: string }
  | { type: 'Backref'; ref: string; id: string };

const ESCAPE_CLASS_MAP: Record<string, { kind: string; label: string }> = {
  '\\d': { kind: 'digit', label: 'Digit' },
  '\\D': { kind: 'nonDigit', label: 'NonDigit' },
  '\\w': { kind: 'word', label: 'Word' },
  '\\W': { kind: 'nonWord', label: 'NonWord' },
  '\\s': { kind: 'whitespace', label: 'WhiteSpace' },
  '\\S': { kind: 'nonWhitespace', label: 'NonWhiteSpace' },
};

const ESCAPE_SPECIAL_MAP: Record<string, string> = {
  '\\n': 'Newline',
  '\\t': 'Tab',
  '\\r': 'Return',
  '\\0': 'Null',
  '\\f': 'FormFeed',
  '\\v': 'VertTab',
};

const ESCAPE_BOUNDARY_MAP: Record<
  string,
  { kind: 'wordBoundary' | 'nonWordBoundary'; label: string }
> = {
  '\\b': { kind: 'wordBoundary', label: 'WordBoundary' },
  '\\B': { kind: 'nonWordBoundary', label: 'NonWordBoundary' },
};

function mapCharItem(node: ASTNode): IRCharItem {
  if (node.type === 'range') {
    const from = node.children?.[0]?.value || '';
    const to = node.children?.[1]?.value || '';
    const fromDisplay = from.startsWith('\\') && from.length === 2 ? from[1] : from;
    const toDisplay = to.startsWith('\\') && to.length === 2 ? to[1] : to;
    return { kind: 'range', from: fromDisplay, to: toDisplay };
  }
  if (node.type === 'escape') {
    const cls = ESCAPE_CLASS_MAP[node.value];
    if (cls)
      return {
        kind: 'token',
        token: cls.kind as IRCharItem & { kind: 'token' } extends { token: infer T } ? T : never,
        label: cls.label,
      };
    const ch = node.value.length > 1 ? node.value[1] : node.value;
    return { kind: 'literal', text: ch };
  }
  return { kind: 'literal', text: node.value };
}

function mergeCharClassLiterals(items: IRCharItem[]): IRCharItem[] {
  const literals: string[] = [];
  const others: IRCharItem[] = [];
  for (const item of items) {
    if (item.kind === 'literal') {
      literals.push(item.text);
    } else {
      others.push(item);
    }
  }
  const result: IRCharItem[] = [];
  if (literals.length > 0) {
    result.push({ kind: 'literal', text: literals.join('') });
  }
  result.push(...others);
  return result;
}

function mergeAdjacentLiterals(nodes: IR[]): IR[] {
  const result: IR[] = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.type === 'Literal') {
      let merged = node.text;
      let lastId = node.id;
      while (i + 1 < nodes.length && nodes[i + 1].type === 'Literal') {
        i++;
        const next = nodes[i] as IR & { type: 'Literal' };
        merged += next.text;
        lastId = next.id;
      }
      result.push({
        type: 'Literal',
        text: merged,
        id: merged.length > node.text.length ? `${node.id}_${lastId}` : node.id,
      });
    } else {
      result.push(node);
    }
    i++;
  }
  return result;
}

function astToIR(node: ASTNode): IR {
  switch (node.type) {
    case 'sequence': {
      const children = mergeAdjacentLiterals((node.children || []).map(astToIR));
      if (children.length === 1) return children[0];
      return { type: 'Sequence', children, id: node.id };
    }
    case 'alternation': {
      const alts = (node.children || []).map(astToIR);
      return { type: 'Choice', alts, id: node.id };
    }
    case 'quantifier': {
      const child = node.children?.[0];
      if (!child) return { type: 'Literal', text: node.raw, id: node.id };
      const q = node.quantifier!;
      return {
        type: 'Quantifier',
        min: q.min,
        max: q.max,
        greedy: !q.lazy,
        child: astToIR(child),
        id: node.id,
      };
    }
    case 'group':
    case 'namedGroup':
      return {
        type: 'Group',
        capturing: true,
        name: node.groupName,
        index: node.groupIndex,
        child: wrapChildren(node),
        id: node.id,
      };
    case 'nonCapturingGroup':
      return {
        type: 'Group',
        capturing: false,
        child: wrapChildren(node),
        id: node.id,
      };
    case 'lookahead':
    case 'negativeLookahead':
    case 'lookbehind':
    case 'negativeLookbehind':
      return {
        type: 'Group',
        capturing: false,
        child: wrapChildren(node),
        id: node.id,
        assertionType: node.type,
      };
    case 'characterClass':
    case 'negatedCharacterClass': {
      const items = mergeCharClassLiterals((node.children || []).map(mapCharItem));
      if (items.length === 1 && items[0].kind === 'token') {
        const t = items[0] as { kind: 'token'; token: string; label: string };
        return { type: 'Token', kind: t.token, label: t.label, id: node.id };
      }
      if (items.length === 1 && items[0].kind === 'range') {
        const r = items[0] as { kind: 'range'; from: string; to: string };
        return { type: 'Token', kind: 'range', label: `${r.from}\u2013${r.to}`, id: node.id };
      }
      if (items.length === 1 && items[0].kind === 'literal') {
        const litText = (items[0] as { kind: 'literal'; text: string }).text;
        if (litText.length === 1) {
          return { type: 'Literal', text: litText, id: node.id };
        }
      }
      return {
        type: 'CharClass',
        negated: node.type === 'negatedCharacterClass',
        items,
        id: node.id,
      };
    }
    case 'dot':
      return { type: 'Token', kind: 'any', label: 'AnyChar', id: node.id };
    case 'escape': {
      const boundary = ESCAPE_BOUNDARY_MAP[node.value];
      if (boundary)
        return { type: 'Anchor', kind: boundary.kind, label: boundary.label, id: node.id };
      const cls = ESCAPE_CLASS_MAP[node.value];
      if (cls) return { type: 'Token', kind: cls.kind, label: cls.label, id: node.id };
      const special = ESCAPE_SPECIAL_MAP[node.value];
      if (special) return { type: 'Token', kind: 'special', label: special, id: node.id };
      const ch = node.value.length > 1 ? node.value[1] : node.value;
      return { type: 'Literal', text: ch, id: node.id };
    }
    case 'anchor':
      return {
        type: 'Anchor',
        kind: node.value === '^' ? 'begin' : 'end',
        label: node.value === '^' ? 'Begin' : 'End',
        id: node.id,
      };
    case 'backreference':
      return { type: 'Backref', ref: node.value, id: node.id };
    case 'literal':
      return { type: 'Literal', text: node.value, id: node.id };
    default:
      return { type: 'Literal', text: node.raw || node.value, id: node.id };
  }
}

function wrapChildren(node: ASTNode): IR {
  const children = mergeAdjacentLiterals((node.children || []).map(astToIR));
  if (children.length === 0) return { type: 'Sequence', children: [], id: `${node.id}_inner` };
  if (children.length === 1) return children[0];
  return { type: 'Sequence', children, id: `${node.id}_inner` };
}

export function buildIR(ast: ASTNode): IR {
  return astToIR(ast);
}

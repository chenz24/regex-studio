import type { ASTNode, ExplanationToken } from '../types/regex';

const ESCAPE_DESCRIPTIONS: Record<string, string> = {
  '\\d': 'Match any digit (0-9)',
  '\\D': 'Match any non-digit character',
  '\\w': 'Match any word character (a-z, A-Z, 0-9, _)',
  '\\W': 'Match any non-word character',
  '\\s': 'Match any whitespace character (space, tab, newline)',
  '\\S': 'Match any non-whitespace character',
  '\\b': 'Match a word boundary',
  '\\B': 'Match a non-word boundary position',
  '\\n': 'Match a newline character',
  '\\t': 'Match a tab character',
  '\\r': 'Match a carriage return',
  '\\f': 'Match a form feed',
  '\\v': 'Match a vertical tab',
  '\\0': 'Match a null character',
};

function quantifierDesc(node: ASTNode): string {
  const q = node.quantifier;
  if (!q) return '';
  const lazy = q.lazy
    ? ', as few times as possible (lazy)'
    : ', as many times as possible (greedy)';
  if (q.min === 0 && q.max === null) return `Match zero or more times${lazy}`;
  if (q.min === 1 && q.max === null) return `Match one or more times${lazy}`;
  if (q.min === 0 && q.max === 1) return `Match zero or one time (optional)`;
  if (q.min === q.max) return `Match exactly ${q.min} time${q.min !== 1 ? 's' : ''}`;
  if (q.max === null) return `Match ${q.min} or more times${lazy}`;
  return `Match between ${q.min} and ${q.max} times${lazy}`;
}

export function explainAST(node: ASTNode): ExplanationToken[] {
  const tokens: ExplanationToken[] = [];
  walkNode(node, tokens);
  return tokens;
}

function walkNode(node: ASTNode, tokens: ExplanationToken[]): void {
  switch (node.type) {
    case 'sequence':
      if (node.children) {
        for (const child of node.children) {
          walkNode(child, tokens);
        }
      }
      break;

    case 'literal':
      tokens.push({
        raw: node.raw,
        description: `Match the character "${node.value}" literally`,
        type: 'literal',
      });
      break;

    case 'dot':
      tokens.push({
        raw: '.',
        description: 'Match any single character (except newline, unless "s" flag is set)',
        type: 'meta',
      });
      break;

    case 'escape':
      tokens.push({
        raw: node.raw,
        description:
          ESCAPE_DESCRIPTIONS[node.value] || `Match the escaped character "${node.value.slice(1)}"`,
        type: 'escape',
      });
      break;

    case 'anchor':
      tokens.push({
        raw: node.raw,
        description:
          node.value === '^'
            ? 'Assert position at the start of the string (or line with "m" flag)'
            : 'Assert position at the end of the string (or line with "m" flag)',
        type: 'anchor',
      });
      break;

    case 'characterClass':
    case 'negatedCharacterClass': {
      const negated = node.type === 'negatedCharacterClass';
      const childDescs = (node.children || []).map((c) => {
        if (c.type === 'range') return `${c.children?.[0]?.value} to ${c.children?.[1]?.value}`;
        if (c.type === 'escape')
          return ESCAPE_DESCRIPTIONS[c.value]?.replace('Match ', '') || c.value;
        return `"${c.value}"`;
      });
      tokens.push({
        raw: node.raw,
        description: negated
          ? `Match any character NOT in: ${childDescs.join(', ')}`
          : `Match any character in: ${childDescs.join(', ')}`,
        type: 'class',
      });
      break;
    }

    case 'alternation':
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          if (i > 0) {
            tokens.push({
              raw: '|',
              description: 'OR: match the expression before or after this',
              type: 'meta',
            });
          }
          walkNode(node.children[i], tokens);
        }
      }
      break;

    case 'group':
      tokens.push({
        raw: node.raw,
        description: `Capturing group #${node.groupIndex}: groups matched text for back-references`,
        type: 'group',
        children: node.children ? explainChildren(node.children) : undefined,
      });
      break;

    case 'nonCapturingGroup':
      tokens.push({
        raw: node.raw,
        description: 'Non-capturing group: groups the expression without capturing',
        type: 'group',
        children: node.children ? explainChildren(node.children) : undefined,
      });
      break;

    case 'namedGroup':
      tokens.push({
        raw: node.raw,
        description: `Named capturing group "${node.groupName}" (#${node.groupIndex})`,
        type: 'group',
        children: node.children ? explainChildren(node.children) : undefined,
      });
      break;

    case 'lookahead':
      tokens.push({
        raw: node.raw,
        description: 'Positive lookahead: asserts what follows matches',
        type: 'group',
        children: node.children ? explainChildren(node.children) : undefined,
      });
      break;

    case 'negativeLookahead':
      tokens.push({
        raw: node.raw,
        description: 'Negative lookahead: asserts what follows does NOT match',
        type: 'group',
        children: node.children ? explainChildren(node.children) : undefined,
      });
      break;

    case 'lookbehind':
      tokens.push({
        raw: node.raw,
        description: 'Positive lookbehind: asserts what precedes matches',
        type: 'group',
        children: node.children ? explainChildren(node.children) : undefined,
      });
      break;

    case 'negativeLookbehind':
      tokens.push({
        raw: node.raw,
        description: 'Negative lookbehind: asserts what precedes does NOT match',
        type: 'group',
        children: node.children ? explainChildren(node.children) : undefined,
      });
      break;

    case 'quantifier':
      if (node.children && node.children.length > 0) {
        walkNode(node.children[0], tokens);
      }
      tokens.push({
        raw: node.quantifier?.raw || node.value,
        description: quantifierDesc(node),
        type: 'quantifier',
      });
      break;

    case 'backreference':
      tokens.push({
        raw: node.raw,
        description: `Back-reference to group #${node.value}`,
        type: 'meta',
      });
      break;

    default:
      tokens.push({
        raw: node.raw,
        description: `Match "${node.raw}"`,
        type: 'literal',
      });
  }
}

function explainChildren(children: ASTNode[]): ExplanationToken[] {
  const tokens: ExplanationToken[] = [];
  for (const child of children) {
    walkNode(child, tokens);
  }
  return tokens;
}

import type { ASTNode } from '../types/regex';

export function findNodeById(root: ASTNode, targetId: string): ASTNode | null {
  if (root.id === targetId) return root;
  for (const child of root.children || []) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}

export function deleteNodeFromPattern(pattern: string, node: ASTNode): string {
  return pattern.slice(0, node.start) + pattern.slice(node.end);
}

export function replaceNodeInPattern(pattern: string, node: ASTNode, replacement: string): string {
  return pattern.slice(0, node.start) + replacement + pattern.slice(node.end);
}

export function insertBeforeNode(pattern: string, node: ASTNode, insertion: string): string {
  return pattern.slice(0, node.start) + insertion + pattern.slice(node.start);
}

export function insertAfterNode(pattern: string, node: ASTNode, insertion: string): string {
  return pattern.slice(0, node.end) + insertion + pattern.slice(node.end);
}

export function wrapNodeInGroup(
  pattern: string,
  node: ASTNode,
  groupType: 'capturing' | 'nonCapturing' | 'named',
  name?: string,
): string {
  const inner = pattern.slice(node.start, node.end);
  let prefix = '(';
  if (groupType === 'nonCapturing') prefix = '(?:';
  if (groupType === 'named') prefix = `(?<${name || 'name'}>`;
  return `${pattern.slice(0, node.start) + prefix + inner})${pattern.slice(node.end)}`;
}

// Matches any quantifier suffix that may directly follow an atom in a regex.
const QUANTIFIER_SUFFIX_RE = /^(?:\?\?|\*\?|\+\?|\?|\*|\+|\{\d+(?:,\d*)?\}\??)/;

export function changeQuantifier(pattern: string, node: ASTNode, quantifier: string): string {
  if (node.type === 'quantifier' && node.quantifier) {
    const childEnd = node.children?.[0]?.end ?? node.start;
    return pattern.slice(0, childEnd) + quantifier + pattern.slice(node.end);
  }
  // Non-quantifier node: there may still be an existing quantifier suffix
  // immediately after it (e.g. user clicked the inner `a` of `a+`). Replace
  // that suffix instead of blindly appending, otherwise we produce illegal
  // patterns like `a++` / `a+*`.
  const tail = pattern.slice(node.end);
  const match = tail.match(QUANTIFIER_SUFFIX_RE);
  const replaceEnd = match ? node.end + match[0].length : node.end;
  return pattern.slice(0, node.end) + quantifier + pattern.slice(replaceEnd);
}

export function getNodeDescription(node: ASTNode): string {
  switch (node.type) {
    case 'literal':
      return `Character "${node.value}"`;
    case 'dot':
      return 'Any character (.)';
    case 'escape': {
      const descs: Record<string, string> = {
        '\\d': 'Digit',
        '\\D': 'Non-digit',
        '\\w': 'Word char',
        '\\W': 'Non-word',
        '\\s': 'Whitespace',
        '\\S': 'Non-whitespace',
        '\\b': 'Word boundary',
        '\\B': 'Non-word boundary',
      };
      return descs[node.value] || `Escaped: ${node.value}`;
    }
    case 'anchor':
      return node.value === '^' ? 'Start of string' : 'End of string';
    case 'characterClass':
      return `Character set: ${node.raw}`;
    case 'negatedCharacterClass':
      return `Negated set: ${node.raw}`;
    case 'group':
      return `Capturing group #${node.groupIndex}`;
    case 'nonCapturingGroup':
      return 'Non-capturing group';
    case 'namedGroup':
      return `Named group: ${node.groupName}`;
    case 'lookahead':
      return 'Positive lookahead';
    case 'negativeLookahead':
      return 'Negative lookahead';
    case 'lookbehind':
      return 'Positive lookbehind';
    case 'negativeLookbehind':
      return 'Negative lookbehind';
    case 'alternation':
      return 'Alternation (|)';
    case 'quantifier':
      return `Quantifier: ${node.quantifier?.raw}`;
    case 'backreference':
      return `Backreference #${node.value}`;
    default:
      return node.raw;
  }
}

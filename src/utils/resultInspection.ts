import type { ASTNode, MatchInfo } from '../types/regex';
import type { DebugStep } from './steppingMatcher';
import { findNodeById } from '../lib/ast';

export interface SourceRange {
  start: number;
  end: number;
}
export interface ResultInspection {
  origin: 'match' | 'source' | 'debugger';
  source: SourceRange[];
  subject: SourceRange | null;
  nodeIds: string[];
  matchIndex?: number;
  groupIndex?: number;
  ambiguous?: boolean;
}

export function validRange(range: SourceRange, length: number): boolean {
  return (
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 0 &&
    range.end >= range.start &&
    range.end <= length
  );
}

/** Smallest node containing the complete native source item. EOF has no node. */
export function nodeForRange(root: ASTNode, range: SourceRange): ASTNode | null {
  if (range.start < root.start || range.end > root.end || range.start >= root.end) return null;
  for (const child of root.children ?? []) {
    const found = nodeForRange(child, range);
    if (found) return found;
  }
  return root.type === 'sequence' ? null : root;
}

export function captureNodes(root: ASTNode, index: number): ASTNode[] {
  const found: ASTNode[] = [];
  const visit = (node: ASTNode) => {
    if ((node.type === 'group' || node.type === 'namedGroup') && node.groupIndex === index)
      found.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return found;
}

export function inspectMatch(
  matches: MatchInfo[],
  matchIndex: number,
  groupIndex: number | undefined,
  ast: ASTNode,
  sourceLength: number,
  textLength: number,
  visualSupported: boolean,
): ResultInspection | null {
  const match = matches[matchIndex];
  if (!match) return null;
  if (groupIndex === undefined)
    return {
      origin: 'match',
      matchIndex,
      source: [{ start: 0, end: sourceLength }],
      nodeIds: [],
      subject: validRange(match, textLength) ? { start: match.start, end: match.end } : null,
    };
  const group = match.groups.find((item) => item.index === groupIndex);
  if (!group) return null;
  const nodes = visualSupported ? captureNodes(ast, groupIndex) : [];
  return {
    origin: 'match',
    matchIndex,
    groupIndex,
    source: nodes.map(({ start, end }) => ({ start, end })),
    nodeIds: nodes.map((node) => node.id),
    // Captures from lookbehind or before \K can lie outside the full match.
    subject:
      group.value !== undefined && validRange(group, textLength)
        ? { start: group.start, end: group.end }
        : null,
    ambiguous: nodes.length > 1,
  };
}

export function inspectSource(
  ast: ASTNode,
  range: SourceRange,
  visualSupported: boolean,
): ResultInspection {
  const node = visualSupported ? nodeForRange(ast, range) : null;
  return { origin: 'source', source: [range], subject: null, nodeIds: node ? [node.id] : [] };
}

export function inspectStep(
  ast: ASTNode,
  step: DebugStep,
  sourceLength: number,
  textLength: number,
  visualSupported: boolean,
): ResultInspection | null {
  const node = visualSupported && step.astNodeId ? findNodeById(ast, step.astNodeId) : null;
  const source =
    step.patternStart !== undefined && step.patternEnd !== undefined
      ? { start: step.patternStart, end: step.patternEnd }
      : node
        ? { start: node.start, end: node.end }
        : null;
  if (!source || !validRange(source, sourceLength)) return null;
  const linked = node ?? (visualSupported ? nodeForRange(ast, source) : null);
  const subject = { start: step.stringPos, end: step.stringEnd };
  return {
    origin: 'debugger',
    source: [source],
    nodeIds: linked ? [linked.id] : [],
    subject: validRange(subject, textLength) ? subject : null,
  };
}

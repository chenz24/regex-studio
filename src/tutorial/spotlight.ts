import type { ASTNode } from '@/types/regex';
import type { StepSpotlight } from './types';

export interface ResolvedSpotlight {
  /** AST node ids to highlight in diagram + explanation. */
  nodeIds: Set<string>;
  /** The first resolved node id, used as scroll anchor. */
  firstNodeId: string | null;
}

const EMPTY: ResolvedSpotlight = { nodeIds: new Set(), firstNodeId: null };

/**
 * Resolve a step's spotlight spec against the current pattern + AST.
 *
 * For each `patternSubstring` we find every occurrence in the pattern and
 * pick the AST node whose [start, end) best matches the range. Preference
 * order:
 *
 *   1. a node where start == rangeStart && end == rangeEnd (exact span)
 *   2. otherwise the deepest node whose range fully covers the request
 *
 * `patternRanges` are resolved the same way.
 */
export function resolveSpotlight(
  spec: StepSpotlight | undefined,
  pattern: string,
  ast: ASTNode,
): ResolvedSpotlight {
  if (!spec || !pattern) return EMPTY;

  const ranges: Array<[number, number]> = [];

  if (spec.patternSubstrings) {
    for (const sub of spec.patternSubstrings) {
      if (!sub) continue;
      let from = 0;
      while (from <= pattern.length - sub.length) {
        const idx = pattern.indexOf(sub, from);
        if (idx === -1) break;
        ranges.push([idx, idx + sub.length]);
        from = idx + Math.max(1, sub.length);
      }
    }
  }

  if (spec.patternRanges) {
    for (const [s, e] of spec.patternRanges) {
      if (s < e && s >= 0 && e <= pattern.length) ranges.push([s, e]);
    }
  }

  if (ranges.length === 0) return EMPTY;

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const [s, e] of ranges) {
    const exact = findExactNode(ast, s, e);
    const pick = exact ?? findDeepestCoveringNode(ast, s, e);
    if (pick && !seen.has(pick.id)) {
      seen.add(pick.id);
      ids.push(pick.id);
    }
  }

  return {
    nodeIds: seen,
    firstNodeId: ids[0] ?? null,
  };
}

function findExactNode(node: ASTNode, start: number, end: number): ASTNode | null {
  if (node.start === start && node.end === end && node.type !== 'sequence') {
    return node;
  }
  if (node.children) {
    for (const c of node.children) {
      const found = findExactNode(c, start, end);
      if (found) return found;
    }
  }
  // sequence roots still count if they span the whole range, last resort
  if (node.start === start && node.end === end) return node;
  return null;
}

function findDeepestCoveringNode(node: ASTNode, start: number, end: number): ASTNode | null {
  if (node.start > start || node.end < end) return null;
  if (node.children) {
    for (const c of node.children) {
      const found = findDeepestCoveringNode(c, start, end);
      if (found) return found;
    }
  }
  return node.type === 'sequence' ? null : node;
}

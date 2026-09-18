import type { ASTNode } from '../types/regex';

/**
 * Find an AST node by its ID (recursive search)
 */
function findAstNode(node: ASTNode, id: string): ASTNode | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findAstNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/** Diagram literals can span several consecutive source nodes. */
export function diagramSourceIds(id: string): string[] {
  return id.startsWith('merged:') ? id.slice('merged:'.length).split(',') : [id];
}

export function findNodeById(root: ASTNode, id: string): ASTNode | null {
  if (!id.startsWith('merged:')) return findAstNode(root, id);
  const sourceIds = diagramSourceIds(id);
  const wanted = new Set(sourceIds);
  const sources = new Map<string, ASTNode>();
  const collect = (node: ASTNode) => {
    if (wanted.has(node.id)) sources.set(node.id, node);
    for (const child of node.children ?? []) collect(child);
  };
  collect(root);
  const children: ASTNode[] = [];
  for (const sourceId of sourceIds) {
    const node = sources.get(sourceId);
    if (!node || (children.length > 0 && children[children.length - 1].end !== node.start)) {
      return null;
    }
    children.push(node);
  }
  if (children.length < 2) return null;
  const raw = children.map((child) => child.raw).join('');
  return {
    type: 'sequence',
    id,
    raw,
    value: raw,
    children,
    start: children[0].start,
    end: children[children.length - 1].end,
  };
}

export function diagramNodeMatches(id: string | undefined, ids: Set<string> | undefined): boolean {
  return (
    !!id && !!ids && (ids.has(id) || diagramSourceIds(id).some((sourceId) => ids.has(sourceId)))
  );
}

/**
 * Find the deepest AST node at a given position
 */
export function findNodeAtPosition(node: ASTNode, pos: number): ASTNode | null {
  if (pos < node.start || pos >= node.end) return null;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeAtPosition(child, pos);
      if (found) return found;
    }
  }
  if (node.type === 'sequence') return null;
  return node;
}

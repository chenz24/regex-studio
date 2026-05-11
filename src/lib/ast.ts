import type { ASTNode } from '../types/regex';

/**
 * Find an AST node by its ID (recursive search)
 */
export function findNodeById(node: ASTNode, id: string): ASTNode | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
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

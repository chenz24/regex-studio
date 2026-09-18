import { readPcre2Quantifier } from './pcre2Quantifier';
import type { ASTNode } from '../types/regex';
import { findNodeById } from './patternEditor';
import { parsePcre2 } from './pcre2Parser';

export function pcre2EditTarget(ast: ASTNode, id: string): ASTNode | null {
  const node = findNodeById(ast, id);
  if (!node) return null;
  const parent = (root: ASTNode): ASTNode | undefined => {
    if (root.type === 'quantifier' && root.children?.[0] === node) return root;
    return root.children?.map(parent).find(Boolean);
  };
  return parent(ast) ?? node;
}

export function pcre2AtomKind(node: ASTNode): 'literal' | 'class' | undefined {
  if (node.type === 'literal') return 'literal';
  if (node.type === 'pcreEscape' && node.raw.startsWith('[')) return 'class';
}

/** Escape literal input independently of x/xx and scoped options. */
function literalSource(value: string): string {
  return value.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: encode literal controls as PCRE2 hex escapes.
    /[\\^$.*+?()[\]{}|#\s\x00-\x1f\x7f]/g,
    (ch) => `\\x{${ch.charCodeAt(0).toString(16)}}`,
  );
}

/** Only the selected source ranges change; native compilation is required before applying. */
export function editPcre2Node(
  pattern: string,
  target: ASTNode,
  value: string,
  quantifier: string,
): string {
  const atom = target.type === 'quantifier' ? target.children?.[0] : target;
  if (!atom || target.dialect !== 'pcre2' || pattern.slice(target.start, target.end) !== target.raw)
    throw new Error('stale');
  const kind = pcre2AtomKind(atom);
  if (!kind && target.type !== 'quantifier') throw new Error('unsupported');
  if (quantifier && readPcre2Quantifier(quantifier)?.raw !== quantifier)
    throw new Error('quantifier');
  let replacement = atom.raw;
  const originalValue = kind === 'literal' ? atom.value : atom.raw;
  if (kind && value !== originalValue) {
    if (kind === 'class') {
      const parsed = parsePcre2(value);
      const children = parsed.ast.children;
      if (
        !parsed.supported ||
        children?.length !== 1 ||
        pcre2AtomKind(children[0]) !== 'class' ||
        children[0].raw !== value
      )
        throw new Error('class');
      replacement = value;
    } else {
      // Keep an existing repetition attached to the entire replacement text.
      replacement = literalSource(value);
      if (target.type === 'quantifier') replacement = `(?:${replacement})`;
      if (atom.quoted) replacement = `\\E${replacement}\\Q`;
    }
  }
  if (target.type === 'quantifier') {
    if (target.quantifierStart === undefined) throw new Error('stale');
    return (
      pattern.slice(0, atom.start) +
      replacement +
      pattern.slice(atom.end, target.quantifierStart) +
      quantifier +
      pattern.slice(target.end)
    );
  }
  if (quantifier) {
    // A merged literal is one visual node. Repeating it repeats the whole text.
    if (kind === 'literal') {
      replacement = `(?:${literalSource(value)})${quantifier}`;
      if (atom.quoted) replacement = `\\E${replacement}\\Q`;
    } else replacement += quantifier;
  }
  return pattern.slice(0, atom.start) + replacement + pattern.slice(atom.end);
}

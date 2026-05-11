import type { ASTNode } from '../types/regex';
import type { RegexEngine, CompatibilityWarning } from '../types/engineTypes';
import { ENGINE_FLAVORS } from '../types/engineTypes';

/**
 * Walk the AST and check each node against the target engine's
 * unsupported features list. Returns a deduplicated list of warnings.
 */
export function checkCompatibility(ast: ASTNode, engine: RegexEngine): CompatibilityWarning[] {
  // JavaScript supports everything we parse — skip the walk
  if (engine === 'javascript') return [];

  const flavor = ENGINE_FLAVORS[engine];
  if (!flavor || flavor.unsupportedFeatures.length === 0) return [];

  const warnings: CompatibilityWarning[] = [];
  const seenFeatures = new Set<string>();

  function walk(node: ASTNode) {
    for (const rule of flavor.unsupportedFeatures) {
      if (rule.nodeTypes.includes(node.type) && !seenFeatures.has(rule.feature)) {
        seenFeatures.add(rule.feature);
        warnings.push({
          feature: rule.feature,
          message: rule.message,
          featureKey: rule.featureKey,
          messageKey: rule.messageKey,
          severity: rule.severity,
          nodeId: node.id,
          raw: node.raw,
        });
      }
    }

    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return warnings;
}

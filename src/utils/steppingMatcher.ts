import type { ASTNode } from '../types/regex';

// ─── Types ────────────────────────────────────────────────────────────

export type StepAction = 'try' | 'match' | 'fail' | 'backtrack' | 'enter-group' | 'exit-group';

export interface DebugStep {
  id: number;
  /** The AST node being processed */
  astNodeId: string;
  /** Current position in the test string */
  stringPos: number;
  /** End position for multi-char matches */
  stringEnd: number;
  /** What happened at this step */
  action: StepAction;
  /** Human-readable description */
  description: string;
  /** Snapshot of capture group values */
  captureGroups: Record<number, { value: string; start: number; end: number } | null>;
  /** Nesting depth for indentation */
  depth: number;
}

export interface DebugResult {
  steps: DebugStep[];
  /** Whether a match was found */
  matched: boolean;
  /** Total steps executed */
  totalSteps: number;
  /** Whether we hit the step limit */
  truncated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const MAX_STEPS = 10000;

const ESCAPE_CHAR_CLASS: Record<string, (ch: string) => boolean> = {
  '\\d': (ch) => /\d/.test(ch),
  '\\D': (ch) => !/\d/.test(ch),
  '\\w': (ch) => /\w/.test(ch),
  '\\W': (ch) => !/\w/.test(ch),
  '\\s': (ch) => /\s/.test(ch),
  '\\S': (ch) => !/\s/.test(ch),
};

function charEquals(a: string, b: string, caseInsensitive: boolean): boolean {
  if (caseInsensitive) return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

function escapeForDisplay(value: string): string {
  if (value === '\n') return '\\n';
  if (value === '\t') return '\\t';
  if (value === '\r') return '\\r';
  return value;
}

function matchesCharClass(node: ASTNode, ch: string, caseInsensitive: boolean): boolean {
  if (!node.children) return false;

  for (const item of node.children) {
    if (item.type === 'range') {
      const [from, to] = item.children || [];
      if (from && to) {
        const c = caseInsensitive ? ch.toLowerCase() : ch;
        const lo = caseInsensitive ? from.value.toLowerCase() : from.value;
        const hi = caseInsensitive ? to.value.toLowerCase() : to.value;
        if (c >= lo && c <= hi) return true;
      }
    } else if (item.type === 'escape') {
      const test = ESCAPE_CHAR_CLASS[item.value];
      if (test) {
        if (test(ch)) return true;
      } else {
        const literal = item.value.slice(1);
        if (charEquals(ch, literal, caseInsensitive)) return true;
      }
    } else {
      if (charEquals(ch, item.value, caseInsensitive)) return true;
    }
  }

  return false;
}

// ─── SteppingMatcher ──────────────────────────────────────────────────

export class SteppingMatcher {
  private steps: DebugStep[] = [];
  private stepId = 0;
  private text: string;
  private ast: ASTNode;
  private caseInsensitive: boolean;
  private multiline: boolean;
  private dotAll: boolean;
  private captureGroups: Record<number, { value: string; start: number; end: number } | null> = {};
  private depth = 0;
  private truncated = false;

  constructor(ast: ASTNode, text: string, flags: string) {
    this.ast = ast;
    this.text = text;
    this.caseInsensitive = flags.includes('i');
    this.multiline = flags.includes('m');
    this.dotAll = flags.includes('s');
  }

  execute(): DebugResult {
    this.steps = [];
    this.stepId = 0;
    this.truncated = false;

    const matched = this.tryMatch(0);

    return {
      steps: this.steps,
      matched,
      totalSteps: this.steps.length,
      truncated: this.truncated,
    };
  }

  private tryMatch(startPos: number): boolean {
    // Try matching from startPos
    const result = this.matchNode(this.ast, startPos);
    return result !== null;
  }

  private record(
    astNodeId: string,
    stringPos: number,
    stringEnd: number,
    action: StepAction,
    description: string,
  ): boolean {
    if (this.steps.length >= MAX_STEPS) {
      this.truncated = true;
      return false; // signal to stop
    }
    this.steps.push({
      id: this.stepId++,
      astNodeId,
      stringPos,
      stringEnd,
      action,
      description,
      captureGroups: { ...this.captureGroups },
      depth: this.depth,
    });
    return true;
  }

  /**
   * Try to match `node` starting at `pos`.
   * Returns the new position after the match, or `null` if failed.
   */
  private matchNode(node: ASTNode, pos: number): number | null {
    if (this.truncated) return null;

    switch (node.type) {
      case 'sequence':
        return this.matchSequence(node, pos);
      case 'literal':
        return this.matchLiteral(node, pos);
      case 'dot':
        return this.matchDot(node, pos);
      case 'escape':
        return this.matchEscape(node, pos);
      case 'characterClass':
        return this.matchCharClass(node, pos, false);
      case 'negatedCharacterClass':
        return this.matchCharClass(node, pos, true);
      case 'anchor':
        return this.matchAnchor(node, pos);
      case 'alternation':
        return this.matchAlternation(node, pos);
      case 'quantifier':
        return this.matchQuantifier(node, pos);
      case 'group':
      case 'namedGroup':
        return this.matchCapturingGroup(node, pos);
      case 'nonCapturingGroup':
        return this.matchNonCapturingGroup(node, pos);
      case 'lookahead':
        return this.matchLookahead(node, pos, false);
      case 'negativeLookahead':
        return this.matchLookahead(node, pos, true);
      case 'lookbehind':
        return this.matchLookbehind(node, pos, false);
      case 'negativeLookbehind':
        return this.matchLookbehind(node, pos, true);
      case 'backreference':
        return this.matchBackreference(node, pos);
      default:
        return this.matchLiteral(node, pos);
    }
  }

  private matchSequence(node: ASTNode, pos: number): number | null {
    if (!node.children || node.children.length === 0) return pos;

    let current = pos;
    for (const child of node.children) {
      const result = this.matchNode(child, current);
      if (result === null) return null;
      current = result;
    }
    return current;
  }

  private matchLiteral(node: ASTNode, pos: number): number | null {
    const ch = node.value;

    if (
      !this.record(
        node.id,
        pos,
        pos,
        'try',
        `Try to match "${escapeForDisplay(ch)}" at position ${pos}`,
      )
    )
      return null;

    if (pos < this.text.length && charEquals(this.text[pos], ch, this.caseInsensitive)) {
      this.record(
        node.id,
        pos,
        pos + 1,
        'match',
        `✓ Matched "${escapeForDisplay(ch)}" with "${escapeForDisplay(this.text[pos])}"`,
      );
      return pos + 1;
    }

    const got = pos < this.text.length ? `"${escapeForDisplay(this.text[pos])}"` : 'end of string';
    this.record(
      node.id,
      pos,
      pos,
      'fail',
      `✗ Failed to match "${escapeForDisplay(ch)}", got ${got}`,
    );
    return null;
  }

  private matchDot(node: ASTNode, pos: number): number | null {
    if (!this.record(node.id, pos, pos, 'try', `Try "." (any character) at position ${pos}`))
      return null;

    if (pos < this.text.length) {
      const ch = this.text[pos];
      if (this.dotAll || (ch !== '\n' && ch !== '\r')) {
        this.record(node.id, pos, pos + 1, 'match', `✓ "." matched "${escapeForDisplay(ch)}"`);
        return pos + 1;
      }
    }

    this.record(node.id, pos, pos, 'fail', `✗ "." failed at position ${pos}`);
    return null;
  }

  private matchEscape(node: ASTNode, pos: number): number | null {
    const esc = node.value;

    if (!this.record(node.id, pos, pos, 'try', `Try ${esc} at position ${pos}`)) return null;

    // Shorthand character classes
    const test = ESCAPE_CHAR_CLASS[esc];
    if (test) {
      if (pos < this.text.length && test(this.text[pos])) {
        this.record(
          node.id,
          pos,
          pos + 1,
          'match',
          `✓ ${esc} matched "${escapeForDisplay(this.text[pos])}"`,
        );
        return pos + 1;
      }
      const got =
        pos < this.text.length ? `"${escapeForDisplay(this.text[pos])}"` : 'end of string';
      this.record(node.id, pos, pos, 'fail', `✗ ${esc} failed, got ${got}`);
      return null;
    }

    // Word boundary
    if (esc === '\\b' || esc === '\\B') {
      const isWordBoundary = this.isWordBoundary(pos);
      const shouldMatch = esc === '\\b';
      if (isWordBoundary === shouldMatch) {
        this.record(node.id, pos, pos, 'match', `✓ ${esc} assertion passed at position ${pos}`);
        return pos;
      }
      this.record(node.id, pos, pos, 'fail', `✗ ${esc} assertion failed at position ${pos}`);
      return null;
    }

    // Literal escaped character
    const literal = esc.length > 1 ? esc.slice(1) : esc;
    const mappedChar =
      literal === 'n' ? '\n' : literal === 't' ? '\t' : literal === 'r' ? '\r' : literal;

    if (pos < this.text.length && charEquals(this.text[pos], mappedChar, this.caseInsensitive)) {
      this.record(
        node.id,
        pos,
        pos + 1,
        'match',
        `✓ ${esc} matched "${escapeForDisplay(this.text[pos])}"`,
      );
      return pos + 1;
    }

    const got = pos < this.text.length ? `"${escapeForDisplay(this.text[pos])}"` : 'end of string';
    this.record(node.id, pos, pos, 'fail', `✗ ${esc} failed, got ${got}`);
    return null;
  }

  private matchCharClass(node: ASTNode, pos: number, negated: boolean): number | null {
    const display = node.raw || (negated ? '[^...]' : '[...]');

    if (!this.record(node.id, pos, pos, 'try', `Try ${display} at position ${pos}`)) return null;

    if (pos >= this.text.length) {
      this.record(node.id, pos, pos, 'fail', `✗ ${display} failed, at end of string`);
      return null;
    }

    const ch = this.text[pos];
    const inClass = matchesCharClass(node, ch, this.caseInsensitive);
    const matches = negated ? !inClass : inClass;

    if (matches) {
      this.record(node.id, pos, pos + 1, 'match', `✓ ${display} matched "${escapeForDisplay(ch)}"`);
      return pos + 1;
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${display} did not match "${escapeForDisplay(ch)}"`);
    return null;
  }

  private matchAnchor(node: ASTNode, pos: number): number | null {
    const anchor = node.value;

    if (
      !this.record(
        node.id,
        pos,
        pos,
        'try',
        `Test ${anchor === '^' ? 'start' : 'end'} anchor at position ${pos}`,
      )
    )
      return null;

    let pass = false;

    if (anchor === '^') {
      if (pos === 0) {
        pass = true;
      } else if (this.multiline && pos > 0 && this.text[pos - 1] === '\n') {
        pass = true;
      }
    } else {
      if (pos === this.text.length) {
        pass = true;
      } else if (this.multiline && pos < this.text.length && this.text[pos] === '\n') {
        pass = true;
      }
    }

    if (pass) {
      this.record(node.id, pos, pos, 'match', `✓ ${anchor} anchor matched at position ${pos}`);
      return pos;
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${anchor} anchor failed at position ${pos}`);
    return null;
  }

  private matchAlternation(node: ASTNode, pos: number): number | null {
    if (!node.children) return null;

    for (let i = 0; i < node.children.length; i++) {
      const branch = node.children[i];

      if (
        !this.record(node.id, pos, pos, 'try', `Try alternative ${i + 1}/${node.children.length}`)
      )
        return null;

      const savedCaptures = { ...this.captureGroups };
      const result = this.matchNode(branch, pos);

      if (result !== null) {
        this.record(node.id, pos, result, 'match', `✓ Alternative ${i + 1} matched`);
        return result;
      }

      // Restore captures on failure
      this.captureGroups = savedCaptures;

      if (i < node.children.length - 1) {
        this.record(node.id, pos, pos, 'backtrack', `Alternative ${i + 1} failed, trying next`);
      } else {
        this.record(node.id, pos, pos, 'fail', `✗ All alternatives failed`);
      }
    }

    return null;
  }

  private matchQuantifier(node: ASTNode, pos: number): number | null {
    if (!node.children || !node.quantifier) return null;

    const child = node.children[0];
    const { min, max, lazy } = node.quantifier;
    const display = node.quantifier.raw;
    const effectiveMax = max === null ? MAX_STEPS : max;

    if (
      !this.record(
        node.id,
        pos,
        pos,
        'try',
        `Try quantifier ${display} (${lazy ? 'lazy' : 'greedy'}, min=${min}, max=${max ?? '∞'})`,
      )
    )
      return null;

    if (lazy) {
      return this.matchQuantifierLazy(node, child, pos, min, effectiveMax, display);
    } else {
      return this.matchQuantifierGreedy(node, child, pos, min, effectiveMax, display);
    }
  }

  private matchQuantifierGreedy(
    node: ASTNode,
    child: ASTNode,
    pos: number,
    min: number,
    max: number,
    display: string,
  ): number | null {
    // Greedy: match as many as possible, then backtrack
    const positions: number[] = [pos]; // positions[i] = position after i matches
    let current = pos;

    // Match as many as possible
    for (let count = 0; count < max; count++) {
      if (this.truncated) return null;
      const savedCaptures = { ...this.captureGroups };
      const result = this.matchNode(child, current);
      if (result === null || result === current) {
        this.captureGroups = savedCaptures;
        break;
      }
      current = result;
      positions.push(current);
    }

    const matchedCount = positions.length - 1;
    this.record(
      node.id,
      pos,
      current,
      'match',
      `Quantifier ${display} matched ${matchedCount} time(s), now testing continuation`,
    );

    // Try from most matches down to min
    for (let count = matchedCount; count >= min; count--) {
      if (this.truncated) return null;
      const tryPos = positions[count];

      // For quantifier-level check, we just return the position
      // The parent sequence will try the next nodes
      if (count === matchedCount) {
        // First try with maximum matches
        return tryPos;
      }

      this.record(
        node.id,
        pos,
        tryPos,
        'backtrack',
        `Backtrack quantifier ${display} to ${count} match(es)`,
      );
    }

    if (matchedCount < min) {
      this.record(
        node.id,
        pos,
        pos,
        'fail',
        `✗ Quantifier ${display} needs at least ${min} match(es), got ${matchedCount}`,
      );
      return null;
    }

    return positions[min];
  }

  private matchQuantifierLazy(
    node: ASTNode,
    child: ASTNode,
    pos: number,
    min: number,
    _max: number,
    display: string,
  ): number | null {
    // Lazy: match as few as possible, then try more
    let current = pos;

    // First match the minimum required
    for (let count = 0; count < min; count++) {
      if (this.truncated) return null;
      const result = this.matchNode(child, current);
      if (result === null) {
        this.record(
          node.id,
          pos,
          current,
          'fail',
          `✗ Quantifier ${display} needs at least ${min}, failed at ${count}`,
        );
        return null;
      }
      current = result;
    }

    // Try with min matches first (lazy)
    this.record(
      node.id,
      pos,
      current,
      'match',
      `Quantifier ${display} (lazy) trying with ${min} match(es) first`,
    );
    return current;
  }

  private matchCapturingGroup(node: ASTNode, pos: number): number | null {
    const groupIdx = node.groupIndex || 0;
    const label = node.groupName
      ? `named group "${node.groupName}" (#${groupIdx})`
      : `capturing group #${groupIdx}`;

    if (!this.record(node.id, pos, pos, 'enter-group', `Enter ${label}`)) return null;

    this.depth++;
    const content = node.children ? this.matchSequenceOfChildren(node.children, pos) : pos;
    this.depth--;

    if (content !== null) {
      const captured = this.text.slice(pos, content);
      this.captureGroups[groupIdx] = { value: captured, start: pos, end: content };
      this.record(
        node.id,
        pos,
        content,
        'exit-group',
        `Exit ${label}, captured "${escapeForDisplay(captured)}"`,
      );
      return content;
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${label} failed`);
    return null;
  }

  private matchNonCapturingGroup(node: ASTNode, pos: number): number | null {
    if (!this.record(node.id, pos, pos, 'enter-group', `Enter non-capturing group`)) return null;

    this.depth++;
    const content = node.children ? this.matchSequenceOfChildren(node.children, pos) : pos;
    this.depth--;

    if (content !== null) {
      this.record(node.id, pos, content, 'exit-group', `Exit non-capturing group`);
      return content;
    }

    this.record(node.id, pos, pos, 'fail', `✗ Non-capturing group failed`);
    return null;
  }

  private matchLookahead(node: ASTNode, pos: number, negative: boolean): number | null {
    const label = negative ? 'negative lookahead' : 'positive lookahead';

    if (!this.record(node.id, pos, pos, 'try', `Test ${label} at position ${pos}`)) return null;

    this.depth++;
    const savedCaptures = { ...this.captureGroups };
    const content = node.children ? this.matchSequenceOfChildren(node.children, pos) : pos;
    this.depth--;

    const found = content !== null;
    // Restore captures — lookahead doesn't capture
    this.captureGroups = savedCaptures;

    if (negative ? !found : found) {
      this.record(
        node.id,
        pos,
        pos,
        'match',
        `✓ ${label} ${negative ? 'correctly did not match' : 'matched'}`,
      );
      return pos; // Lookahead doesn't consume characters
    }

    this.record(
      node.id,
      pos,
      pos,
      'fail',
      `✗ ${label} ${negative ? 'unexpectedly matched' : 'did not match'}`,
    );
    return null;
  }

  private matchLookbehind(node: ASTNode, pos: number, negative: boolean): number | null {
    const label = negative ? 'negative lookbehind' : 'positive lookbehind';

    if (!this.record(node.id, pos, pos, 'try', `Test ${label} at position ${pos}`)) return null;

    // Simple lookbehind: try matching from each prior position
    this.depth++;
    const savedCaptures = { ...this.captureGroups };
    let found = false;

    for (let startPos = 0; startPos <= pos; startPos++) {
      const result = node.children
        ? this.matchSequenceOfChildren(node.children, startPos)
        : startPos;
      if (result === pos) {
        found = true;
        break;
      }
    }
    this.depth--;
    this.captureGroups = savedCaptures;

    if (negative ? !found : found) {
      this.record(
        node.id,
        pos,
        pos,
        'match',
        `✓ ${label} ${negative ? 'correctly did not match' : 'matched'}`,
      );
      return pos;
    }

    this.record(
      node.id,
      pos,
      pos,
      'fail',
      `✗ ${label} ${negative ? 'unexpectedly matched' : 'did not match'}`,
    );
    return null;
  }

  private matchBackreference(node: ASTNode, pos: number): number | null {
    const groupIdx = parseInt(node.value, 10);
    const captured = this.captureGroups[groupIdx];

    if (
      !this.record(node.id, pos, pos, 'try', `Try backreference \\${groupIdx} at position ${pos}`)
    )
      return null;

    if (!captured) {
      this.record(
        node.id,
        pos,
        pos,
        'fail',
        `✗ Backreference \\${groupIdx}: group not yet captured`,
      );
      return null;
    }

    const expected = captured.value;
    const actual = this.text.slice(pos, pos + expected.length);

    if (
      this.caseInsensitive ? actual.toLowerCase() === expected.toLowerCase() : actual === expected
    ) {
      this.record(
        node.id,
        pos,
        pos + expected.length,
        'match',
        `✓ Backreference \\${groupIdx} matched "${escapeForDisplay(expected)}"`,
      );
      return pos + expected.length;
    }

    this.record(
      node.id,
      pos,
      pos,
      'fail',
      `✗ Backreference \\${groupIdx} expected "${escapeForDisplay(expected)}", got "${escapeForDisplay(actual)}"`,
    );
    return null;
  }

  private matchSequenceOfChildren(children: ASTNode[], pos: number): number | null {
    let current = pos;
    for (const child of children) {
      const result = this.matchNode(child, current);
      if (result === null) return null;
      current = result;
    }
    return current;
  }

  private isWordBoundary(pos: number): boolean {
    const before = pos > 0 ? /\w/.test(this.text[pos - 1]) : false;
    const after = pos < this.text.length ? /\w/.test(this.text[pos]) : false;
    return before !== after;
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export function debugRegex(ast: ASTNode, text: string, flags: string): DebugResult {
  if (
    !text &&
    (!ast || (ast.type === 'sequence' && (!ast.children || ast.children.length === 0)))
  ) {
    return { steps: [], matched: false, totalSteps: 0, truncated: false };
  }

  const matcher = new SteppingMatcher(ast, text, flags);
  return matcher.execute();
}

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
  /** Where the match started, or -1 */
  matchStart: number;
  /** Where the match ended, or -1 */
  matchEnd: number;
  /** Total steps executed */
  totalSteps: number;
  /** Whether we hit the step limit */
  truncated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const MAX_STEPS = 10000;

type Captures = Record<number, { value: string; start: number; end: number } | null>;

/**
 * The rest of the pattern, as seen from the node currently being matched.
 *
 * Backtracking falls out of this: a node that can match in more than one way
 * calls `cont` for each of them and keeps going while it answers `null`. A
 * failure arbitrarily far to the right therefore makes an earlier quantifier
 * give characters back, or an earlier alternative be retried — which a
 * matcher that just returns its own end position cannot do.
 */
type Continuation = (pos: number) => number | null;

function escapeForDisplay(value: string): string {
  if (value === '\n') return '\\n';
  if (value === '\t') return '\\t';
  if (value === '\r') return '\\r';
  return value;
}

/** Map every named group in the pattern to its capture number. */
function collectGroupNumbers(node: ASTNode, out: Map<string, number>): Map<string, number> {
  if (node.type === 'namedGroup' && node.groupName && node.groupIndex !== undefined) {
    out.set(node.groupName, node.groupIndex);
  }
  for (const child of node.children || []) collectGroupNumbers(child, out);
  return out;
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
  private unicode: boolean;
  private captureGroups: Captures = {};
  private depth = 0;
  private truncated = false;
  private groupNumbers: Map<string, number>;
  /** Compiled single-character tests, keyed by AST node id. */
  private charTests = new Map<string, RegExp | null>();

  constructor(ast: ASTNode, text: string, flags: string) {
    this.ast = ast;
    this.text = text;
    this.caseInsensitive = flags.includes('i');
    this.multiline = flags.includes('m');
    this.dotAll = flags.includes('s');
    this.unicode = flags.includes('u') || flags.includes('v');
    this.groupNumbers = collectGroupNumbers(ast, new Map());
  }

  execute(): DebugResult {
    this.steps = [];
    this.stepId = 0;
    this.truncated = false;

    // An unanchored pattern is retried from each position in turn, the same
    // way the real engine scans forward.
    for (let start = 0; start <= this.text.length; start = this.advance(start)) {
      this.captureGroups = {};
      this.depth = 0;
      const end = this.matchNode(this.ast, start, (pos) => pos);

      if (end !== null) {
        return {
          steps: this.steps,
          matched: true,
          matchStart: start,
          matchEnd: end,
          totalSteps: this.steps.length,
          truncated: this.truncated,
        };
      }

      if (this.truncated) break;
      if (start < this.text.length) {
        this.record(
          this.ast.id,
          start,
          start,
          'backtrack',
          `No match starting at position ${start}, retrying from ${this.advance(start)}`,
        );
      }
    }

    return {
      steps: this.steps,
      matched: false,
      matchStart: -1,
      matchEnd: -1,
      totalSteps: this.steps.length,
      truncated: this.truncated,
    };
  }

  /** Next index, stepping over an astral character as a whole in unicode mode. */
  private advance(index: number): number {
    if (!this.unicode) return index + 1;
    const code = this.text.codePointAt(index);
    if (code === undefined) return index + 1;
    return index + (code > 0xffff ? 2 : 1);
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
   * Try to match `node` at `pos`, then the rest of the pattern via `cont`.
   * Returns the end position of the overall match, or `null`.
   */
  private matchNode(node: ASTNode, pos: number, cont: Continuation): number | null {
    if (this.truncated) return null;

    switch (node.type) {
      case 'sequence':
        return this.matchChildren(node.children || [], 0, pos, cont);
      case 'literal':
      case 'dot':
      case 'escape':
      case 'characterClass':
      case 'negatedCharacterClass':
        return this.matchSingleChar(node, pos, cont);
      case 'anchor':
        return this.matchAnchor(node, pos, cont);
      case 'alternation':
        return this.matchAlternation(node, pos, cont);
      case 'quantifier':
        return this.matchQuantifier(node, pos, cont);
      case 'group':
      case 'namedGroup':
        return this.matchCapturingGroup(node, pos, cont);
      case 'nonCapturingGroup':
        return this.matchNonCapturingGroup(node, pos, cont);
      case 'lookahead':
        return this.matchLookahead(node, pos, cont, false);
      case 'negativeLookahead':
        return this.matchLookahead(node, pos, cont, true);
      case 'lookbehind':
        return this.matchLookbehind(node, pos, cont, false);
      case 'negativeLookbehind':
        return this.matchLookbehind(node, pos, cont, true);
      case 'backreference':
        return this.matchBackreference(node, pos, cont);
      default:
        return this.matchSingleChar(node, pos, cont);
    }
  }

  /** Match `children[i…]` in order, then `cont`. */
  private matchChildren(
    children: ASTNode[],
    i: number,
    pos: number,
    cont: Continuation,
  ): number | null {
    if (i >= children.length) return cont(pos);
    return this.matchNode(children[i], pos, (next) =>
      this.matchChildren(children, i + 1, next, cont),
    );
  }

  // ── Single characters ───────────────────────────────────────────────

  /**
   * Character-level semantics are delegated to the real engine: the node's
   * own source is compiled into a one-character test. That keeps `\d`,
   * `[a-z]`, `\p{L}`, `\x41` and friends behaving exactly as they will in
   * the Matches panel, which is the whole point of the debugger.
   */
  private charTest(node: ASTNode): RegExp | null {
    const cached = this.charTests.get(node.id);
    if (cached !== undefined) return cached;

    let flags = '';
    if (this.caseInsensitive) flags += 'i';
    if (this.dotAll) flags += 's';

    let test: RegExp | null = null;
    try {
      test = new RegExp(`^(?:${node.raw})$`, this.unicode ? `${flags}u` : flags);
    } catch {
      test = null;
    }
    this.charTests.set(node.id, test);
    return test;
  }

  private isWordBoundaryEscape(node: ASTNode): boolean {
    return node.type === 'escape' && (node.value === '\\b' || node.value === '\\B');
  }

  private matchSingleChar(node: ASTNode, pos: number, cont: Continuation): number | null {
    // `\b` / `\B` are assertions, not characters.
    if (this.isWordBoundaryEscape(node)) return this.matchWordBoundary(node, pos, cont);

    const display = node.raw || node.value;
    if (!this.record(node.id, pos, pos, 'try', `Try ${display} at position ${pos}`)) return null;

    if (pos >= this.text.length) {
      this.record(node.id, pos, pos, 'fail', `✗ ${display} failed, at end of string`);
      return null;
    }

    const cp = this.unicode ? this.text.codePointAt(pos) : this.text.charCodeAt(pos);
    const ch =
      cp === undefined ? this.text[pos] : this.unicode ? String.fromCodePoint(cp) : this.text[pos];
    const next = pos + ch.length;

    let ok: boolean;
    if (node.type === 'literal') {
      ok = this.caseInsensitive ? ch.toLowerCase() === node.value.toLowerCase() : ch === node.value;
    } else {
      const test = this.charTest(node);
      ok = test ? test.test(ch) : false;
    }

    if (ok) {
      this.record(node.id, pos, next, 'match', `✓ ${display} matched "${escapeForDisplay(ch)}"`);
      const result = cont(next);
      if (result !== null) return result;
      this.record(node.id, pos, next, 'backtrack', `↩ Giving back "${escapeForDisplay(ch)}"`);
      return null;
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${display} did not match "${escapeForDisplay(ch)}"`);
    return null;
  }

  private matchWordBoundary(node: ASTNode, pos: number, cont: Continuation): number | null {
    const esc = node.value;
    if (!this.record(node.id, pos, pos, 'try', `Test ${esc} at position ${pos}`)) return null;

    const isBoundary = this.isWordBoundary(pos);
    if (isBoundary === (esc === '\\b')) {
      this.record(node.id, pos, pos, 'match', `✓ ${esc} assertion passed at position ${pos}`);
      return cont(pos);
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${esc} assertion failed at position ${pos}`);
    return null;
  }

  private matchAnchor(node: ASTNode, pos: number, cont: Continuation): number | null {
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

    let pass: boolean;
    if (anchor === '^') {
      pass = pos === 0 || (this.multiline && this.text[pos - 1] === '\n');
    } else {
      pass = pos === this.text.length || (this.multiline && this.text[pos] === '\n');
    }

    if (pass) {
      this.record(node.id, pos, pos, 'match', `✓ ${anchor} anchor matched at position ${pos}`);
      return cont(pos);
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${anchor} anchor failed at position ${pos}`);
    return null;
  }

  // ── Alternation ─────────────────────────────────────────────────────

  private matchAlternation(node: ASTNode, pos: number, cont: Continuation): number | null {
    const branches = node.children || [];

    for (let i = 0; i < branches.length; i++) {
      if (this.truncated) return null;
      if (!this.record(node.id, pos, pos, 'try', `Try alternative ${i + 1}/${branches.length}`))
        return null;

      const saved = { ...this.captureGroups };
      // `cont` is passed down, so an alternative that matches here but dooms
      // the rest of the pattern is rejected and the next one is tried.
      const result = this.matchNode(branches[i], pos, cont);
      if (result !== null) return result;

      this.captureGroups = saved;
      if (i < branches.length - 1) {
        this.record(node.id, pos, pos, 'backtrack', `Alternative ${i + 1} failed, trying next`);
      } else {
        this.record(node.id, pos, pos, 'fail', '✗ All alternatives failed');
      }
    }

    return null;
  }

  // ── Quantifiers ─────────────────────────────────────────────────────

  private matchQuantifier(node: ASTNode, pos: number, cont: Continuation): number | null {
    const child = node.children?.[0];
    if (!child || !node.quantifier) return cont(pos);

    const { min, max, lazy } = node.quantifier;
    const display = node.quantifier.raw;
    const limit = max === null ? Number.POSITIVE_INFINITY : max;

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

    /**
     * `count` repetitions have matched and we are at `from`. A greedy
     * quantifier tries one more repetition before handing over to the
     * continuation; a lazy one hands over first.
     */
    const repeat = (count: number, from: number): number | null => {
      if (this.truncated) return null;

      const tryMore = (): number | null => {
        if (count >= limit) return null;
        const saved = { ...this.captureGroups };
        const result = this.matchNode(child, from, (next) =>
          // A repetition that consumed nothing would repeat forever; allow it
          // only while it still counts towards `min`.
          next === from && count + 1 >= min ? null : repeat(count + 1, next),
        );
        if (result !== null) return result;
        this.captureGroups = saved;
        return null;
      };

      const tryRest = (): number | null => {
        if (count < min) return null;
        return cont(from);
      };

      if (lazy) {
        const rest = tryRest();
        if (rest !== null) return rest;
        return tryMore();
      }

      const more = tryMore();
      if (more !== null) return more;
      if (count >= min) {
        this.record(
          node.id,
          pos,
          from,
          'backtrack',
          `Backtrack quantifier ${display} to ${count} repetition(s)`,
        );
      }
      return tryRest();
    };

    const result = repeat(0, pos);
    if (result === null && !this.truncated) {
      this.record(node.id, pos, pos, 'fail', `✗ Quantifier ${display} failed`);
    }
    return result;
  }

  // ── Groups ──────────────────────────────────────────────────────────

  private matchCapturingGroup(node: ASTNode, pos: number, cont: Continuation): number | null {
    const groupIdx = node.groupIndex || 0;
    const label = node.groupName
      ? `named group "${node.groupName}" (#${groupIdx})`
      : `capturing group #${groupIdx}`;

    if (!this.record(node.id, pos, pos, 'enter-group', `Enter ${label}`)) return null;

    const before = this.captureGroups[groupIdx] ?? null;
    this.depth++;

    const result = this.matchChildren(node.children || [], 0, pos, (end) => {
      const captured = this.text.slice(pos, end);
      const previous = this.captureGroups[groupIdx] ?? null;
      this.captureGroups[groupIdx] = { value: captured, start: pos, end };
      this.depth--;
      this.record(
        node.id,
        pos,
        end,
        'exit-group',
        `Exit ${label}, captured "${escapeForDisplay(captured)}"`,
      );
      this.depth++;

      const rest = cont(end);
      // The capture only stands if everything after it holds up.
      if (rest === null) this.captureGroups[groupIdx] = previous;
      return rest;
    });

    this.depth--;
    if (result === null) {
      this.captureGroups[groupIdx] = before;
      this.record(node.id, pos, pos, 'fail', `✗ ${label} failed`);
    }
    return result;
  }

  private matchNonCapturingGroup(node: ASTNode, pos: number, cont: Continuation): number | null {
    if (!this.record(node.id, pos, pos, 'enter-group', 'Enter non-capturing group')) return null;

    this.depth++;
    const result = this.matchChildren(node.children || [], 0, pos, (end) => {
      this.depth--;
      this.record(node.id, pos, end, 'exit-group', 'Exit non-capturing group');
      this.depth++;
      return cont(end);
    });
    this.depth--;

    if (result === null) {
      this.record(node.id, pos, pos, 'fail', '✗ Non-capturing group failed');
    }
    return result;
  }

  // ── Lookaround ──────────────────────────────────────────────────────

  private matchLookahead(
    node: ASTNode,
    pos: number,
    cont: Continuation,
    negative: boolean,
  ): number | null {
    const label = negative ? 'negative lookahead' : 'positive lookahead';
    if (!this.record(node.id, pos, pos, 'try', `Test ${label} at position ${pos}`)) return null;

    const saved = { ...this.captureGroups };
    this.depth++;
    // The assertion body is matched on its own: it never hands control to
    // the rest of the pattern and never consumes anything.
    const found = this.matchChildren(node.children || [], 0, pos, (end) => end) !== null;
    this.depth--;

    // A positive lookahead keeps what it captured (as JavaScript does); a
    // failed negative one cannot have captured anything that counts.
    if (negative || !found) this.captureGroups = saved;

    if (negative ? !found : found) {
      this.record(
        node.id,
        pos,
        pos,
        'match',
        `✓ ${label} ${negative ? 'correctly did not match' : 'matched'}`,
      );
      const result = cont(pos);
      if (result === null) this.captureGroups = saved;
      return result;
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

  private matchLookbehind(
    node: ASTNode,
    pos: number,
    cont: Continuation,
    negative: boolean,
  ): number | null {
    const label = negative ? 'negative lookbehind' : 'positive lookbehind';
    if (!this.record(node.id, pos, pos, 'try', `Test ${label} at position ${pos}`)) return null;

    const saved = { ...this.captureGroups };
    this.depth++;
    let found = false;
    // Approximated by trying every earlier start and requiring the body to
    // end exactly here.
    for (let from = pos; from >= 0 && !found; from--) {
      if (this.truncated) break;
      found =
        this.matchChildren(node.children || [], 0, from, (end) => (end === pos ? end : null)) !==
        null;
    }
    this.depth--;

    if (negative || !found) this.captureGroups = saved;

    if (negative ? !found : found) {
      this.record(
        node.id,
        pos,
        pos,
        'match',
        `✓ ${label} ${negative ? 'correctly did not match' : 'matched'}`,
      );
      const result = cont(pos);
      if (result === null) this.captureGroups = saved;
      return result;
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

  // ── Backreferences ──────────────────────────────────────────────────

  private matchBackreference(node: ASTNode, pos: number, cont: Continuation): number | null {
    const groupIdx = node.groupName
      ? (this.groupNumbers.get(node.groupName) ?? -1)
      : parseInt(node.value, 10);
    const display = node.raw || `\\${node.value}`;

    if (!this.record(node.id, pos, pos, 'try', `Try backreference ${display} at position ${pos}`))
      return null;

    const captured = this.captureGroups[groupIdx];
    // An unset group matches the empty string, as in JavaScript.
    if (!captured) {
      this.record(
        node.id,
        pos,
        pos,
        'match',
        `✓ Backreference ${display}: group not set, matches empty`,
      );
      return cont(pos);
    }

    const expected = captured.value;
    const actual = this.text.slice(pos, pos + expected.length);
    const same = this.caseInsensitive
      ? actual.toLowerCase() === expected.toLowerCase()
      : actual === expected;

    if (same) {
      const next = pos + expected.length;
      this.record(
        node.id,
        pos,
        next,
        'match',
        `✓ Backreference ${display} matched "${escapeForDisplay(expected)}"`,
      );
      const result = cont(next);
      if (result !== null) return result;
      this.record(node.id, pos, next, 'backtrack', `↩ Giving back "${escapeForDisplay(expected)}"`);
      return null;
    }

    this.record(
      node.id,
      pos,
      pos,
      'fail',
      `✗ Backreference ${display} expected "${escapeForDisplay(expected)}", got "${escapeForDisplay(actual)}"`,
    );
    return null;
  }

  private isWordBoundary(pos: number): boolean {
    const before = pos > 0 ? /\w/.test(this.text[pos - 1]) : false;
    const after = pos < this.text.length ? /\w/.test(this.text[pos]) : false;
    return before !== after;
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export function debugRegex(ast: ASTNode, text: string, flags: string): DebugResult {
  if (!ast || (ast.type === 'sequence' && (!ast.children || ast.children.length === 0))) {
    return {
      steps: [],
      matched: false,
      matchStart: -1,
      matchEnd: -1,
      totalSteps: 0,
      truncated: false,
    };
  }

  return new SteppingMatcher(ast, text, flags).execute();
}

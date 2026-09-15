import type { ASTNode } from '../types/regex';
import { isValidRegex } from './regexMatcher';

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
  /** Syntax errors are distinct from a valid pattern that did not match. */
  error?: string;
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
// Each yielded task is driven by an explicit stack, never by the JS call stack.
type MatchTask = Generator<MatchTask, number | null, number | null>;
type Continuation = (pos: number) => MatchTask;

// biome-ignore lint/correctness/useYield: terminal tasks use the same generator protocol as suspended calls
function* done(pos: number | null): MatchTask {
  return pos;
}

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
  private unicodeFlag: string;
  private direction: 1 | -1 = 1;
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
    this.unicodeFlag = flags.includes('v') ? 'v' : flags.includes('u') ? 'u' : '';
    this.unicode = this.unicodeFlag !== '';
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
      this.direction = 1;
      const end = this.run(this.matchNode(this.ast, start, done));

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

  /** Drive suspended match calls without consuming the JavaScript call stack. */
  private run(task: MatchTask): number | null {
    const stack = [task];
    let result: number | null = null;
    while (stack.length > 0 && !this.truncated) {
      const next = stack[stack.length - 1].next(result);
      if (next.done) {
        stack.pop();
        result = next.value;
      } else {
        stack.push(next.value);
        result = null;
      }
    }
    return this.truncated ? null : result;
  }

  private clearCaptures(node: ASTNode): void {
    const stack = [node];
    while (stack.length) {
      const current = stack.pop()!;
      if (current.groupIndex !== undefined) this.captureGroups[current.groupIndex] = null;
      stack.push(...(current.children ?? []));
    }
  }

  /** Index of the preceding code point (or code unit outside Unicode mode). */
  private retreat(index: number): number {
    if (this.unicode && index >= 2) {
      const low = this.text.charCodeAt(index - 1);
      const high = this.text.charCodeAt(index - 2);
      if (low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff) return index - 2;
    }
    return index - 1;
  }

  /** Next index, stepping over an astral character as a whole in Unicode mode. */
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
      stringPos: Math.min(stringPos, stringEnd),
      stringEnd: Math.max(stringPos, stringEnd),
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
  private *matchNode(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    if (this.truncated) return null;

    switch (node.type) {
      case 'sequence':
        return yield this.matchChildren(node.children || [], 0, pos, cont);
      case 'literal':
      case 'dot':
      case 'escape':
      case 'characterClass':
      case 'negatedCharacterClass':
        return yield this.matchSingleChar(node, pos, cont);
      case 'anchor':
        return yield this.matchAnchor(node, pos, cont);
      case 'alternation':
        return yield this.matchAlternation(node, pos, cont);
      case 'quantifier':
        return yield this.matchQuantifier(node, pos, cont);
      case 'group':
      case 'namedGroup':
        return yield this.matchCapturingGroup(node, pos, cont);
      case 'nonCapturingGroup':
        return yield this.matchNonCapturingGroup(node, pos, cont);
      case 'atomicGroup':
        return yield this.matchAtomicGroup(node, pos, cont);
      case 'inlineFlags':
        // An instruction to the engine, not something to match. JavaScript
        // rejects the syntax outright, so this is only ever reached for
        // another flavour's pattern.
        return yield cont(pos);
      case 'lookahead':
        return yield this.matchLookahead(node, pos, cont, false);
      case 'negativeLookahead':
        return yield this.matchLookahead(node, pos, cont, true);
      case 'lookbehind':
        return yield this.matchLookbehind(node, pos, cont, false);
      case 'negativeLookbehind':
        return yield this.matchLookbehind(node, pos, cont, true);
      case 'backreference':
        return yield this.matchBackreference(node, pos, cont);
      default:
        return yield this.matchSingleChar(node, pos, cont);
    }
  }

  /** Match `children[i…]` in order, then `cont`. */
  private *matchChildren(
    children: ASTNode[],
    i: number,
    pos: number,
    cont: Continuation,
  ): MatchTask {
    if (i >= children.length) return yield cont(pos);
    const index = this.direction === 1 ? i : children.length - 1 - i;
    return yield this.matchNode(children[index], pos, (next) =>
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
      test = new RegExp(`^(?:${node.raw})$`, `${flags}${this.unicodeFlag}`);
    } catch {
      test = null;
    }
    this.charTests.set(node.id, test);
    return test;
  }

  private isWordBoundaryEscape(node: ASTNode): boolean {
    return node.type === 'escape' && (node.value === '\\b' || node.value === '\\B');
  }

  private *matchSingleChar(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    // `\b` / `\B` are assertions, not characters.
    if (this.isWordBoundaryEscape(node)) return yield this.matchWordBoundary(node, pos, cont);

    const display = node.raw || node.value;
    if (!this.record(node.id, pos, pos, 'try', `Try ${display} at position ${pos}`)) return null;

    const charPos = this.direction === 1 ? pos : this.retreat(pos);
    if (charPos < 0 || charPos >= this.text.length) {
      this.record(node.id, pos, pos, 'fail', `✗ ${display} failed, at end of string`);
      return null;
    }

    const cp = this.unicode ? this.text.codePointAt(charPos) : this.text.charCodeAt(charPos);
    const ch =
      cp === undefined
        ? this.text[charPos]
        : this.unicode
          ? String.fromCodePoint(cp)
          : this.text[charPos];
    const next = this.direction === 1 ? pos + ch.length : charPos;

    let ok: boolean;
    if (node.type === 'literal') {
      ok = this.caseInsensitive ? ch.toLowerCase() === node.value.toLowerCase() : ch === node.value;
    } else {
      const test = this.charTest(node);
      ok = test ? test.test(ch) : false;
    }

    if (ok) {
      this.record(node.id, pos, next, 'match', `✓ ${display} matched "${escapeForDisplay(ch)}"`);
      const result = yield cont(next);
      if (result !== null) return result;
      this.record(node.id, pos, next, 'backtrack', `↩ Giving back "${escapeForDisplay(ch)}"`);
      return null;
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${display} did not match "${escapeForDisplay(ch)}"`);
    return null;
  }

  private *matchWordBoundary(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    const esc = node.value;
    if (!this.record(node.id, pos, pos, 'try', `Test ${esc} at position ${pos}`)) return null;

    const isBoundary = this.isWordBoundary(pos);
    if (isBoundary === (esc === '\\b')) {
      this.record(node.id, pos, pos, 'match', `✓ ${esc} assertion passed at position ${pos}`);
      return yield cont(pos);
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${esc} assertion failed at position ${pos}`);
    return null;
  }

  private *matchAnchor(node: ASTNode, pos: number, cont: Continuation): MatchTask {
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
      return yield cont(pos);
    }

    this.record(node.id, pos, pos, 'fail', `✗ ${anchor} anchor failed at position ${pos}`);
    return null;
  }

  // ── Alternation ─────────────────────────────────────────────────────

  private *matchAlternation(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    const branches = node.children || [];

    for (let i = 0; i < branches.length; i++) {
      if (this.truncated) return null;
      if (!this.record(node.id, pos, pos, 'try', `Try alternative ${i + 1}/${branches.length}`))
        return null;

      const saved = { ...this.captureGroups };
      // `cont` is passed down, so an alternative that matches here but dooms
      // the rest of the pattern is rejected and the next one is tried.
      const result = yield this.matchNode(branches[i], pos, cont);
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

  private *matchQuantifier(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    const child = node.children?.[0];
    if (!child || !node.quantifier) return yield cont(pos);

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
    const self = this;
    function* repeat(count: number, from: number): MatchTask {
      if (self.truncated) return null;

      function* tryMore(): MatchTask {
        if (count >= limit) return null;
        const saved = { ...self.captureGroups };
        self.clearCaptures(child!);
        const result = yield self.matchNode(child!, from, (next) =>
          // A repetition that consumed nothing would repeat forever; allow it
          // only while it still counts towards `min`.
          next === from && count >= min ? done(null) : repeat(count + 1, next),
        );
        if (result !== null) return result;
        self.captureGroups = saved;
        return null;
      }

      const tryRest = (): MatchTask => {
        if (count < min) return done(null);
        return cont(from);
      };

      if (lazy) {
        const rest = yield tryRest();
        if (rest !== null) return rest;
        return yield tryMore();
      }

      const more = yield tryMore();
      if (more !== null) return more;
      if (count >= min) {
        self.record(
          node.id,
          pos,
          from,
          'backtrack',
          `Backtrack quantifier ${display} to ${count} repetition(s)`,
        );
      }
      return yield tryRest();
    }

    const result = yield repeat(0, pos);
    if (result === null && !self.truncated) {
      self.record(node.id, pos, pos, 'fail', `✗ Quantifier ${display} failed`);
    }
    return result;
  }

  // ── Groups ──────────────────────────────────────────────────────────

  private *matchCapturingGroup(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    const self = this;
    const groupIdx = node.groupIndex || 0;
    const label = node.groupName
      ? `named group "${node.groupName}" (#${groupIdx})`
      : `capturing group #${groupIdx}`;

    if (!self.record(node.id, pos, pos, 'enter-group', `Enter ${label}`)) return null;

    const before = self.captureGroups[groupIdx] ?? null;
    self.depth++;

    const result = yield self.matchChildren(
      node.children || [],
      0,
      pos,
      function* (end): MatchTask {
        const start = Math.min(pos, end);
        const finish = Math.max(pos, end);
        const captured = self.text.slice(start, finish);
        const previous = self.captureGroups[groupIdx] ?? null;
        self.captureGroups[groupIdx] = { value: captured, start, end: finish };
        self.depth--;
        self.record(
          node.id,
          pos,
          end,
          'exit-group',
          `Exit ${label}, captured "${escapeForDisplay(captured)}"`,
        );
        self.depth++;

        const rest = yield cont(end);
        // The capture only stands if everything after it holds up.
        if (rest === null) self.captureGroups[groupIdx] = previous;
        return rest;
      },
    );

    self.depth--;
    if (result === null) {
      self.captureGroups[groupIdx] = before;
      self.record(node.id, pos, pos, 'fail', `✗ ${label} failed`);
    }
    return result;
  }

  private *matchNonCapturingGroup(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    const self = this;
    if (!self.record(node.id, pos, pos, 'enter-group', 'Enter non-capturing group')) return null;

    self.depth++;
    const result = yield self.matchChildren(
      node.children || [],
      0,
      pos,
      function* (end): MatchTask {
        self.depth--;
        self.record(node.id, pos, end, 'exit-group', 'Exit non-capturing group');
        self.depth++;
        return yield cont(end);
      },
    );
    self.depth--;

    if (result === null) {
      self.record(node.id, pos, pos, 'fail', '✗ Non-capturing group failed');
    }
    return result;
  }

  // ── Lookaround ──────────────────────────────────────────────────────

  private *matchAtomicGroup(node: ASTNode, pos: number, cont: Continuation): MatchTask {
    if (!this.record(node.id, pos, pos, 'enter-group', 'Enter atomic group')) return null;

    this.depth++;
    // Atomic: the body is matched on its own and its first result is final —
    // the continuation can never make it give characters back.
    const end = yield this.matchChildren(node.children || [], 0, pos, done);
    this.depth--;

    if (end === null) {
      this.record(node.id, pos, pos, 'fail', '✗ Atomic group failed');
      return null;
    }

    this.record(node.id, pos, end, 'exit-group', 'Exit atomic group (no backtracking into it)');
    return yield cont(end);
  }

  private *matchLookahead(
    node: ASTNode,
    pos: number,
    cont: Continuation,
    negative: boolean,
  ): MatchTask {
    const label = negative ? 'negative lookahead' : 'positive lookahead';
    if (!this.record(node.id, pos, pos, 'try', `Test ${label} at position ${pos}`)) return null;

    const saved = { ...this.captureGroups };
    this.depth++;
    // The assertion body is matched on its own: it never hands control to
    // the rest of the pattern and never consumes anything.
    const direction = this.direction;
    this.direction = 1;
    const found = (yield this.matchChildren(node.children || [], 0, pos, done)) !== null;
    this.direction = direction;
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
      const result = yield cont(pos);
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

  private *matchLookbehind(
    node: ASTNode,
    pos: number,
    cont: Continuation,
    negative: boolean,
  ): MatchTask {
    const label = negative ? 'negative lookbehind' : 'positive lookbehind';
    if (!this.record(node.id, pos, pos, 'try', `Test ${label} at position ${pos}`)) return null;

    const saved = { ...this.captureGroups };
    this.depth++;
    const direction = this.direction;
    this.direction = -1;
    const found = (yield this.matchChildren(node.children || [], 0, pos, done)) !== null;
    this.direction = direction;
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
      const result = yield cont(pos);
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

  private *matchBackreference(node: ASTNode, pos: number, cont: Continuation): MatchTask {
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
      return yield cont(pos);
    }

    const expected = captured.value;
    const next = pos + this.direction * expected.length;
    const actual = this.text.slice(Math.min(pos, next), Math.max(pos, next));
    const same = this.caseInsensitive
      ? actual.toLowerCase() === expected.toLowerCase()
      : actual === expected;

    if (same) {
      this.record(
        node.id,
        pos,
        next,
        'match',
        `✓ Backreference ${display} matched "${escapeForDisplay(expected)}"`,
      );
      const result = yield cont(next);
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
  // Compile only; never execute an arbitrary pattern on the main thread.
  // Invalid references under u/v must not succeed through an empty branch
  // or an optional quantifier in the stepping engine.
  const validation = isValidRegex(ast.raw, flags);
  if (!validation.valid || (ast.type === 'sequence' && !ast.children?.length)) {
    return {
      ...(!validation.valid ? { error: validation.error } : {}),
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

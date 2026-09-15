import type { ASTNode, QuantifierInfo } from '../types/regex';

export interface Pcre2ParseResult {
  ast: ASTNode;
  supported: boolean;
  reason?: string;
}

/** A bounded visual parser. Native PCRE2 remains the syntax and matching authority. */
export function parsePcre2(pattern: string, flags = ''): Pcre2ParseResult {
  try {
    return { ast: new Parser(pattern, flags).parse(), supported: true };
  } catch (error) {
    return {
      ast: {
        type: 'sequence',
        value: '',
        raw: pattern,
        children: [],
        id: 'pcre_empty',
        start: 0,
        end: pattern.length,
      },
      supported: false,
      reason: error instanceof Error ? error.message : 'Unsupported syntax',
    };
  }
}

class Parser {
  private pos = 0;
  private counter = 0;
  private captures = 0;
  private depth = 0;
  private quoted = false;
  private options: { x: number; U: boolean; n: boolean; u: boolean };

  constructor(
    private source: string,
    flags: string,
  ) {
    this.options = {
      x: flags.includes('x') ? 1 : 0,
      U: flags.includes('U'),
      n: false,
      u: flags.includes('u'),
    };
  }

  private fail(reason: string): never {
    throw new Error(`${reason} @${this.pos}`);
  }

  private node(type: ASTNode['type'], start: number, extra: Partial<ASTNode> = {}): ASTNode {
    if (++this.counter > 2000) this.fail('Diagram node limit');
    const raw = this.source.slice(start, this.pos);
    return {
      type,
      value: raw,
      raw,
      id: `pcre_${this.counter}`,
      start,
      end: this.pos,
      dialect: 'pcre2',
      ...extra,
    };
  }

  parse(): ASTNode {
    if (this.source.length > 20_000) this.fail('Diagram length limit');
    const node = this.alternation();
    if (this.pos !== this.source.length) this.fail('Unbalanced delimiter');
    return node;
  }

  private trivia() {
    while (this.pos < this.source.length) {
      if (this.quoted) {
        if (this.source.startsWith('\\E', this.pos)) {
          this.pos += 2;
          this.quoted = false;
          continue;
        }
        return;
      }
      if (this.source.startsWith('\\Q', this.pos)) {
        this.pos += 2;
        this.quoted = true;
        continue;
      }
      if (this.options.x && /[ \t\n\r\f\v]/.test(this.source[this.pos])) {
        this.pos++;
        continue;
      }
      if (this.options.x && this.source[this.pos] === '#') {
        // This runtime's default newline convention is LF, including for comments.
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') this.pos++;
        continue;
      }
      if (this.source.startsWith('(?#', this.pos)) {
        const end = this.source.indexOf(')', this.pos + 3);
        if (end < 0) this.fail('Unclosed comment');
        this.pos = end + 1;
        continue;
      }
      return;
    }
  }

  private alternation(resetCaptures = false): ASTNode {
    const start = this.pos;
    const base = this.captures;
    let max = base;
    const children: ASTNode[] = [];
    for (;;) {
      children.push(this.sequence());
      max = Math.max(max, this.captures);
      if (this.quoted || this.source[this.pos] !== '|') break;
      this.pos++;
      if (resetCaptures) this.captures = base;
    }
    this.captures = max;
    return children.length === 1 ? children[0] : this.node('alternation', start, { children });
  }

  private sequence(): ASTNode {
    const start = this.pos;
    const children: ASTNode[] = [];
    for (;;) {
      this.trivia();
      if (this.pos >= this.source.length || (!this.quoted && /[)|]/.test(this.source[this.pos])))
        break;
      const atom = this.atom();
      this.trivia();
      children.push(this.quantify(atom));
    }
    // Preserve trivia and the complete range, including a one-atom sequence.
    return this.node('sequence', start, { children, value: '' });
  }

  private atom(): ASTNode {
    const start = this.pos;
    const ch = this.source[this.pos];
    if (!this.quoted) {
      if (ch === '(') return this.group();
      if (ch === '[') return this.charClass();
      if (ch === '\\') return this.escape();
      if (/[*+?]/.test(ch)) this.fail('Quantifier without an atom');
      this.pos++;
      if (ch === '.') return this.node('dot', start);
      if (ch === '^' || ch === '$') return this.node('anchor', start);
    } else this.pos++;
    if (
      this.options.u &&
      /[\uD800-\uDBFF]/.test(ch) &&
      /[\uDC00-\uDFFF]/.test(this.source[this.pos] ?? '')
    )
      this.pos++;
    return this.node('literal', start);
  }

  private group(): ASTNode {
    const start = this.pos++;
    if (++this.depth > 80) this.fail('Diagram nesting limit');
    const saved = { ...this.options };
    let type: ASTNode['type'] = this.options.n ? 'nonCapturingGroup' : 'group';
    let name: string | undefined;
    let flagSpec: string | undefined;
    if (this.source[this.pos] === '*') {
      const end = this.source.indexOf(')', this.pos);
      if (end < 0 || this.source.slice(this.pos, end).includes('('))
        this.fail('Unsupported control group');
      const value = this.source.slice(this.pos + 1, end);
      // Long-form assertion/group syntax needs structural parsing, not a token.
      if (
        /^(?:pla|nla|plb|nlb|napla|naplb|positive_|negative_|non_atomic_|atomic|script_run|sr|asr):/.test(
          value,
        )
      )
        this.fail('Unsupported long-form group');
      this.pos = end + 1;
      this.depth--;
      if (value === 'UTF') this.options.u = true;
      // Changing newline conventions also changes x-mode comment boundaries.
      if (/^(?:CR|CRLF|ANY|ANYCRLF|NUL)$/.test(value)) this.fail('Unsupported newline convention');
      return this.node('verb', start, { value });
    }
    if (this.source[this.pos] === '?') {
      this.pos++;
      const tail = this.source.slice(this.pos);
      const call = /^(R|[+-]?\d+|&[A-Za-z_]\w*|P>[A-Za-z_]\w*)\)/.exec(tail);
      if (call) {
        this.pos += call[0].length;
        this.depth--;
        return this.node('subroutine', start, { value: call[1] });
      }
      const namedRef = /^P=([A-Za-z_]\w*)\)/.exec(tail);
      if (namedRef) {
        this.pos += namedRef[0].length;
        this.depth--;
        return this.node('backreference', start, { value: namedRef[1], groupName: namedRef[1] });
      }
      if (tail.startsWith('(')) return this.conditional(start, saved);
      const markers: Array<[string, ASTNode['type']]> = [
        ['<=', 'lookbehind'],
        ['<!', 'negativeLookbehind'],
        [':', 'nonCapturingGroup'],
        ['=', 'lookahead'],
        ['!', 'negativeLookahead'],
        ['>', 'atomicGroup'],
        ['|', 'branchReset'],
      ];
      const marker = markers.find(([prefix]) => tail.startsWith(prefix));
      const named = /^(?:<([A-Za-z_]\w*)>|'([A-Za-z_]\w*)'|P<([A-Za-z_]\w*)>)/.exec(tail);
      if (marker) {
        this.pos += marker[0].length;
        type = marker[1];
      } else if (named) {
        this.pos += named[0].length;
        name = named[1] ?? named[2] ?? named[3];
        type = 'namedGroup';
      } else {
        const flags = /^(\^?[imsxUnrJ-]+)([:)])/.exec(tail);
        if (!flags) this.fail('Unsupported group');
        flagSpec = flags[1];
        this.updateOptions(flagSpec);
        this.pos += flags[0].length;
        if (flags[2] === ')') {
          this.depth--;
          return this.node('inlineFlags', start, { value: flagSpec });
        }
        type = 'nonCapturingGroup';
      }
    }
    const groupIndex = type === 'group' || type === 'namedGroup' ? ++this.captures : undefined;
    const openLen = this.pos - start;
    const child = this.alternation(type === 'branchReset');
    if (this.source[this.pos] !== ')') this.fail('Unclosed group');
    this.pos++;
    this.options = saved;
    this.depth--;
    return this.node(type, start, {
      children: [child],
      groupIndex,
      groupName: name,
      openLen,
      flagSpec,
    });
  }

  private conditional(start: number, saved: typeof this.options): ASTNode {
    this.pos++;
    const end = this.source.indexOf(')', this.pos);
    if (end < 0) this.fail('Unclosed condition');
    const condition = this.source.slice(this.pos, end);
    if (!/^(?:[+-]?\d+|<\w+>|'\w+'|[A-Za-z_]\w*|R[&\w]*)$/.test(condition))
      this.fail('Unsupported condition');
    this.pos = end + 1;
    const openLen = this.pos - start;
    const child = this.alternation();
    if (this.source[this.pos] !== ')') this.fail('Unclosed conditional');
    this.pos++;
    const branches = child.type === 'alternation' ? child.children! : [child];
    if (branches.length > 2) this.fail('Too many conditional branches');
    this.options = saved;
    this.depth--;
    return this.node('conditional', start, { value: condition, children: branches, openLen });
  }

  private updateOptions(spec: string) {
    if (spec.startsWith('^')) this.options = { ...this.options, x: 0, U: false, n: false };
    const [on, off = ''] = spec.replace('^', '').split('-');
    if (on.includes('x')) this.options.x = on.includes('xx') ? 2 : 1;
    if (off.includes('x')) this.options.x = 0;
    for (const key of ['U', 'n'] as const) {
      if (on.includes(key)) this.options[key] = true;
      if (off.includes(key)) this.options[key] = false;
    }
  }

  private charClass(): ASTNode {
    const start = this.pos++;
    if (this.source[this.pos] === '^') this.pos++;
    let first = true;
    let quote = false;
    while (this.pos < this.source.length) {
      if (this.source.startsWith('\\Q', this.pos) && !quote) {
        quote = true;
        this.pos += 2;
        continue;
      }
      if (this.source.startsWith('\\E', this.pos) && quote) {
        quote = false;
        this.pos += 2;
        continue;
      }
      if (!quote && this.source[this.pos] === '\\') {
        this.pos += Math.min(2, this.source.length - this.pos);
        first = false;
        continue;
      }
      if (!quote && this.source.startsWith('[:', this.pos)) {
        const end = this.source.indexOf(':]', this.pos + 2);
        if (end < 0) this.fail('Unclosed POSIX class');
        this.pos = end + 2;
        first = false;
        continue;
      }
      const ch = this.source[this.pos++];
      if (!quote && ch === ']' && !first) return this.node('pcreEscape', start);
      if (!(this.options.x === 2 && /[ \t]/.test(ch))) first = false;
    }
    return this.fail('Unclosed character class');
  }

  private escape(): ASTNode {
    const start = this.pos;
    this.pos++;
    if (this.pos === this.source.length) this.fail('Incomplete escape');
    const ch = this.source[this.pos++];
    if (ch === 'K') return this.node('resetStart', start);
    if (ch === 'g' || ch === 'k') {
      const tail = this.source.slice(this.pos);
      const ref = /^(?:\{([^}]+)\}|<([^>]+)>|'([^']+)'|(-?\d+))/.exec(tail);
      if (!ref) this.fail('Incomplete reference');
      this.pos += ref[0].length;
      const value = ref[1] ?? ref[2] ?? ref[3] ?? ref[4];
      return this.node(ch === 'g' && (ref[2] || ref[3]) ? 'subroutine' : 'backreference', start, {
        value,
        groupName: /^[A-Za-z_]/.test(value) ? value : undefined,
      });
    }
    if ('xopPN'.includes(ch) && this.source[this.pos] === '{') {
      const end = this.source.indexOf('}', this.pos + 1);
      if (end < 0) this.fail('Unclosed escape');
      this.pos = end + 1;
    } else if (ch === 'x') {
      for (let i = 0; i < 2 && /[0-9a-fA-F]/.test(this.source[this.pos] ?? ''); i++) this.pos++;
    } else if (ch === 'c' || ch === 'p' || ch === 'P') {
      if (this.pos < this.source.length) this.pos++;
    } else if (/\d/.test(ch)) {
      while (/\d/.test(this.source[this.pos] ?? '')) this.pos++;
      if (this.pos - start > 2)
        this.fail('Ambiguous decimal or octal escape; use an explicit reference or octal escape');
    }
    const raw = this.source.slice(start, this.pos);
    if (!/[A-Za-z0-9]/.test(ch)) return this.node('literal', start, { value: ch });
    if (/^\\[1-9]$/.test(raw)) return this.node('backreference', start, { value: ch });
    return this.node('pcreEscape', start);
  }

  private quantify(child: ASTNode): ASTNode {
    if (this.quoted) return child;
    const tail = this.source.slice(this.pos);
    const match = /^(?:([*+?])|\{(\d+)(?:,(\d*))?\})([?+]?)/.exec(tail);
    if (!match) return child;
    const [raw, short, lo, hi, suffix] = match;
    const min = short ? (short === '+' ? 1 : 0) : Number(lo);
    const max = short
      ? short === '?'
        ? 1
        : null
      : hi === undefined
        ? min
        : hi === ''
          ? null
          : Number(hi);
    const quantifier: QuantifierInfo = {
      min,
      max,
      raw,
      lazy: suffix === '+' ? false : this.options.U !== (suffix === '?'),
      possessive: suffix === '+',
    };
    this.pos += raw.length;
    return this.node('quantifier', child.start, { value: raw, children: [child], quantifier });
  }
}

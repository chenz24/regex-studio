import type { ASTNode, QuantifierInfo } from '../types/regex';
import { decodeGroupName } from './regexNames';

let pos = 0;
let source = '';
let groupCounter = 0;
let totalGroups = 0;
let unicode = false;
let unicodeSets = false;
let hasNamedGroups = false;
let nodeIdCounter = 0;

function nextNodeId(): string {
  return `ast_${nodeIdCounter++}`;
}

function isEmptySequence(node: ASTNode): boolean {
  return node.type === 'sequence' && (node.children?.length ?? 0) === 0;
}

/** Count all capture slots, including groups after a forward reference. */
function countCaptures(pattern: string, unicodeSets: boolean): number {
  let count = 0;
  hasNamedGroups = false;
  let classDepth = 0;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      i++;
    } else if (ch === '[' && (classDepth === 0 || unicodeSets)) {
      classDepth++;
    } else if (ch === ']' && classDepth > 0) {
      classDepth--;
    } else if (ch === '(' && classDepth === 0) {
      if (
        pattern[i + 1] !== '?' ||
        (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') ||
        (pattern[i + 2] === 'P' && pattern[i + 3] === '<')
      ) {
        count++;
        if (pattern[i + 1] === '?') hasNamedGroups = true;
      }
    }
  }
  return count;
}

export function parseRegex(pattern: string, flags = ''): ASTNode {
  pos = 0;
  source = pattern;
  groupCounter = 0;
  unicodeSets = flags.includes('v');
  totalGroups = countCaptures(pattern, unicodeSets);
  unicode = flags.includes('u') || flags.includes('v');
  nodeIdCounter = 0;

  if (!pattern) {
    return {
      type: 'sequence',
      value: '',
      children: [],
      raw: '',
      id: nextNodeId(),
      start: 0,
      end: 0,
    };
  }

  try {
    const parts: ASTNode[] = [];

    // `parseAlternation` stops at a `)` it cannot consume. Rather than
    // dropping the rest of an unbalanced pattern on the floor — `a)b` used to
    // parse as just `a` — keep the stray delimiter as a literal and carry on,
    // so the diagram still shows everything the user typed.
    while (true) {
      const node = parseAlternation();
      if (!isEmptySequence(node)) parts.push(node);
      if (pos >= source.length) break;
      const strayStart = pos;
      const ch = source[pos];
      pos++;
      parts.push({
        type: 'literal',
        value: ch,
        raw: ch,
        id: nextNodeId(),
        start: strayStart,
        end: pos,
      });
    }

    if (parts.length === 1) return parts[0];
    return {
      type: 'sequence',
      value: '',
      children: parts,
      raw: source.slice(0, pos),
      id: nextNodeId(),
      start: 0,
      end: pos,
    };
  } catch {
    return {
      type: 'literal',
      value: pattern,
      raw: pattern,
      id: nextNodeId(),
      start: 0,
      end: pattern.length,
    };
  }
}

function parseAlternation(): ASTNode {
  const start = pos;
  const branches: ASTNode[] = [parseSequence()];

  while (pos < source.length && source[pos] === '|') {
    pos++;
    branches.push(parseSequence());
  }

  if (branches.length === 1) return branches[0];

  return {
    type: 'alternation',
    value: '|',
    children: branches,
    raw: branches.map((b) => b.raw).join('|'),
    id: nextNodeId(),
    start,
    end: pos,
  };
}

function parseSequence(): ASTNode {
  const start = pos;
  const nodes: ASTNode[] = [];

  while (pos < source.length && source[pos] !== ')' && source[pos] !== '|') {
    const node = parseAtom();
    if (node) {
      const quantified = tryParseQuantifier(node);
      nodes.push(quantified);
    }
  }

  if (nodes.length === 0) {
    return {
      type: 'sequence',
      value: '',
      children: [],
      raw: '',
      id: nextNodeId(),
      start,
      end: pos,
    };
  }
  if (nodes.length === 1) return nodes[0];

  return {
    type: 'sequence',
    value: '',
    children: nodes,
    raw: nodes.map((n) => n.raw).join(''),
    id: nextNodeId(),
    start,
    end: pos,
  };
}

const HEX_DIGIT = /[0-9a-fA-F]/;
/** Characters that can appear in an inline flag group such as `(?im-sx)`. */
const INLINE_FLAG_CHAR = /[a-zA-Z-]/;
/** Escapes that stand for a set of characters and so cannot bound a range. */
const CLASS_ESCAPE = /^\\[dDwWsSpP]/;
const CONTROL_LETTER = /[a-zA-Z]/;

/** Consume `count` hex digits, but only if that many are actually there. */
function consumeHexDigits(count: number): void {
  for (let i = 0; i < count; i++) {
    if (pos + i >= source.length || !HEX_DIGIT.test(source[pos + i])) return;
  }
  pos += count;
}

/** Consume a `{...}` payload, e.g. the `{L}` of `\p{L}`. */
function consumeBraced(): void {
  const close = source.indexOf('}', pos + 1);
  if (close !== -1) pos = close + 1;
}

/**
 * Consume one complete escape sequence starting at the current backslash and
 * return its raw text.
 *
 * Escapes are not uniformly two characters: `\x41`, `\u0041`, `\u{1F600}`,
 * `\cJ` and `\p{L}` all carry a payload. Stopping after the first character
 * leaves the rest to be parsed as literals, so `\x41+` came out as `\x`, `4`
 * and `1+` — with the quantifier bound to the wrong atom.
 */
function consumeEscapeSequence(): string {
  const start = pos;
  pos++; // the backslash
  if (pos >= source.length) return source.slice(start, pos);

  const ch = source[pos];
  pos++;

  // Annex B octal escapes have at most three digits, or two when the first
  // digit is 4–7. Leave any remaining digits for the next atom/quantifier.
  if (!unicode && ch >= '0' && ch <= '7') {
    const maxDigits = ch <= '3' ? 3 : 2;
    while (
      pos - start - 1 < maxDigits &&
      pos < source.length &&
      source[pos] >= '0' &&
      source[pos] <= '7'
    ) {
      pos++;
    }
    return source.slice(start, pos);
  }

  switch (ch) {
    case 'x':
      consumeHexDigits(2);
      break;
    case 'u':
      if (unicode && source[pos] === '{') consumeBraced();
      else consumeHexDigits(4);
      break;
    case 'c':
      if (pos < source.length && CONTROL_LETTER.test(source[pos])) pos++;
      break;
    case 'p':
    case 'P':
      if (unicode && source[pos] === '{') consumeBraced();
      break;
  }

  return source.slice(start, pos);
}

function parseAtom(): ASTNode | null {
  if (pos >= source.length) return null;

  const ch = source[pos];

  if (ch === '(') return parseGroup();
  if (ch === '[') return parseCharacterClass();
  if (ch === '\\') return parseEscape();
  if (ch === '.') {
    const s = pos;
    pos++;
    return { type: 'dot', value: '.', raw: '.', id: nextNodeId(), start: s, end: pos };
  }
  if (ch === '^') {
    const s = pos;
    pos++;
    return { type: 'anchor', value: '^', raw: '^', id: nextNodeId(), start: s, end: pos };
  }
  if (ch === '$') {
    const s = pos;
    pos++;
    return { type: 'anchor', value: '$', raw: '$', id: nextNodeId(), start: s, end: pos };
  }

  const s = pos;
  const literal = unicode ? String.fromCodePoint(source.codePointAt(pos)!) : ch;
  pos += literal.length;
  return { type: 'literal', value: literal, raw: literal, id: nextNodeId(), start: s, end: pos };
}

function parseGroup(): ASTNode {
  const start = pos;
  pos++;

  let type: ASTNode['type'] = 'group';
  let groupName: string | undefined;
  let groupIndex: number | undefined;
  let flagSpec: string | undefined;

  if (pos < source.length && source[pos] === '?') {
    pos++;
    const marker = source[pos];

    if (marker === ':') {
      type = 'nonCapturingGroup';
      pos++;
    } else if (marker === '=') {
      type = 'lookahead';
      pos++;
    } else if (marker === '!') {
      type = 'negativeLookahead';
      pos++;
    } else if (marker === '>') {
      // Atomic group (PCRE, Java, Ruby): matches once and never gives back.
      type = 'atomicGroup';
      pos++;
    } else if (marker === '<') {
      pos++;
      if (source[pos] === '=') {
        type = 'lookbehind';
        pos++;
      } else if (source[pos] === '!') {
        type = 'negativeLookbehind';
        pos++;
      } else {
        type = 'namedGroup';
        groupName = readGroupName();
        groupCounter++;
        groupIndex = groupCounter;
      }
    } else if (marker === 'P' && source[pos + 1] === '<') {
      // Python's spelling of a named group.
      pos += 2;
      type = 'namedGroup';
      groupName = readGroupName();
      groupCounter++;
      groupIndex = groupCounter;
    } else if (marker === 'P' && source[pos + 1] === '=') {
      // Python's spelling of a named backreference — a whole construct, not
      // a group.
      pos += 2;
      let name = '';
      while (pos < source.length && source[pos] !== ')') {
        name += source[pos];
        pos++;
      }
      if (pos < source.length) pos++;
      return {
        type: 'backreference',
        value: name,
        groupName: name,
        raw: source.slice(start, pos),
        id: nextNodeId(),
        start,
        end: pos,
      };
    } else if (marker !== undefined && INLINE_FLAG_CHAR.test(marker)) {
      // `(?i)` switches flags on from here; `(?i:…)` scopes them to a group.
      const flagsStart = pos;
      while (pos < source.length && INLINE_FLAG_CHAR.test(source[pos])) pos++;
      const flags = source.slice(flagsStart, pos);
      if (source[pos] === ':') {
        pos++;
        type = 'nonCapturingGroup';
        flagSpec = flags;
      } else {
        if (source[pos] === ')') pos++;
        return {
          type: 'inlineFlags',
          value: flags,
          raw: source.slice(start, pos),
          id: nextNodeId(),
          start,
          end: pos,
        };
      }
    }
  } else {
    groupCounter++;
    groupIndex = groupCounter;
  }

  const openLen = pos - start;

  const content = parseAlternation();

  if (pos < source.length && source[pos] === ')') {
    pos++;
  }

  const raw = source.slice(start, pos);

  return {
    type,
    value: raw,
    children: content.type === 'sequence' && content.children ? content.children : [content],
    groupName,
    groupIndex,
    flagSpec,
    openLen,
    raw,
    id: nextNodeId(),
    start,
    end: pos,
  };
}

/** Read a group name up to and including the closing `>`. */
function readGroupName(): string {
  let name = '';
  while (pos < source.length && source[pos] !== '>') {
    name += source[pos];
    pos++;
  }
  if (pos < source.length) pos++;
  return decodeGroupName(name);
}

function parseCharacterClass(): ASTNode {
  // Set operations and string alternatives are one regex atom. Keep their
  // exact source instead of flattening operators into literal characters.
  if (unicodeSets) {
    const set = parseUnicodeSet();
    if (set) return set;
  }
  const start = pos;
  pos++;

  let negated = false;
  if (pos < source.length && source[pos] === '^') {
    negated = true;
    pos++;
  }

  const items: ASTNode[] = [];

  while (pos < source.length && source[pos] !== ']') {
    if (source[pos] === '\\' && pos + 1 < source.length) {
      const escStart = pos;
      const escRaw = consumeEscapeSequence();

      const escNode: ASTNode = {
        type: 'escape',
        value: escRaw,
        raw: escRaw,
        id: nextNodeId(),
        start: escStart,
        end: pos,
      };

      // `[\d-z]` is not a range: a shorthand class has no single code point
      // to count from, so the `-` is a literal.
      if (
        pos < source.length &&
        source[pos] === '-' &&
        pos + 1 < source.length &&
        source[pos + 1] !== ']' &&
        !CLASS_ESCAPE.test(escNode.value)
      ) {
        const rangeStart = escStart;
        pos++;
        const rangeEnd = parseClassAtom();
        items.push({
          type: 'range',
          value: `${escNode.value}-${rangeEnd.value}`,
          children: [escNode, rangeEnd],
          raw: `${escNode.raw}-${rangeEnd.raw}`,
          id: nextNodeId(),
          start: rangeStart,
          end: pos,
        });
      } else {
        items.push(escNode);
      }
    } else {
      const atomStart = pos;
      const ch = unicode ? String.fromCodePoint(source.codePointAt(pos)!) : source[pos];
      pos += ch.length;

      const atomNode: ASTNode = {
        type: 'literal',
        value: ch,
        raw: ch,
        id: nextNodeId(),
        start: atomStart,
        end: pos,
      };

      if (
        pos < source.length &&
        source[pos] === '-' &&
        pos + 1 < source.length &&
        source[pos + 1] !== ']' &&
        !CLASS_ESCAPE.test(source.slice(pos + 1, pos + 3))
      ) {
        pos++;
        const rangeEnd = parseClassAtom();
        items.push({
          type: 'range',
          value: `${ch}-${rangeEnd.value}`,
          children: [atomNode, rangeEnd],
          raw: source.slice(atomStart, pos),
          id: nextNodeId(),
          start: atomStart,
          end: pos,
        });
      } else {
        items.push(atomNode);
      }
    }
  }

  if (pos < source.length) pos++;

  const raw = source.slice(start, pos);

  return {
    type: negated ? 'negatedCharacterClass' : 'characterClass',
    value: raw,
    children: items,
    raw,
    id: nextNodeId(),
    start,
    end: pos,
  };
}

function parseUnicodeSet(): ASTNode | null {
  const start = pos;
  let depth = 1;
  let complex = false;
  let end = start + 1;
  for (; end < source.length && depth > 0; end++) {
    const ch = source[end];
    if (ch === '\\') {
      const escaped = source[++end];
      if ((escaped === 'q' || escaped === 'p' || escaped === 'P') && source[end + 1] === '{') {
        complex = true;
        end += 2;
        while (end < source.length && source[end] !== '}') {
          if (source[end] === '\\') end++;
          end++;
        }
      }
    } else if (ch === '[') {
      depth++;
      complex = true;
    } else if (ch === ']') {
      depth--;
    } else if ((ch === '&' || ch === '-') && source[end + 1] === ch) {
      complex = true;
    }
  }
  if (!complex) return null;
  pos = Math.min(end, source.length);
  const raw = source.slice(start, pos);
  return {
    type: source[start + 1] === '^' ? 'negatedCharacterClass' : 'characterClass',
    unicodeSet: true,
    value: raw,
    raw,
    id: nextNodeId(),
    start,
    end: pos,
  };
}

function parseClassAtom(): ASTNode {
  if (source[pos] === '\\' && pos + 1 < source.length) {
    const start = pos;
    const raw = consumeEscapeSequence();
    return { type: 'escape', value: raw, raw, id: nextNodeId(), start, end: pos };
  }
  const s = pos;
  const ch = unicode ? String.fromCodePoint(source.codePointAt(pos)!) : source[pos];
  pos += ch.length;
  return { type: 'literal', value: ch, raw: ch, id: nextNodeId(), start: s, end: pos };
}

function parseEscape(): ASTNode {
  const start = pos;
  if (pos + 1 >= source.length) {
    pos++;
    return { type: 'literal', value: '\\', raw: '\\', id: nextNodeId(), start, end: pos };
  }

  const ch = source[pos + 1];

  // A decimal escape is a backreference only if that capture slot exists
  // anywhere in the pattern. Otherwise legacy mode falls back to octal or
  // an identity escape (8/9); Unicode mode retains the invalid escape for
  // display, while native syntax validation rejects it before debugging.
  if (ch >= '1' && ch <= '9') {
    let end = pos + 2;
    while (end < source.length && source[end] >= '0' && source[end] <= '9') end++;
    const digits = source.slice(pos + 1, end);
    const isReference = Number(digits) <= totalGroups;
    if (isReference || unicode) {
      pos = end;
      const raw = source.slice(start, pos);
      return {
        type: isReference ? 'backreference' : 'escape',
        value: isReference ? digits : raw,
        raw,
        id: nextNodeId(),
        start,
        end: pos,
      };
    }
  }

  // Named backreference `\k<name>`.
  if (ch === 'k' && source[pos + 2] === '<' && (unicode || hasNamedGroups)) {
    const close = source.indexOf('>', pos + 3);
    if (close !== -1) {
      const name = decodeGroupName(source.slice(pos + 3, close));
      pos = close + 1;
      return {
        type: 'backreference',
        value: name,
        groupName: name,
        raw: source.slice(start, pos),
        id: nextNodeId(),
        start,
        end: pos,
      };
    }
  }

  let raw = consumeEscapeSequence();
  // A pair of escaped UTF-16 surrogates is one atom in Unicode mode, so
  // the following quantifier applies to the whole code point.
  if (unicode && /^\\u[dD][89aAbB][\da-fA-F]{2}$/.test(raw)) {
    const trail = source.slice(pos, pos + 6);
    if (/^\\u[dD][c-fC-F][\da-fA-F]{2}$/.test(trail)) {
      raw += trail;
      pos += trail.length;
    }
  }
  return { type: 'escape', value: raw, raw, id: nextNodeId(), start, end: pos };
}

function tryParseQuantifier(node: ASTNode): ASTNode {
  if (pos >= source.length) return node;

  let qInfo: QuantifierInfo | null = null;

  const ch = source[pos];

  if (ch === '*') {
    pos++;
    qInfo = { min: 0, max: null, lazy: false, raw: '*' };
  } else if (ch === '+') {
    pos++;
    qInfo = { min: 1, max: null, lazy: false, raw: '+' };
  } else if (ch === '?') {
    pos++;
    qInfo = { min: 0, max: 1, lazy: false, raw: '?' };
  } else if (ch === '{') {
    const braceStart = pos;
    pos++;
    let numStr = '';
    while (pos < source.length && source[pos] >= '0' && source[pos] <= '9') {
      numStr += source[pos];
      pos++;
    }
    if (numStr && pos < source.length) {
      if (source[pos] === '}') {
        pos++;
        const n = parseInt(numStr, 10);
        qInfo = { min: n, max: n, lazy: false, raw: source.slice(braceStart, pos) };
      } else if (source[pos] === ',') {
        pos++;
        let maxStr = '';
        while (pos < source.length && source[pos] >= '0' && source[pos] <= '9') {
          maxStr += source[pos];
          pos++;
        }
        if (pos < source.length && source[pos] === '}') {
          pos++;
          qInfo = {
            min: parseInt(numStr, 10),
            max: maxStr ? parseInt(maxStr, 10) : null,
            lazy: false,
            raw: source.slice(braceStart, pos),
          };
        } else {
          pos = braceStart;
        }
      } else {
        pos = braceStart;
      }
    } else {
      pos = braceStart;
    }
  }

  if (!qInfo) return node;

  if (pos < source.length && source[pos] === '?') {
    qInfo.lazy = true;
    qInfo.raw += '?';
    pos++;
  }

  return {
    type: 'quantifier',
    value: qInfo.raw,
    children: [node],
    quantifier: qInfo,
    raw: node.raw + qInfo.raw,
    id: nextNodeId(),
    start: node.start,
    end: pos,
  };
}

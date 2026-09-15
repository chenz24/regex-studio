import type { ASTNode, QuantifierInfo } from '../types/regex';

let pos = 0;
let source = '';
let groupCounter = 0;
let nodeIdCounter = 0;

function nextNodeId(): string {
  return `ast_${nodeIdCounter++}`;
}

export function parseRegex(pattern: string): ASTNode {
  pos = 0;
  source = pattern;
  groupCounter = 0;
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
    const node = parseAlternation();
    return node;
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

  switch (ch) {
    case 'x':
      consumeHexDigits(2);
      break;
    case 'u':
      if (source[pos] === '{') consumeBraced();
      else consumeHexDigits(4);
      break;
    case 'c':
      if (pos < source.length && CONTROL_LETTER.test(source[pos])) pos++;
      break;
    case 'p':
    case 'P':
      if (source[pos] === '{') consumeBraced();
      break;
    case '0':
      // `\0` is NUL; legacy octal escapes carry up to two more digits.
      while (pos < source.length && source[pos] >= '0' && source[pos] <= '7') pos++;
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
  pos++;
  return { type: 'literal', value: ch, raw: ch, id: nextNodeId(), start: s, end: pos };
}

function parseGroup(): ASTNode {
  const start = pos;
  pos++;

  let type: ASTNode['type'] = 'group';
  let groupName: string | undefined;
  let groupIndex: number | undefined;

  if (pos < source.length && source[pos] === '?') {
    pos++;
    if (pos < source.length) {
      if (source[pos] === ':') {
        type = 'nonCapturingGroup';
        pos++;
      } else if (source[pos] === '=') {
        type = 'lookahead';
        pos++;
      } else if (source[pos] === '!') {
        type = 'negativeLookahead';
        pos++;
      } else if (source[pos] === '<') {
        pos++;
        if (pos < source.length && source[pos] === '=') {
          type = 'lookbehind';
          pos++;
        } else if (pos < source.length && source[pos] === '!') {
          type = 'negativeLookbehind';
          pos++;
        } else {
          type = 'namedGroup';
          let name = '';
          while (pos < source.length && source[pos] !== '>') {
            name += source[pos];
            pos++;
          }
          if (pos < source.length) pos++;
          groupName = name;
          groupCounter++;
          groupIndex = groupCounter;
        }
      }
    }
  } else {
    groupCounter++;
    groupIndex = groupCounter;
  }

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
    raw,
    id: nextNodeId(),
    start,
    end: pos,
  };
}

function parseCharacterClass(): ASTNode {
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

      if (
        pos < source.length &&
        source[pos] === '-' &&
        pos + 1 < source.length &&
        source[pos + 1] !== ']'
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
      const ch = source[pos];
      pos++;

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
        source[pos + 1] !== ']'
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

function parseClassAtom(): ASTNode {
  if (source[pos] === '\\' && pos + 1 < source.length) {
    const start = pos;
    const raw = consumeEscapeSequence();
    return { type: 'escape', value: raw, raw, id: nextNodeId(), start, end: pos };
  }
  const s = pos;
  const ch = source[pos];
  pos++;
  return { type: 'literal', value: ch, raw: ch, id: nextNodeId(), start: s, end: pos };
}

function parseEscape(): ASTNode {
  const start = pos;
  if (pos + 1 >= source.length) {
    pos++;
    return { type: 'literal', value: '\\', raw: '\\', id: nextNodeId(), start, end: pos };
  }

  const ch = source[pos + 1];

  // Numbered backreference — `\10` is group 10, not group 1 followed by `0`.
  if (ch >= '1' && ch <= '9') {
    pos += 2;
    let digits = ch;
    while (pos < source.length && source[pos] >= '0' && source[pos] <= '9') {
      digits += source[pos];
      pos++;
    }
    return {
      type: 'backreference',
      value: digits,
      raw: source.slice(start, pos),
      id: nextNodeId(),
      start,
      end: pos,
    };
  }

  // Named backreference `\k<name>`.
  if (ch === 'k' && source[pos + 2] === '<') {
    const close = source.indexOf('>', pos + 3);
    if (close !== -1) {
      const name = source.slice(pos + 3, close);
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

  const raw = consumeEscapeSequence();
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

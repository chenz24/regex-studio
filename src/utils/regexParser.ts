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
      pos++;
      const escaped = source[pos];
      pos++;

      const escNode: ASTNode = {
        type: 'escape',
        value: `\\${escaped}`,
        raw: source.slice(escStart, pos),
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
    pos++;
    const ch = source[pos];
    pos++;
    return {
      type: 'escape',
      value: `\\${ch}`,
      raw: source.slice(start, pos),
      id: nextNodeId(),
      start,
      end: pos,
    };
  }
  const s = pos;
  const ch = source[pos];
  pos++;
  return { type: 'literal', value: ch, raw: ch, id: nextNodeId(), start: s, end: pos };
}

function parseEscape(): ASTNode {
  const start = pos;
  pos++;
  if (pos >= source.length) {
    return { type: 'literal', value: '\\', raw: '\\', id: nextNodeId(), start, end: pos };
  }

  const ch = source[pos];
  pos++;

  if (ch >= '1' && ch <= '9') {
    return {
      type: 'backreference',
      value: ch,
      raw: source.slice(start, pos),
      id: nextNodeId(),
      start,
      end: pos,
    };
  }

  return {
    type: 'escape',
    value: `\\${ch}`,
    raw: source.slice(start, pos),
    id: nextNodeId(),
    start,
    end: pos,
  };
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

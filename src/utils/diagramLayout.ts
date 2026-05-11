import type { ASTNode } from '../types/regex';
import { buildIR } from './diagramIR';
import type { IR, IRCharItem } from './diagramIR';

export interface LayoutResult {
  nodes: DrawRect[];
  texts: DrawText[];
  paths: DrawPath[];
  badges: DrawBadge[];
  width: number;
  height: number;
  entryY: number;
}

export interface DrawRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  fill: string;
  darkFill: string;
  stroke: string;
  darkStroke: string;
  strokeDash?: string;
  nodeId?: string;
  layer: 'container' | 'node';
}

export interface DrawText {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  darkFill: string;
  anchor: 'middle' | 'start';
  fontWeight: number;
  nodeId?: string;
  layer: 'label' | 'node';
}

export interface DrawPath {
  d: string;
  stroke: string;
  darkStroke: string;
  strokeWidth: number;
  strokeDash?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  markerEnd?: string;
}

export interface DrawBadge {
  x: number;
  y: number;
  text: string;
  fill: string;
  darkFill: string;
  textColor: string;
  darkTextColor: string;
  nodeId?: string;
}

const T = {
  H: 28,
  XGAP: 16,
  YGAP: 14,
  PAD: 12,
  TITLE_H: 18,
  RAIL_GAP: 14,
  SIDE_PAD: 14,
  CHAR_W: 8.4,
  NODE_PAD_X: 10,
  NODE_PAD_Y: 0,
  STROKE_W: 2,
  CORNER_R: 10,
  POINT_R: 10,
  ENTRY_GAP: 20,
  CHARSET_ITEM_H: 24,
  CHARSET_ITEM_GAP: 4,
  CHARSET_PAD: 8,
  CHARSET_LABEL_H: 16,
  BADGE_H: 18,
  BADGE_PAD_X: 8,
};

function textW(s: string): number {
  return s.length * T.CHAR_W;
}
function nodeW(label: string): number {
  return Math.max(textW(label) + T.NODE_PAD_X * 2, 40);
}

interface Measure {
  w: number;
  h: number;
  railY: number;
}

function measureIR(ir: IR): Measure {
  switch (ir.type) {
    case 'Start':
    case 'End':
      return { w: T.POINT_R * 2, h: T.POINT_R * 2, railY: T.POINT_R };

    case 'Literal':
      return { w: nodeW(`"${ir.text}"`), h: T.H, railY: T.H / 2 };

    case 'Token':
      return { w: nodeW(ir.label), h: T.H, railY: T.H / 2 };

    case 'Anchor':
      return { w: nodeW(ir.label), h: T.H, railY: T.H / 2 };

    case 'Backref':
      return { w: nodeW(`Backref #${ir.ref}`), h: T.H, railY: T.H / 2 };

    case 'CharClass': {
      const { rows, maxRowW } = charClassRows(ir.items);
      const w = maxRowW + T.CHARSET_PAD * 2;
      let rowsH = 0;
      for (let r = 0; r < rows.length; r++) {
        rowsH += T.CHARSET_ITEM_H;
        if (r < rows.length - 1) rowsH += T.CHARSET_ITEM_GAP;
      }
      const h = T.CHARSET_LABEL_H + T.CHARSET_PAD + rowsH + T.CHARSET_PAD;
      return { w, h, railY: h / 2 };
    }

    case 'Sequence': {
      if (ir.children.length === 0) return { w: 0, h: T.H, railY: T.H / 2 };
      const ms = ir.children.map(measureIR);
      let totalW = 0;
      let maxAbove = 0;
      let maxBelow = 0;
      for (let i = 0; i < ms.length; i++) {
        totalW += ms[i].w;
        if (i > 0) totalW += T.XGAP;
        maxAbove = Math.max(maxAbove, ms[i].railY);
        maxBelow = Math.max(maxBelow, ms[i].h - ms[i].railY);
      }
      const h = maxAbove + maxBelow;
      return { w: totalW, h, railY: maxAbove };
    }

    case 'Choice': {
      const ms = ir.alts.map(measureIR);
      const maxW = Math.max(...ms.map((m) => m.w));
      const innerW = maxW + T.SIDE_PAD * 2;
      const labelH = T.CHARSET_LABEL_H;
      let totalH = labelH;
      for (let i = 0; i < ms.length; i++) {
        totalH += ms[i].h;
        if (i < ms.length - 1) totalH += T.YGAP;
      }
      const h = totalH;
      const firstRailY = labelH + ms[0].railY;
      const lastRailY = totalH - ms[ms.length - 1].h + ms[ms.length - 1].railY;
      const railY = (firstRailY + lastRailY) / 2;
      return { w: innerW, h, railY };
    }

    case 'Group': {
      const inner = measureIR(ir.child);
      const w = inner.w + T.PAD * 2;
      const h = inner.h + T.PAD * 2 + T.TITLE_H;
      const railY = T.TITLE_H + T.PAD + inner.railY;
      return { w, h, railY };
    }

    case 'Quantifier': {
      const inner = measureIR(ir.child);
      const hasBypass = ir.min === 0;
      const hasLoop = ir.max === null || ir.max > 1;
      const extraTop = hasBypass && hasLoop ? T.RAIL_GAP : 0;
      const extraBottom = hasLoop ? T.RAIL_GAP + T.BADGE_H : 0;
      const noLoopBadge = !hasLoop && (ir.min !== 1 || ir.max !== 1) ? T.BADGE_H + 4 : 0;
      const w = inner.w + T.SIDE_PAD * 2;
      const h = inner.h + extraTop + extraBottom + noLoopBadge;
      const railY = extraTop + inner.railY;
      return { w, h, railY };
    }
  }
}

function charItemLabel(item: IRCharItem): string {
  switch (item.kind) {
    case 'token':
      return item.label;
    case 'literal':
      return `"${item.text}"`;
    case 'range':
      return `${item.from}\u2013${item.to}`;
  }
}

const BADGE_GAP = 6;

function isLetterRange(item: IRCharItem): boolean {
  if (item.kind !== 'range') return false;
  const f = item.from.charCodeAt(0);
  const t = item.to.charCodeAt(0);
  return (f >= 65 && t <= 90) || (f >= 97 && t <= 122);
}

function isDigitRange(item: IRCharItem): boolean {
  if (item.kind !== 'range') return false;
  const f = item.from.charCodeAt(0);
  const t = item.to.charCodeAt(0);
  return f >= 48 && t <= 57;
}

function charClassRows(items: IRCharItem[]): { rows: IRCharItem[][]; maxRowW: number } {
  const literals = items.filter((i) => i.kind === 'literal');
  const letterRanges = items.filter(isLetterRange);
  const digitRanges = items.filter(isDigitRange);
  const tokens = items.filter((i) => i.kind === 'token');
  const otherRanges = items.filter(
    (i) => i.kind === 'range' && !isLetterRange(i) && !isDigitRange(i),
  );

  const rows: IRCharItem[][] = [];
  if (literals.length > 0) rows.push(literals);
  if (letterRanges.length > 0) rows.push(letterRanges);
  if (digitRanges.length > 0) rows.push(digitRanges);
  if (otherRanges.length > 0) rows.push(otherRanges);
  if (tokens.length > 0) rows.push(tokens);

  let maxRowW = 0;
  for (const row of rows) {
    let rowW = 0;
    for (let i = 0; i < row.length; i++) {
      if (i > 0) rowW += BADGE_GAP;
      rowW += nodeW(charItemLabel(row[i]));
    }
    maxRowW = Math.max(maxRowW, rowW);
  }

  return { rows, maxRowW };
}

interface Placed {
  rects: DrawRect[];
  texts: DrawText[];
  paths: DrawPath[];
  badges: DrawBadge[];
  portIn: { x: number; y: number };
  portOut: { x: number; y: number };
}

function hLine(x1: number, y: number, x2: number): DrawPath {
  if (Math.abs(x2 - x1) < 0.5)
    return { d: '', stroke: '#333', darkStroke: '#94a3b8', strokeWidth: 0 };
  return {
    d: `M${x1},${y} H${x2}`,
    stroke: '#333',
    darkStroke: '#94a3b8',
    strokeWidth: T.STROKE_W,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

function orthoFork(fromX: number, fromY: number, toX: number, toY: number): DrawPath {
  const r = T.CORNER_R;
  const dy = toY - fromY;
  if (Math.abs(dy) < 1) return hLine(fromX, fromY, toX);
  const signY = dy > 0 ? 1 : -1;
  const ady = Math.abs(dy);
  const curveR = Math.min(r, ady / 2, Math.abs(toX - fromX) / 2);
  const d = [
    `M${fromX},${fromY}`,
    `H${fromX + curveR}`,
    `Q${fromX + curveR},${fromY} ${fromX + curveR},${fromY + curveR * signY}`,
    `V${toY - curveR * signY}`,
    `Q${fromX + curveR},${toY} ${fromX + curveR * 2},${toY}`,
    `H${toX}`,
  ].join(' ');
  return {
    d,
    stroke: '#333',
    darkStroke: '#94a3b8',
    strokeWidth: T.STROKE_W,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

function orthoJoin(fromX: number, fromY: number, toX: number, toY: number): DrawPath {
  const r = T.CORNER_R;
  const dy = toY - fromY;
  if (Math.abs(dy) < 1) return hLine(fromX, fromY, toX);
  const signY = dy > 0 ? -1 : 1;
  const ady = Math.abs(dy);
  const curveR = Math.min(r, ady / 2, Math.abs(toX - fromX) / 2);
  const d = [
    `M${fromX},${fromY}`,
    `H${toX - curveR * 2}`,
    `Q${toX - curveR},${fromY} ${toX - curveR},${fromY - curveR * signY}`,
    `V${toY + curveR * signY}`,
    `Q${toX - curveR},${toY} ${toX},${toY}`,
  ].join(' ');
  return {
    d,
    stroke: '#333',
    darkStroke: '#94a3b8',
    strokeWidth: T.STROKE_W,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

function layoutIR(ir: IR, x: number, _y: number, railAbsY: number): Placed {
  switch (ir.type) {
    case 'Start': {
      const cy = railAbsY;
      return {
        rects: [
          {
            x: x,
            y: cy - T.POINT_R,
            w: T.POINT_R * 2,
            h: T.POINT_R * 2,
            rx: T.POINT_R,
            fill: 'url(#startGrad)',
            darkFill: 'url(#startGradDark)',
            stroke: 'none',
            darkStroke: 'none',
            layer: 'node',
          },
        ],
        texts: [],
        paths: [],
        badges: [],
        portIn: { x, y: cy },
        portOut: { x: x + T.POINT_R * 2, y: cy },
      };
    }
    case 'End': {
      const cy = railAbsY;
      return {
        rects: [
          {
            x: x,
            y: cy - T.POINT_R,
            w: T.POINT_R * 2,
            h: T.POINT_R * 2,
            rx: T.POINT_R,
            fill: 'url(#endGrad)',
            darkFill: 'url(#endGradDark)',
            stroke: 'none',
            darkStroke: 'none',
            layer: 'node',
          },
        ],
        texts: [],
        paths: [],
        badges: [],
        portIn: { x, y: cy },
        portOut: { x: x + T.POINT_R * 2, y: cy },
      };
    }

    case 'Literal': {
      const label = `"${ir.text}"`;
      const w = nodeW(label);
      const ny = railAbsY - T.H / 2;
      return {
        rects: [
          {
            x,
            y: ny,
            w,
            h: T.H,
            rx: 3,
            fill: '#87ceeb',
            darkFill: '#1e3a5f',
            stroke: 'none',
            darkStroke: 'none',
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        texts: [
          {
            x: x + w / 2,
            y: railAbsY,
            text: label,
            fontSize: 13,
            fill: '#000',
            darkFill: '#bae6fd',
            anchor: 'middle',
            fontWeight: 500,
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        paths: [],
        badges: [],
        portIn: { x, y: railAbsY },
        portOut: { x: x + w, y: railAbsY },
      };
    }

    case 'Token': {
      const w = nodeW(ir.label);
      const ny = railAbsY - T.H / 2;
      const isRange = ir.kind === 'range';
      const fill = isRange ? '#008080' : '#008000';
      const darkFill = isRange ? '#115e59' : '#14532d';
      return {
        rects: [
          {
            x,
            y: ny,
            w,
            h: T.H,
            rx: 5,
            fill,
            darkFill,
            stroke: 'none',
            darkStroke: 'none',
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        texts: [
          {
            x: x + w / 2,
            y: railAbsY,
            text: ir.label,
            fontSize: 13,
            fill: '#fff',
            darkFill: isRange ? '#ccfbf1' : '#bbf7d0',
            anchor: 'middle',
            fontWeight: 500,
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        paths: [],
        badges: [],
        portIn: { x, y: railAbsY },
        portOut: { x: x + w, y: railAbsY },
      };
    }

    case 'Anchor': {
      const w = nodeW(ir.label);
      const ny = railAbsY - T.H / 2;
      const isBoundary = ir.kind === 'wordBoundary' || ir.kind === 'nonWordBoundary';
      const fill = isBoundary ? '#800080' : '#4b0082';
      const darkFill = isBoundary ? '#581c87' : '#312e81';
      return {
        rects: [
          {
            x,
            y: ny,
            w,
            h: T.H,
            rx: 3,
            fill,
            darkFill,
            stroke: 'none',
            darkStroke: 'none',
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        texts: [
          {
            x: x + w / 2,
            y: railAbsY,
            text: ir.label,
            fontSize: 13,
            fill: '#fff',
            darkFill: '#c7d2fe',
            anchor: 'middle',
            fontWeight: 500,
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        paths: [],
        badges: [],
        portIn: { x, y: railAbsY },
        portOut: { x: x + w, y: railAbsY },
      };
    }

    case 'Backref': {
      const label = `Backref #${ir.ref}`;
      const w = nodeW(label);
      const ny = railAbsY - T.H / 2;
      return {
        rects: [
          {
            x,
            y: ny,
            w,
            h: T.H,
            rx: 8,
            fill: '#000080',
            darkFill: '#1e1b4b',
            stroke: 'none',
            darkStroke: 'none',
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        texts: [
          {
            x: x + w / 2,
            y: railAbsY,
            text: label,
            fontSize: 13,
            fill: '#fff',
            darkFill: '#a5b4fc',
            anchor: 'middle',
            fontWeight: 500,
            nodeId: ir.id,
            layer: 'node',
          },
        ],
        paths: [],
        badges: [],
        portIn: { x, y: railAbsY },
        portOut: { x: x + w, y: railAbsY },
      };
    }

    case 'CharClass':
      return layoutCharClass(ir, x, railAbsY);

    case 'Sequence':
      return layoutSequence(ir, x, railAbsY);

    case 'Choice':
      return layoutChoice(ir, x, railAbsY);

    case 'Group':
      return layoutGroup(ir, x, railAbsY);

    case 'Quantifier':
      return layoutQuantifier(ir, x, railAbsY);
  }
}

function layoutCharClass(ir: IR & { type: 'CharClass' }, x: number, railAbsY: number): Placed {
  const m = measureIR(ir);
  const { rows, maxRowW } = charClassRows(ir.items);
  const topY = railAbsY - m.railY;
  const rects: DrawRect[] = [];
  const texts: DrawText[] = [];

  const containerFill = ir.negated ? '#ffc0cb' : '#f0e68c';
  const containerDark = ir.negated ? '#4c1d2e' : '#3f3510';

  rects.push({
    x,
    y: topY,
    w: m.w,
    h: m.h,
    rx: 4,
    fill: containerFill,
    darkFill: containerDark,
    stroke: 'none',
    darkStroke: 'none',
    nodeId: ir.id,
    layer: 'container',
  });

  const title = ir.negated ? 'None of:' : 'One of:';
  texts.push({
    x: x + T.CHARSET_PAD,
    y: topY + T.CHARSET_LABEL_H - 2,
    text: title,
    fontSize: 11,
    fill: ir.negated ? '#c00' : '#333',
    darkFill: ir.negated ? '#fca5a5' : '#e2e8f0',
    anchor: 'start',
    fontWeight: 600,
    layer: 'label',
  });

  let itemY = topY + T.CHARSET_LABEL_H + T.CHARSET_PAD;
  for (const row of rows) {
    let rowW = 0;
    for (let i = 0; i < row.length; i++) {
      if (i > 0) rowW += BADGE_GAP;
      rowW += nodeW(charItemLabel(row[i]));
    }
    let ix = x + T.CHARSET_PAD + (maxRowW - rowW) / 2;

    for (const item of row) {
      const label = charItemLabel(item);
      const iw = nodeW(label);
      let fill = '#87cefa';
      let darkFill = '#1e3a5f';
      let textColor = '#000';
      let darkTextColor = '#bae6fd';
      if (item.kind === 'token') {
        fill = '#008000';
        darkFill = '#14532d';
        textColor = '#fff';
        darkTextColor = '#bbf7d0';
      }
      if (item.kind === 'range') {
        fill = '#008080';
        darkFill = '#115e59';
        textColor = '#fff';
        darkTextColor = '#ccfbf1';
      }

      rects.push({
        x: ix,
        y: itemY,
        w: iw,
        h: T.CHARSET_ITEM_H,
        rx: 5,
        fill,
        darkFill,
        stroke: 'none',
        darkStroke: 'none',
        nodeId: ir.id,
        layer: 'node',
      });
      texts.push({
        x: ix + iw / 2,
        y: itemY + T.CHARSET_ITEM_H / 2,
        text: label,
        fontSize: 12,
        fill: textColor,
        darkFill: darkTextColor,
        anchor: 'middle',
        fontWeight: 500,
        nodeId: ir.id,
        layer: 'node',
      });
      ix += iw + BADGE_GAP;
    }

    itemY += T.CHARSET_ITEM_H + T.CHARSET_ITEM_GAP;
  }

  return {
    rects,
    texts,
    paths: [],
    badges: [],
    portIn: { x, y: railAbsY },
    portOut: { x: x + m.w, y: railAbsY },
  };
}

function layoutSequence(ir: IR & { type: 'Sequence' }, x: number, railAbsY: number): Placed {
  if (ir.children.length === 0) {
    return {
      rects: [],
      texts: [],
      paths: [],
      badges: [],
      portIn: { x, y: railAbsY },
      portOut: { x, y: railAbsY },
    };
  }

  const ms = ir.children.map(measureIR);
  const allRects: DrawRect[] = [];
  const allTexts: DrawText[] = [];
  const allPaths: DrawPath[] = [];
  const allBadges: DrawBadge[] = [];
  const ports: { in: { x: number; y: number }; out: { x: number; y: number } }[] = [];

  let cx = x;
  for (let i = 0; i < ir.children.length; i++) {
    const child = ir.children[i];
    const cm = ms[i];
    const childY = railAbsY - cm.railY;
    const placed = layoutIR(child, cx, childY, railAbsY);
    allRects.push(...placed.rects);
    allTexts.push(...placed.texts);
    allPaths.push(...placed.paths);
    allBadges.push(...placed.badges);
    ports.push({ in: placed.portIn, out: placed.portOut });
    cx += cm.w + T.XGAP;
  }

  for (let i = 0; i < ports.length - 1; i++) {
    const p = hLine(ports[i].out.x, ports[i].out.y, ports[i + 1].in.x);
    if (p.strokeWidth > 0) allPaths.push(p);
  }

  return {
    rects: allRects,
    texts: allTexts,
    paths: allPaths,
    badges: allBadges,
    portIn: ports[0].in,
    portOut: ports[ports.length - 1].out,
  };
}

function layoutChoice(ir: IR & { type: 'Choice' }, x: number, railAbsY: number): Placed {
  const ms = ir.alts.map(measureIR);
  const m = measureIR(ir);
  const topY = railAbsY - m.railY;
  const labelH = T.CHARSET_LABEL_H;

  const maxW = Math.max(...ms.map((mi) => mi.w));
  const allRects: DrawRect[] = [];
  const allTexts: DrawText[] = [];
  const allPaths: DrawPath[] = [];
  const allBadges: DrawBadge[] = [];

  allTexts.push({
    x: x + T.SIDE_PAD,
    y: topY + labelH - 2,
    text: 'One of:',
    fontSize: 11,
    fill: '#333',
    darkFill: '#e2e8f0',
    anchor: 'start',
    fontWeight: 600,
    layer: 'label',
  });

  const forkX = x;
  const joinX = x + m.w;
  const innerLeft = x + T.SIDE_PAD;

  let curY = topY + labelH;
  for (let i = 0; i < ir.alts.length; i++) {
    const alt = ir.alts[i];
    const cm = ms[i];
    const altRailAbsY = curY + cm.railY;
    const altCenterX = innerLeft + (maxW - cm.w) / 2;

    const placed = layoutIR(alt, altCenterX, curY, altRailAbsY);
    allRects.push(...placed.rects);
    allTexts.push(...placed.texts);
    allPaths.push(...placed.paths);
    allBadges.push(...placed.badges);

    allPaths.push(orthoFork(forkX, railAbsY, placed.portIn.x, altRailAbsY));

    if (placed.portIn.x > innerLeft) {
      allPaths.push(hLine(innerLeft, altRailAbsY, placed.portIn.x));
    }

    const innerRight = innerLeft + maxW;
    if (placed.portOut.x < innerRight) {
      allPaths.push(hLine(placed.portOut.x, altRailAbsY, innerRight));
    }

    allPaths.push(orthoJoin(Math.max(placed.portOut.x, innerRight), altRailAbsY, joinX, railAbsY));

    curY += cm.h + T.YGAP;
  }

  return {
    rects: allRects,
    texts: allTexts,
    paths: allPaths,
    badges: allBadges,
    portIn: { x: forkX, y: railAbsY },
    portOut: { x: joinX, y: railAbsY },
  };
}

function layoutGroup(ir: IR & { type: 'Group' }, x: number, railAbsY: number): Placed {
  const m = measureIR(ir);
  const topY = railAbsY - m.railY;

  const innerM = measureIR(ir.child);
  const innerX = x + T.PAD;
  const innerRailAbsY = railAbsY;
  const innerTopY = innerRailAbsY - innerM.railY;

  const placed = layoutIR(ir.child, innerX, innerTopY, innerRailAbsY);

  let label: string;
  let borderColor: string;
  let borderDark: string;
  let dashArr: string;
  if (ir.assertionType) {
    const labels: Record<string, string> = {
      lookahead: 'Followed by:',
      negativeLookahead: 'Not followed by:',
      lookbehind: 'Preceded by:',
      negativeLookbehind: 'Not preceded by:',
    };
    label = labels[ir.assertionType] || 'Assertion';
    const isNeg = ir.assertionType.startsWith('negative');
    borderColor = isNeg ? '#e53e3e' : '#4299e1';
    borderDark = isNeg ? '#fc8181' : '#63b3ed';
    dashArr = '8 4';
  } else if (ir.capturing) {
    label = ir.name ? `Group "${ir.name}"` : `Group #${ir.index}`;
    borderColor = '#c0c0c0';
    borderDark = '#718096';
    dashArr = '5 3';
  } else {
    label = 'Non-capturing';
    borderColor = '#a0a0a0';
    borderDark = '#4a5568';
    dashArr = '5 3';
  }

  const boxRect: DrawRect = {
    x,
    y: topY,
    w: m.w,
    h: m.h,
    rx: 6,
    fill: 'transparent',
    darkFill: 'transparent',
    stroke: borderColor,
    darkStroke: borderDark,
    strokeDash: dashArr,
    nodeId: ir.id,
    layer: 'container',
  };

  const labelText: DrawText = {
    x: x + m.w / 2,
    y: topY + T.TITLE_H - 4,
    text: label,
    fontSize: 12,
    fill: '#444',
    darkFill: '#a0aec0',
    anchor: 'middle',
    fontWeight: 500,
    nodeId: ir.id,
    layer: 'label',
  };

  const allPaths = [...placed.paths];

  if (placed.portIn.x > x) {
    allPaths.push(hLine(x, railAbsY, placed.portIn.x));
  }
  if (placed.portOut.x < x + m.w) {
    allPaths.push(hLine(placed.portOut.x, railAbsY, x + m.w));
  }

  return {
    rects: [boxRect, ...placed.rects],
    texts: [labelText, ...placed.texts],
    paths: allPaths,
    badges: [...placed.badges],
    portIn: { x, y: railAbsY },
    portOut: { x: x + m.w, y: railAbsY },
  };
}

function layoutQuantifier(ir: IR & { type: 'Quantifier' }, x: number, railAbsY: number): Placed {
  const m = measureIR(ir);
  const innerM = measureIR(ir.child);
  const hasBypass = ir.min === 0;
  const hasLoop = ir.max === null || ir.max > 1;

  const innerX = x + T.SIDE_PAD;
  const innerRailAbsY = railAbsY;

  const placed = layoutIR(ir.child, innerX, 0, innerRailAbsY);

  const allRects = [...placed.rects];
  const allTexts = [...placed.texts];
  const allPaths = [...placed.paths];
  const allBadges = [...placed.badges];

  const entryX = x;
  const exitX = x + m.w;
  const innerInX = placed.portIn.x;
  const innerOutX = placed.portOut.x;

  allPaths.push(hLine(entryX, railAbsY, innerInX));
  allPaths.push(hLine(innerOutX, railAbsY, exitX));

  if (hasBypass && hasLoop) {
    const rise = T.RAIL_GAP;
    const bypassY = railAbsY - rise;
    const r = T.CORNER_R;
    const d = [
      `M${entryX},${railAbsY}`,
      `Q${entryX + r},${railAbsY} ${entryX + r},${bypassY}`,
      `H${exitX - r}`,
      `Q${exitX - r},${bypassY} ${exitX},${railAbsY - (r > rise ? rise : 0)}`,
    ].join(' ');
    allPaths.push({
      d,
      stroke: '#333',
      darkStroke: '#94a3b8',
      strokeWidth: T.STROKE_W,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeDash: ir.greedy ? undefined : '6 3',
    });
  }

  if (hasLoop) {
    const innerBelowRail = innerM.h - innerM.railY;
    const drop = innerBelowRail + T.RAIL_GAP / 2;
    const loopY = railAbsY + drop;
    const r = T.CORNER_R;
    const d = [
      `M${innerOutX},${railAbsY}`,
      `Q${innerOutX + r},${railAbsY} ${innerOutX + r},${railAbsY + r}`,
      `V${loopY - r}`,
      `Q${innerOutX + r},${loopY} ${innerOutX},${loopY}`,
      `H${innerInX}`,
      `Q${innerInX - r},${loopY} ${innerInX - r},${loopY - r}`,
      `V${railAbsY + r}`,
      `Q${innerInX - r},${railAbsY} ${innerInX},${railAbsY}`,
    ].join(' ');
    allPaths.push({
      d,
      stroke: '#800000',
      darkStroke: '#f59e0b',
      strokeWidth: T.STROKE_W,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeDash: !ir.greedy ? '6 3' : undefined,
    });

    const badgeText = quantifierBadge(ir);
    if (badgeText) {
      allBadges.push({
        x: (innerInX + innerOutX) / 2,
        y: loopY + 4,
        text: badgeText,
        fill: 'transparent',
        darkFill: 'transparent',
        textColor: '#444',
        darkTextColor: '#94a3b8',
        nodeId: ir.id,
      });
    }
  } else {
    const badgeText = quantifierBadge(ir);
    if (badgeText) {
      const innerBelowRail = innerM.h - innerM.railY;
      allBadges.push({
        x: (innerInX + innerOutX) / 2,
        y: railAbsY + innerBelowRail + 4,
        text: badgeText,
        fill: 'transparent',
        darkFill: 'transparent',
        textColor: '#444',
        darkTextColor: '#94a3b8',
        nodeId: ir.id,
      });
    }
  }

  return {
    rects: allRects,
    texts: allTexts,
    paths: allPaths,
    badges: allBadges,
    portIn: { x: entryX, y: railAbsY },
    portOut: { x: exitX, y: railAbsY },
  };
}

function quantifierBadge(ir: { min: number; max: number | null; greedy: boolean }): string {
  const lazy = !ir.greedy ? ' (lazy)' : '';
  if (ir.min === 0 && ir.max === null) return `0..∞${lazy}`;
  if (ir.min === 1 && ir.max === null) return `1..∞${lazy}`;
  if (ir.min === 0 && ir.max === 1) return `0..1${lazy}`;
  if (ir.min === ir.max) return `${ir.min} times${lazy}`;
  if (ir.max === null) return `${ir.min}..∞${lazy}`;
  return `${ir.min}..${ir.max}${lazy}`;
}

export function layoutAST(ast: ASTNode): LayoutResult {
  const ir = buildIR(ast);

  const fullSeq: IR = {
    type: 'Sequence',
    children: [{ type: 'Start', id: '__start' }, ir, { type: 'End', id: '__end' }],
    id: '__root',
  };

  const m = measureIR(fullSeq);
  const padX = 30;
  const padY = 30;
  const railAbsY = padY + m.railY;

  const placed = layoutIR(fullSeq, padX, padY, railAbsY);

  const totalW = m.w + padX * 2;
  const totalH = m.h + padY * 2;

  return {
    nodes: placed.rects,
    texts: placed.texts,
    paths: placed.paths,
    badges: placed.badges,
    width: totalW,
    height: totalH,
    entryY: railAbsY,
  };
}

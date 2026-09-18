import { describe, expect, it } from 'vitest';
import { parseRegex } from './regexParser';
import { parsePcre2 } from './pcre2Parser';
import { findMatches } from './regexMatcher';
import {
  captureNodes,
  inspectMatch,
  inspectSource,
  inspectStep,
  nodeForRange,
  validRange,
} from './resultInspection';
import type { DebugStep } from './steppingMatcher';

const step: DebugStep = {
  id: 1,
  astNodeId: '',
  patternStart: 0,
  patternEnd: 1,
  stringPos: 0,
  stringEnd: 0,
  action: 'try',
  description: '',
  captureGroups: {},
  depth: 0,
};
describe('source, capture and trace inspection', () => {
  it('uses capture indices rather than equal values or duplicate names to locate groups', () => {
    const pattern = '(?<first>ab)(?<second>ab)';
    const ast = parseRegex(pattern);
    const matches = findMatches(pattern, 'g', 'abab');
    const selected = inspectMatch(matches, 0, 2, ast, pattern.length, 4, true)!;
    expect(selected.subject).toEqual({ start: 2, end: 4 });
    expect(selected.source).toEqual([{ start: 12, end: 25 }]);
    expect(selected.nodeIds).toEqual(captureNodes(ast, 2).map((n) => n.id));
  });
  it('retains the distinction between empty and nonparticipating captures', () => {
    const pattern = '(a)?()b',
      ast = parseRegex(pattern),
      matches = findMatches(pattern, 'g', 'b');
    expect(inspectMatch(matches, 0, 1, ast, pattern.length, 1, true)).toMatchObject({
      subject: null,
      source: [{ start: 0, end: 3 }],
    });
    expect(inspectMatch(matches, 0, 2, ast, pattern.length, 1, true)).toMatchObject({
      subject: { start: 0, end: 0 },
    });
  });
  it('does not clip lookbehind or reset-start captures to the full-match interval', () => {
    const pattern = '(?<=([ab]+)([bc]+))$',
      ast = parseRegex(pattern),
      matches = findMatches(pattern, 'g', 'abc');
    expect(inspectMatch(matches, 0, undefined, ast, pattern.length, 3, true)?.subject).toEqual({
      start: 3,
      end: 3,
    });
    expect(inspectMatch(matches, 0, 2, ast, pattern.length, 3, true)?.subject).toEqual({
      start: 1,
      end: 3,
    });
    const pcre = parsePcre2('(foo)\\Kbar').ast;
    const native = [
      {
        start: 3,
        end: 6,
        index: 3,
        match: 'bar',
        groups: [{ index: 1, name: null, value: 'foo', start: 0, end: 3 }],
      },
    ];
    expect(inspectMatch(native, 0, 1, pcre, 10, 6, true)?.subject).toEqual({ start: 0, end: 3 });
  });
  it('highlights every definition of a branch-reset capture without guessing the executed branch', () => {
    const pattern = '(?|(a)|(b))',
      ast = parsePcre2(pattern).ast;
    const result = inspectMatch(
      [
        {
          start: 0,
          end: 1,
          index: 0,
          match: 'b',
          groups: [{ index: 1, name: null, value: 'b', start: 0, end: 1 }],
        },
      ],
      0,
      1,
      ast,
      pattern.length,
      1,
      true,
    )!;
    expect(result.ambiguous).toBe(true);
    expect(result.source.map((range) => pattern.slice(range.start, range.end))).toEqual([
      '(a)',
      '(b)',
    ]);
  });
  it('keeps UTF-16 coordinates and ignores stale or out-of-bounds selections', () => {
    const ast = parseRegex('(😀)');
    const matches = findMatches('(😀)', 'gu', 'x😀');
    expect(inspectMatch(matches, 0, 1, ast, 4, 3, true)?.subject).toEqual({ start: 1, end: 3 });
    expect(inspectMatch(matches, 1, undefined, ast, 4, 3, true)).toBeNull();
    expect(inspectMatch(matches, 0, 9, ast, 4, 3, true)).toBeNull();
    expect(validRange({ start: 3, end: 2 }, 4)).toBe(false);
    expect(validRange({ start: -1, end: -1 }, 4)).toBe(false);
    expect(inspectStep(ast, { ...step, patternEnd: 9 }, 4, 3, true)).toBeNull();
  });
  it('maps native quantified source items to their container and preserves EOF positions', () => {
    const ast = parsePcre2('ab+').ast;
    expect(nodeForRange(ast, { start: 1, end: 3 })?.type).toBe('quantifier');
    expect(
      inspectStep(
        ast,
        { ...step, patternStart: 3, patternEnd: 3, stringPos: 2, stringEnd: 2 },
        3,
        2,
        true,
      ),
    ).toMatchObject({ source: [{ start: 3, end: 3 }], subject: { start: 2, end: 2 }, nodeIds: [] });
  });
  it('retains native source ranges when visual syntax is unavailable without inventing diagram nodes', () => {
    const pattern = '(?C1)foo',
      ast = parsePcre2(pattern).ast;
    expect(
      inspectStep(ast, { ...step, patternStart: 5, patternEnd: 6 }, 8, 3, false),
    ).toMatchObject({ source: [{ start: 5, end: 6 }], nodeIds: [] });
    expect(inspectSource(ast, { start: 5, end: 5 }, false).nodeIds).toEqual([]);
  });
});

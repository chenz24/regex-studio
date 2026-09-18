import { describe, expect, it } from 'vitest';
import type { TestCase, TestExecution } from '../types/regex';
import {
  assertionsFromResult,
  canSnapshot,
  gradeTestCase,
  executionChanged,
} from './testCaseGrader';
import { executeJavascript } from './javascriptMatcher';

const tc: TestCase = { id: 'test', label: '', input: 'a', expect: 'match' };
const actual: TestExecution = {
  matchCount: 1,
  truncated: false,
  detailsTruncated: false,
  replacedText: 'X',
  matches: [
    {
      index: 0,
      start: 0,
      end: 1,
      match: 'a',
      groups: [
        { index: 1, name: 'absent', value: undefined, start: -1, end: -1 },
        { index: 2, name: null, value: '', start: 1, end: 1 },
      ],
    },
  ],
};

describe('test case grading', () => {
  it('round trips unset and empty captures through JSON, independently of object key order', () => {
    const assertions = JSON.parse(JSON.stringify(assertionsFromResult(actual)));
    assertions.captures[0][0] = { value: null, end: -1, start: -1, name: 'absent', index: 1 };
    expect(gradeTestCase({ ...tc, assertions }, actual).status).toBe('pass');
    expect(assertions.captures[0][1].value).toBe('');
  });

  it('compares only known replacement results instead of treating newly requested data as a change', () => {
    expect(executionChanged({ ...actual, replacedText: undefined }, actual)).toBe(false);
    expect(executionChanged(actual, { ...actual, replacedText: undefined })).toBe(false);
    expect(executionChanged(actual, { ...actual, replacedText: 'Y' })).toBe(true);
    expect(executionChanged(actual, { ...actual, matchCount: 2 })).toBe(true);
  });

  it('reports differences even when both patterns still match the input', () => {
    const assertions = {
      count: 2,
      texts: ['b'],
      ranges: [[1, 2] as [number, number]],
      captures: [[]],
      replacement: 'Y',
    };
    const result = gradeTestCase({ ...tc, assertions }, actual);
    expect(result.status).toBe('fail');
    expect(result.differences?.map((diff) => diff.field)).toEqual([
      'count',
      'texts',
      'ranges',
      'captures',
      'replacement',
    ]);
    expect(result.differences?.[0]).toEqual({ field: 'count', expected: 2, actual: 1 });
    expect(canSnapshot(result)).toBe(true);
  });

  it.each([
    { pending: true },
    { timedOut: true },
    { invalid: true },
    { executionError: 'load failed' },
  ])('withholds verdicts and snapshots for %j', (state) => {
    const result = gradeTestCase(tc, actual, state);
    expect(result.status).toBe('inconclusive');
    expect(result.pass).toBe(false);
    expect(result.actual).toBeUndefined();
    expect(canSnapshot(result)).toBe(false);
  });

  it('does not interpret missing or capped results as zero matches or an exact count', () => {
    expect(gradeTestCase({ ...tc, expect: 'noMatch' }, undefined).status).toBe('inconclusive');
    expect(
      gradeTestCase({ ...tc, assertions: { count: 1 } }, { ...actual, truncated: true }).status,
    ).toBe('inconclusive');
  });

  it('allows complete count assertions with capped details but disables snapshots and detail assertions', () => {
    const limited = { ...actual, detailsTruncated: true };
    const result = gradeTestCase({ ...tc, assertions: { count: 1 } }, limited);
    expect(result.status).toBe('pass');
    expect(canSnapshot(result)).toBe(false);
    expect(gradeTestCase({ ...tc, assertions: { texts: ['a'] } }, limited).status).toBe(
      'inconclusive',
    );
  });

  it('grades replacement errors only when the case requests replacement output', () => {
    const failed = { ...actual, replacementError: 'unknown group' };
    expect(gradeTestCase(tc, failed).status).toBe('pass');
    expect(gradeTestCase({ ...tc, assertions: { replacement: 'X' } }, failed).status).toBe(
      'inconclusive',
    );
    expect(
      gradeTestCase(
        { ...tc, assertions: { replacement: '' } },
        { ...actual, replacedText: undefined },
      ).status,
    ).toBe('inconclusive');
  });

  it('uses actual native lookbehind capture order and handles empty-subject replacements', () => {
    const input = {
      pattern: '.+(?<=(.+)(.+))',
      flags: 'g',
      text: 'bba',
      replacement: 'X',
      testInputs: ['bba'],
      testReplacements: [true],
    };
    const result = executeJavascript(input).testExecutions![0];
    expect(assertionsFromResult(result)).toMatchObject({
      count: 1,
      texts: ['bba'],
      ranges: [[0, 3]],
      captures: [
        [
          { value: 'b', start: 0, end: 1 },
          { value: 'ba', start: 1, end: 3 },
        ],
      ],
      replacement: 'X',
    });
    const empty = executeJavascript({ ...input, pattern: '^', text: '', testInputs: [''] });
    expect(empty.replacedText).toBe('X');
    expect(empty.testExecutions![0].replacedText).toBe('X');
  });
});

describe('bounded JavaScript test results', () => {
  const run = (text: string) =>
    executeJavascript({
      pattern: '(a)',
      flags: 'g',
      text: '',
      replacement: 'X',
      testInputs: [text],
    }).testExecutions![0];
  it('marks incomplete details while continuing to count all matches', () => {
    const result = run('a'.repeat(101));
    expect(result.matchCount).toBe(101);
    expect(result.matches).toHaveLength(100);
    expect(result.detailsTruncated).toBe(true);
    expect(result.truncated).toBe(false);
  });
  it('distinguishes exactly the count limit from one extra match', () => {
    expect(run('a'.repeat(10_000)).truncated).toBe(false);
    expect(run('a'.repeat(10_001))).toMatchObject({ matchCount: 10_000, truncated: true });
  });
  it('bounds retained details and replacements across the complete case batch', () => {
    const input = {
      pattern: '(a+)',
      flags: 'g',
      text: '',
      replacement: 'X',
      testInputs: ['a'.repeat(80_000), 'a'.repeat(80_000), 'a'],
    };
    const results = executeJavascript(input).testExecutions!;
    expect(results.map((r) => r.matchCount)).toEqual([1, 1, 1]);
    expect(results.map((r) => r.detailsTruncated)).toEqual([false, true, false]);
    const replacements = executeJavascript({
      ...input,
      pattern: 'a',
      replacement: 'X'.repeat(1_100_000),
      testInputs: ['a', 'a'],
      testReplacements: [true, true],
    }).testExecutions!;
    expect(replacements[0].replacedText).toHaveLength(1_100_000);
    expect(replacements[1].replacedText).toBeUndefined();
    expect(replacements[1].replacementError).toContain('size limit');
  });
});

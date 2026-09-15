import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPcre2Matcher } from './pcre2Matcher';
import type { MatchInput, MatchOutcome } from './matchEngine';
import { MAX_TRACE_STEPS } from './pcre2Trace';
import { pcre2DebugResult, type TraceMessages } from './pcre2DebugResult';
let execute: (input: MatchInput) => MatchOutcome;
beforeAll(async () => {
  execute = await createPcre2Matcher(
    await readFile(new URL('../vendor/pcre2/pcre2.wasm', import.meta.url)),
  );
});
const run = (pattern: string, text: string, trace = true, flags = '') =>
  execute({ pattern, text, flags, trace, engine: 'pcre2', replacement: '', testInputs: [] });
const labels: TraceMessages = {
  before: (x) => `Before ${x}`,
  backtrack: (x) => `Backtracked ${x}`,
  start: (n) => `Start ${n}`,
  end: 'end',
  matched: (a, b) => `Matched ${a}-${b}`,
  noMatch: 'No match',
  incomplete: 'Incomplete',
};

describe('native PCRE2 callout tracing', () => {
  it('records source offsets and captures while taking the reset match start from the final ovector', () => {
    const outcome = run('(foo)\\Kbar', 'foobar');
    expect(outcome.executionError).toBeUndefined();
    expect(outcome.trace?.steps.length).toBeGreaterThan(4);
    const afterReset = outcome.trace?.steps.find((s) => s.patternStart === 7);
    expect(afterReset).toMatchObject({
      stringPos: 3,
      // In 10.47 this callout field remains the start of the attempt after \\K.
      matchStart: 0,
      captures: [{ index: 1, start: 0, end: 3 }],
    });
    const result = pcre2DebugResult(outcome, '(foo)\\Kbar', 'foobar', labels);
    expect(result).toMatchObject({ matched: true, matchStart: 3, matchEnd: 6 });
    expect(result.steps.slice(-1)[0]?.captureGroups[1]).toEqual({ value: 'foo', start: 0, end: 3 });
  });
  it.each([
    ['a++a', 'aaa', ''],
    ['(?>a+)a', 'aaa', ''],
    ['(?<pair>a(?&pair)?b)', 'aabb', ''],
    ['(a)?(?(1)b|c)', 'c', ''],
    ['(?|(a)|(b))', 'b', ''],
    ['(?<=a{1,3})b', 'aaab', ''],
    ['\\K', '😀', 'u'],
    ['(?C1)a(?C"note")', 'a', ''],
    ['(a)?b', 'b', ''],
    ['a+', 'aaa', 'U'],
  ])('preserves native results for %s', (pattern, text, flags) => {
    const traced = run(pattern, text, true, flags);
    const normal = run(pattern, text, false, flags);
    expect(traced.validation).toEqual(normal.validation);
    expect(traced.matches).toEqual(normal.matches);
    expect(traced.timedOut).toBe(false);
    expect(traced.executionError).toBeUndefined();
  });
  it('reports actual backtracking flags, with reverted captures', () => {
    const result = run('(*NO_START_OPT)(*NO_AUTO_POSSESS)(a+)ab', 'aaab');
    expect(result.matches[0].match).toBe('aaab');
    const backtracks = result.trace!.steps.filter((s) => s.flags & 2);
    expect(backtracks.length).toBeGreaterThan(0);
    expect(backtracks[0].captures).toEqual([]);
    expect(
      result.trace!.steps.some((s) => s.captures.some((c) => c.index === 1 && c.end === 2)),
    ).toBe(true);
  });
  it('does not mistake a checkpoint or a timeout for the final result', () => {
    const result = pcre2DebugResult(run('a(?=b)c', 'abc'), 'a(?=b)c', 'abc', labels);
    expect(result.matched).toBe(false);
    expect(result.steps.slice(-1)[0]?.description).toBe('No match');
    const timeout = run('(*NO_START_OPT)(a+)+$', `${'a'.repeat(30)}!`);
    expect(timeout.timedOut).toBe(true);
    expect(pcre2DebugResult(timeout, '', '', labels).steps.slice(-1)[0]?.description).toBe(
      'Incomplete',
    );
  });
  it('bounds recorded traces without aborting the actual match', () => {
    const pattern = '(a)*b';
    const text = `${'a'.repeat(2500)}b`;
    const outcome = run(pattern, text);
    expect(outcome.trace).toMatchObject({ truncated: true });
    expect(outcome.trace!.steps.length).toBeLessThanOrEqual(MAX_TRACE_STEPS);
    expect(outcome.matches).toEqual(run(pattern, text, false).matches);
    expect(outcome.matches[0].end).toBe(2501);
    expect(run('x', 'x').trace?.truncated).toBe(false);
    expect(run('x', 'x', false).trace).toBeUndefined();
  });
  it('traces only the first match even with the global flag', () => {
    expect(run('a', 'aa', true, 'g').matches).toHaveLength(1);
    expect(run('a', 'aa', false, 'g').matches).toHaveLength(2);
  });
  it('agrees with uninstrumented PCRE2 on 600 seeded cases', () => {
    let seed = 0x50435245;
    const random = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    const patterns = [
      '(a+)\\Kb',
      '(?>a|ab)b',
      'a++b',
      '(a)?(?(1)b|c)',
      '(?|(a)|(b))',
      '(?<r>a(?&r)?b)',
      '(?<=a{1,3})b',
      '(a|b)+',
      '(a*)*b',
      '(a)?\\1',
      '(?:|a)',
      '(?=a)a',
      '(?!b)[ab]',
      '[[:alpha:]]+',
      'a #x\n b',
    ];
    const chars = ['a', 'b', 'c', 'A', 'B', '1', '\n', '😀'];
    for (let i = 0; i < 600; i++) {
      const pattern = patterns[random(patterns.length)];
      const text = Array.from({ length: random(16) }, () => chars[random(chars.length)]).join('');
      const flags = ['', 'i', 's', 'u', 'x', 'U'][random(6)];
      const a = run(pattern, text, true, flags),
        b = run(pattern, text, false, flags);
      expect(a.validation, `${pattern}/${flags}`).toEqual(b.validation);
      expect(a.executionError).toBeUndefined();
      expect(a.matches, `${pattern}/${flags}: ${text}`).toEqual(b.matches);
    }
  });
});

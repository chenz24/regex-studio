import type { TestAssertions, TestCase, TestCaseResult, TestExecution } from '../types/regex';

export function assertionsFromResult(actual: TestExecution): TestAssertions {
  return {
    count: actual.matchCount,
    texts: actual.matches.map((match) => match.match),
    ranges: actual.matches.map((match) => [match.start, match.end]),
    captures: actual.matches.map((match) =>
      match.groups.map((group) => ({
        index: group.index,
        name: group.name,
        value: group.value ?? null,
        start: group.start,
        end: group.end,
      })),
    ),
    ...(actual.replacedText !== undefined && !actual.replacementError
      ? { replacement: actual.replacedText }
      : {}),
  };
}

export function canSnapshot(result?: TestCaseResult): boolean {
  return (
    !!result?.actual &&
    (result.status === 'pass' || result.status === 'fail') &&
    !result.actual.truncated &&
    !result.actual.detailsTruncated
  );
}

function equalValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((value, i) => equalValue(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>,
      right = b as Record<string, unknown>;
    return (
      Object.keys(left).length === Object.keys(right).length &&
      Object.keys(left).every(
        (key) => Object.keys(right).includes(key) && equalValue(left[key], right[key]),
      )
    );
  }
  return false;
}

/** Compare replacement output only when both executions actually requested it. */
export function executionChanged(before: TestExecution, after: TestExecution): boolean {
  const left = assertionsFromResult(before),
    right = assertionsFromResult(after);
  if (left.replacement === undefined || right.replacement === undefined) {
    delete left.replacement;
    delete right.replacement;
  }
  return !equalValue(left, right);
}

/** Grading is independent from execution: editing an expectation never runs a regex. */
export function gradeTestCase(
  test: TestCase,
  actual: TestExecution | undefined,
  state: { invalid?: boolean; pending?: boolean; timedOut?: boolean; executionError?: string } = {},
): TestCaseResult {
  const base: TestCaseResult = {
    id: test.id,
    pass: false,
    status: 'inconclusive',
    matchCount: 0,
    invalid: !!state.invalid,
    pending: !!state.pending,
    timedOut: !!state.timedOut && !state.pending,
    executionError: state.pending ? undefined : state.executionError,
  };
  if (state.invalid || state.pending || state.timedOut || state.executionError) return base;
  if (!actual) return { ...base, executionError: 'Match result unavailable' };
  const needsDetails =
    test.assertions?.texts !== undefined ||
    test.assertions?.ranges !== undefined ||
    test.assertions?.captures !== undefined;
  if (actual.truncated || (actual.detailsTruncated && needsDetails))
    return { ...base, actual, matchCount: actual.matchCount, truncated: true };
  if (
    test.assertions?.replacement !== undefined &&
    (actual.replacementError || actual.replacedText === undefined)
  )
    return {
      ...base,
      actual,
      replacementError: actual.replacementError ?? 'Replacement result unavailable',
    };

  const differences: NonNullable<TestCaseResult['differences']> = [];
  const expectation = actual.matchCount > 0 ? 'match' : 'noMatch';
  if (test.expect !== expectation)
    differences.push({ field: 'expect', expected: test.expect, actual: expectation });
  const values = assertionsFromResult(actual);
  for (const field of ['count', 'texts', 'ranges', 'captures', 'replacement'] as const) {
    const expected = test.assertions?.[field];
    if (expected !== undefined && !equalValue(expected, values[field]))
      differences.push({ field, expected, actual: values[field] });
  }
  const pass = differences.length === 0;
  return {
    ...base,
    actual,
    matchCount: actual.matchCount,
    differences,
    pass,
    status: pass ? 'pass' : 'fail',
  };
}

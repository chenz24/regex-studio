import { findMatches, isValidRegex } from '../utils/regexMatcher';
import type { Challenge } from './types';
import type { TestCaseResult } from '@/types/regex';
import { gradeTestCase } from '@/utils/testCaseGrader';

export interface ChallengeCaseResult {
  index: number;
  label: string;
  input: string;
  expect: 'match' | 'noMatch';
  pass: boolean;
  matchCount: number;
}

export interface ChallengeEvaluation {
  /** All cases pass and pattern is non-empty + valid. */
  solved: boolean;
  /** Pattern is syntactically invalid for the current flags. */
  invalid: boolean;
  invalidError?: string;
  results: ChallengeCaseResult[];
  passed: number;
  total: number;
}

/**
 * Evaluate a challenge against the user's current pattern + flags.
 *
 * Checks presence and the case's exact assertions. Extraction challenges
 * require complete ordered results; validators require the entire input.
 * The interactive runner uses worker results via evaluateChallengeFromResults.
 */
export function evaluateChallenge(
  challenge: Challenge,
  pattern: string,
  flags: string,
): ChallengeEvaluation {
  const total = challenge.testCases.length;

  if (!pattern) {
    return {
      solved: false,
      invalid: false,
      results: challenge.testCases.map((tc, i) => ({
        index: i,
        label: tc.label,
        input: tc.input,
        expect: tc.expect,
        pass: false,
        matchCount: 0,
      })),
      passed: 0,
      total,
    };
  }

  const validation = isValidRegex(pattern, flags);
  if (!validation.valid) {
    return {
      solved: false,
      invalid: true,
      invalidError: validation.error,
      results: challenge.testCases.map((tc, i) => ({
        index: i,
        label: tc.label,
        input: tc.input,
        expect: tc.expect,
        pass: false,
        matchCount: 0,
      })),
      passed: 0,
      total,
    };
  }

  const results = challenge.testCases.map((tc, i) => {
    const matches = findMatches(pattern, flags, tc.input);
    const { pass } = gradeTestCase(
      { ...tc, id: challengeCaseId(challenge.id, i) },
      {
        matches,
        matchCount: matches.length,
        truncated: false,
        detailsTruncated: false,
      },
    );
    return {
      index: i,
      label: tc.label,
      input: tc.input,
      expect: tc.expect,
      pass,
      matchCount: matches.length,
    };
  });

  const passed = results.filter((r) => r.pass).length;
  return {
    solved: passed === total && total > 0,
    invalid: false,
    results,
    passed,
    total,
  };
}

/**
 * Grade existing worker executions without running user regexes on the UI
 * thread. Counts alone can only grade legacy presence-only cases. Missing or
 * incomplete executions never satisfy an exact assertion.
 */
export function evaluateChallengeFromResults(
  challenge: Challenge,
  pattern: string,
  validation: { valid: boolean; error?: string },
  resultsByCaseId: ReadonlyMap<string, number | TestCaseResult>,
): ChallengeEvaluation {
  const total = challenge.testCases.length;
  const invalid = Boolean(pattern) && !validation.valid;

  const results = challenge.testCases.map((tc, i) => {
    const id = challengeCaseId(challenge.id, i);
    const result = resultsByCaseId.get(id);
    const count = typeof result === 'number' ? result : result?.matchCount;
    const matchCount = count ?? 0;
    const hasMatch = !invalid && Boolean(pattern) && matchCount > 0;
    return {
      index: i,
      label: tc.label,
      input: tc.input,
      expect: tc.expect,
      pass:
        count !== undefined &&
        !invalid &&
        Boolean(pattern) &&
        (typeof result === 'object'
          ? gradeTestCase({ ...tc, id }, result.actual, result).pass
          : !tc.assertions && (tc.expect === 'match' ? hasMatch : !hasMatch)),
      matchCount,
    };
  });

  const passed = results.filter((r) => r.pass).length;
  return {
    solved: passed === total && total > 0,
    invalid,
    invalidError: invalid ? validation.error : undefined,
    results,
    passed,
    total,
  };
}

/** Id given to a challenge's test case inside the regex store. */
export function challengeCaseId(challengeId: string, index: number): string {
  return `${challengeId}__${index}`;
}

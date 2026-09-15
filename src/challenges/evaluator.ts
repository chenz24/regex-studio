import { findMatches, isValidRegex } from '../utils/regexMatcher';
import type { Challenge } from './types';

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
 * For each test case: a `match` expectation means findMatches must return at
 * least one hit; `noMatch` means it must return zero. The user is responsible
 * for anchoring with `^...$` when the challenge requires whole-string
 * validation — this is documented in the challenge description.
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
    const has = matches.length > 0;
    const pass = tc.expect === 'match' ? has : !has;
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
 * Same verdict as `evaluateChallenge`, but from match counts that have
 * already been computed — the challenge's cases are pushed into the regex
 * store when it starts, so the worker has evaluated them and there is no
 * reason to run the user's pattern a second time on the main thread.
 */
export function evaluateChallengeFromResults(
  challenge: Challenge,
  pattern: string,
  validation: { valid: boolean; error?: string },
  matchCountByCaseId: ReadonlyMap<string, number>,
): ChallengeEvaluation {
  const total = challenge.testCases.length;
  const invalid = Boolean(pattern) && !validation.valid;

  const results = challenge.testCases.map((tc, i) => {
    const matchCount = matchCountByCaseId.get(challengeCaseId(challenge.id, i)) ?? 0;
    const hasMatch = !invalid && Boolean(pattern) && matchCount > 0;
    return {
      index: i,
      label: tc.label,
      input: tc.input,
      expect: tc.expect,
      pass: !invalid && Boolean(pattern) && (tc.expect === 'match' ? hasMatch : !hasMatch),
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

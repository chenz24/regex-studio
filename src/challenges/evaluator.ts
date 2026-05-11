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

import { describe, expect, it } from 'vitest';
import { challengeCaseId, evaluateChallenge, evaluateChallengeFromResults } from './evaluator';
import type { Challenge } from './types';

const challenge: Challenge = {
  id: 'demo',
  title: 'Demo',
  summary: 'Match a digit',
  description: 'Write a pattern that matches a digit.',
  difficulty: 'beginner',
  testCases: [
    { label: 'has a digit', input: 'a1', expect: 'match' },
    { label: 'no digit', input: 'abc', expect: 'noMatch' },
  ],
};

/** Match counts as the worker reports them for the store's test cases. */
function counts(...values: number[]): Map<string, number> {
  return new Map(values.map((n, i) => [challengeCaseId(challenge.id, i), n]));
}

describe('evaluateChallengeFromResults', () => {
  it('agrees with a direct evaluation of the same pattern', () => {
    for (const pattern of ['\\d', '\\w', 'z', '']) {
      const direct = evaluateChallenge(challenge, pattern, '');
      const fromResults = evaluateChallengeFromResults(
        challenge,
        pattern,
        { valid: true },
        counts(...direct.results.map((r) => r.matchCount)),
      );
      expect(fromResults).toEqual(direct);
    }
  });

  it('solves when every case is satisfied', () => {
    const ev = evaluateChallengeFromResults(challenge, '\\d', { valid: true }, counts(1, 0));
    expect(ev).toMatchObject({ solved: true, passed: 2, total: 2, invalid: false });
  });

  it('fails a case that matches when it should not', () => {
    const ev = evaluateChallengeFromResults(challenge, '\\w', { valid: true }, counts(2, 3));
    expect(ev.solved).toBe(false);
    expect(ev.results.map((r) => r.pass)).toEqual([true, false]);
  });

  it('reports an invalid pattern without claiming the cases failed on merit', () => {
    const ev = evaluateChallengeFromResults(
      challenge,
      '(',
      { valid: false, error: 'boom' },
      counts(0, 0),
    );
    expect(ev).toMatchObject({ invalid: true, invalidError: 'boom', solved: false, passed: 0 });
  });

  it('is unsolved while the pattern is empty', () => {
    const ev = evaluateChallengeFromResults(challenge, '', { valid: true }, counts(0, 0));
    expect(ev).toMatchObject({ solved: false, invalid: false, passed: 0 });
  });

  it('does not pass missing results, including negative cases', () => {
    const ev = evaluateChallengeFromResults(challenge, '\\d', { valid: true }, new Map());
    expect(ev.results.map((r) => r.matchCount)).toEqual([0, 0]);
    expect(ev.results.map((r) => r.pass)).toEqual([false, false]);
    expect(evaluateChallengeFromResults(challenge, '\\d', { valid: true }, counts(1)).solved).toBe(
      false,
    );
  });
});

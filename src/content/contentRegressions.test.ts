import { describe, expect, it } from 'vitest';
import { getChallenges } from '@/challenges/data';
import {
  challengeCaseId,
  evaluateChallenge,
  evaluateChallengeFromResults,
} from '@/challenges/evaluator';
import { getTracks } from '@/tutorial/registry';
import { findMatches } from '@/utils/regexMatcher';
import { parseRegex } from '@/utils/regexParser';
import { runMatchInline } from '@/utils/matchEngine';
import { gradeTestCase } from '@/utils/testCaseGrader';
import { challengeLessons, relatedChallengeIds } from './relatedLearning';
import { getPublicPage } from './publicCatalog';

for (const locale of ['en', 'zh', 'ja'] as const) {
  describe(`${locale} published content regressions`, () => {
    const challenges = getChallenges(locale);
    const lessons = getTracks(locale).flatMap((track) => track.lessons);
    for (const challenge of challenges) {
      it(`${challenge.id}: reference solution passes exact worker assertions`, () => {
        const { pattern, flags = challenge.starterFlags ?? '' } = challenge.idealSolution!;
        const outcome = runMatchInline({
          pattern,
          flags,
          text: '',
          replacement: '',
          testInputs: challenge.testCases.map((tc) => tc.input),
        });
        const results = new Map(
          challenge.testCases.map((tc, i) => {
            const id = challengeCaseId(challenge.id, i);
            return [id, gradeTestCase({ ...tc, id }, outcome.testExecutions?.[i])];
          }),
        );
        expect(
          evaluateChallengeFromResults(challenge, pattern, { valid: true }, results).solved,
        ).toBe(true);
        expect(evaluateChallenge(challenge, pattern, flags).solved).toBe(true);
        expect(challenge.testCases.every((tc) => tc.assertions?.texts !== undefined)).toBe(true);
      });
    }

    for (const id of ['practical-csv', 'practical-url']) {
      it(`${id}: every reference solution satisfies the interactive step`, () => {
        const lesson = lessons.find((item) => item.id === id)!;
        let state = lesson.initialState;
        for (const step of lesson.steps) {
          state = { ...state, ...step.setup };
          if (!step.solution) continue;
          const pattern = step.solution.pattern;
          const flags = step.solution.flags ?? state.flags ?? '';
          const ctx = {
            locale,
            pattern,
            flagString: flags,
            jsFlagString: flags,
            engine: 'javascript' as const,
            testText: state.testText,
            validation: { valid: true },
            matches: findMatches(pattern, flags, state.testText),
            ast: parseRegex(pattern, flags),
            testCases: [],
            testCaseResults: [],
            hasFlag: (flag: string) => flags.includes(flag),
          };
          expect(step.validate(ctx).pass, `${id}/${step.id}`).toBe(true);
          if (id === 'practical-url' && step.id === 's3') {
            expect(
              step.validate({
                ...ctx,
                matches: ctx.matches.map((match) => ({ ...match, groups: [] })),
              }).pass,
            ).toBe(false);
          }
        }
      });
    }

    it('uses valid, reciprocal topic links and distinct localized search metadata', () => {
      for (const challenge of challenges) {
        expect(challengeLessons[challenge.id].length).toBeGreaterThan(0);
        for (const id of challengeLessons[challenge.id]) {
          expect(
            lessons.some((lesson) => lesson.id === id),
            id,
          ).toBe(true);
          expect(relatedChallengeIds(id)).toContain(challenge.id);
        }
      }
      const pages = [
        ...lessons.map((item) => `/learn/${item.id}`),
        ...challenges.map((item) => `/challenges/${item.id}`),
      ].map((path) => getPublicPage(path, locale)!);
      expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
      expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);
      expect(pages.every((page) => /Regex|正则表达式|正規表現/.test(page.title))).toBe(true);
    });
  });
}

it('rejects truncated email matches, omitted global flags, and count-only results', () => {
  const challenge = getChallenges('en').find((item) => item.id === 'email-find')!;
  expect(evaluateChallenge(challenge, '\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b', 'g').solved).toBe(
    false,
  );
  expect(evaluateChallenge(challenge, challenge.idealSolution!.pattern, '').solved).toBe(false);
  const counts = new Map(
    challenge.testCases.map((tc, i) => [challengeCaseId(challenge.id, i), tc.assertions!.count!]),
  );
  expect(
    evaluateChallengeFromResults(
      challenge,
      challenge.idealSolution!.pattern,
      { valid: true },
      counts,
    ).solved,
  ).toBe(false);
});

it('does not award exact matches when worker details are truncated or pending', () => {
  const challenge = getChallenges('en')[0];
  const pattern = challenge.idealSolution!.pattern;
  const outcome = runMatchInline({
    pattern,
    flags: 'g',
    text: '',
    replacement: '',
    testInputs: challenge.testCases.map((tc) => tc.input),
  });
  for (const state of ['truncated', 'detailsTruncated', 'pending'] as const) {
    const results = new Map(
      challenge.testCases.map((tc, i) => {
        const id = challengeCaseId(challenge.id, i);
        const actual = {
          ...outcome.testExecutions![i],
          ...(state !== 'pending' ? { [state]: true } : {}),
        };
        return [id, gradeTestCase({ ...tc, id }, actual, { pending: state === 'pending' })];
      }),
    );
    expect(evaluateChallengeFromResults(challenge, pattern, { valid: true }, results).solved).toBe(
      false,
    );
  }
});

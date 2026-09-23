import { describe, expect, it } from 'vitest';
import { getTracks } from '@/tutorial/registry';

const editedLessons = [
  'quantifiers-greedy',
  'quantifiers-lazy',
  'groups-capturing',
  'practical-email',
];

for (const locale of ['en', 'zh', 'ja'] as const) {
  const lessons = getTracks(locale)
    .flatMap((track) => track.lessons)
    .filter((lesson) => editedLessons.includes(lesson.id));
  describe(`${locale} standalone lesson examples`, () => {
    it('includes a complete reading explanation for each step of the four edited lessons', () => {
      expect(lessons).toHaveLength(4);
      for (const lesson of lessons) {
        expect(lesson.reading?.introduction).toBeTruthy();
        for (const step of lesson.steps) {
          expect(step.reading?.body, `${lesson.id}/${step.id}`).toBeTruthy();
          expect(step.reading?.examples?.length, `${lesson.id}/${step.id}`).toBeGreaterThan(0);
        }
      }
    });
    for (const lesson of lessons) {
      for (const step of lesson.steps) {
        for (const [index, example] of (step.reading?.examples ?? []).entries()) {
          it(`${lesson.id}/${step.id}/${index}: matches the documented strings, captures and replacement`, () => {
            const regex = new RegExp(example.pattern, example.flags);
            const actual = Array.from(example.testText.matchAll(regex));
            expect(actual.map((match) => match[0])).toEqual(
              example.matches.map((match) => match.text),
            );
            example.matches.forEach((match, i) => {
              if (match.groups) expect(actual[i].slice(1)).toEqual(match.groups);
            });
            if (example.replacement) {
              expect(
                example.testText.replace(
                  new RegExp(example.pattern, example.flags),
                  example.replacement.template,
                ),
              ).toBe(example.replacement.result);
            }
          });
        }
      }
    }
  });
}

import { describe, expect, it } from 'vitest';
import { getTracks } from '@/tutorial/registry';
import { getChallenges } from '@/challenges/data';
import { getPublicPage, getPublicPaths } from './publicCatalog';

describe('shared public content', () => {
  it('keeps stable identities and exercise state across languages without mutating earlier results', () => {
    const english = getTracks('en').flatMap((track) => track.lessons);
    for (const locale of ['zh', 'ja'] as const) {
      const translated = getTracks(locale).flatMap((track) => track.lessons);
      expect(english).toHaveLength(21);
      expect(translated.map((lesson) => lesson.id)).toEqual(english.map((lesson) => lesson.id));
      for (let i = 0; i < english.length; i++) {
        expect(translated[i].initialState).toEqual(english[i].initialState);
        expect(translated[i].steps.map((step) => step.id)).toEqual(
          english[i].steps.map((step) => step.id),
        );
        expect(english[i].title).toBe(getTracks('en').flatMap((track) => track.lessons)[i].title);
        expect(translated[i].summary).not.toBe(english[i].summary);
      }
      const enChallenges = getChallenges('en');
      const translatedChallenges = getChallenges(locale);
      expect(enChallenges).toHaveLength(11);
      expect(translatedChallenges.map((item) => item.id)).toEqual(
        enChallenges.map((item) => item.id),
      );
      for (let i = 0; i < enChallenges.length; i++) {
        expect(
          translatedChallenges[i].testCases.map(({ input, expect }) => ({ input, expect })),
        ).toEqual(enChallenges[i].testCases.map(({ input, expect }) => ({ input, expect })));
        expect(translatedChallenges[i].summary).not.toBe(enChallenges[i].summary);
        expect(enChallenges[i].summary).toBe(getChallenges('en')[i].summary);
      }
    }
  });

  it('publishes each lesson and challenge exactly once with metadata from the same definitions', () => {
    const paths = getPublicPaths();
    expect(paths).toHaveLength(35);
    expect(new Set(paths).size).toBe(paths.length);
    for (const locale of ['en', 'zh', 'ja'] as const) {
      for (const path of paths.slice(3)) {
        const page = getPublicPage(path, locale);
        expect(page?.title.length).toBeGreaterThan(0);
        expect(page?.description.length).toBeGreaterThan(0);
        expect(page?.kind).toBe(path.startsWith('/learn/') ? 'lesson' : 'challenge');
      }
    }
    expect(getPublicPage('/learn/missing', 'en')).toBeUndefined();
    expect(getPublicPage('/challenges/missing', 'zh')).toBeUndefined();
  });
});

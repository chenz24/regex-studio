import { getTracks } from '@/tutorial/registry';
import { getChallenges } from '@/challenges/data';
import type { Locale } from '@/paraglide/runtime';

export interface PublicPageMeta {
  title: string;
  description: string;
  kind: 'lesson' | 'challenge';
}

export const plainTitle = (text: string) => text.replace(/`|\*\*/g, '');

export function getPublicPage(path: string, locale: Locale): PublicPageMeta | undefined {
  const lesson = getTracks(locale)
    .flatMap((track) => track.lessons)
    .find((item) => path === `/learn/${item.id}`);
  if (lesson)
    return {
      title: plainTitle(lesson.title),
      description: plainTitle(lesson.summary),
      kind: 'lesson',
    };
  const challenge = getChallenges(locale).find((item) => path === `/challenges/${item.id}`);
  if (challenge)
    return {
      title: plainTitle(challenge.title),
      description: plainTitle(challenge.summary),
      kind: 'challenge',
    };
}

export function getPublicPaths(): string[] {
  return [
    '/',
    '/learn',
    '/challenges',
    ...getTracks('en').flatMap((track) => track.lessons.map((lesson) => `/learn/${lesson.id}`)),
    ...getChallenges('en').map((challenge) => `/challenges/${challenge.id}`),
  ];
}

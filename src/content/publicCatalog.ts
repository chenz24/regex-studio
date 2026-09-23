import { getTracks } from '@/tutorial/registry';
import { getChallenges } from '@/challenges/data';
import type { Locale } from '@/paraglide/runtime';

export interface PublicPageMeta {
  title: string;
  description: string;
  kind: 'lesson' | 'challenge';
}

export const plainTitle = (text: string) => text.replace(/`|\*\*/g, '');

const englishLessonSearchTitles: Record<string, string> = {
  'basics-literals': 'Literal matching and word boundaries',
  'basics-classes': 'Character classes and ranges',
  'basics-dot-and-escapes': 'Dot, escaping and dotAll',
  'basics-anchors': 'Anchors: ^, $ and multiline',
  'quantifiers-backtracking': 'Backtracking and nested quantifiers',
  'groups-capturing': 'Capturing groups and replacement',
  'groups-backreferences': 'Backreferences and repeated text',
  'groups-named-and-noncapturing': 'Named and non-capturing groups',
};

function searchMetadata(
  kind: PublicPageMeta['kind'],
  title: string,
  summary: string,
  locale: Locale,
): PublicPageMeta {
  const labels = {
    en: {
      lesson: 'Regex tutorial',
      challenge: 'Regex challenge',
      lessonDescription: 'Includes worked examples and expected results.',
      challengeDescription:
        'Practice with test cases, expected results, and an explained solution.',
    },
    zh: {
      lesson: '正则表达式教程',
      challenge: '正则表达式练习',
      lessonDescription: '包含完整示例、匹配结果与交互练习。',
      challengeDescription: '通过测试用例、预期结果和参考解答练习正则表达式。',
    },
    ja: {
      lesson: '正規表現チュートリアル',
      challenge: '正規表現の練習',
      lessonDescription: '入力例とマッチ結果を確認し、実際に試せます。',
      challengeDescription: 'テストケース、期待する結果、解説付きの解答で学べます。',
    },
  }[locale];
  return {
    title: `${plainTitle(title)} | ${labels[kind]}`,
    description: `${plainTitle(summary)} ${kind === 'lesson' ? labels.lessonDescription : labels.challengeDescription}`,
    kind,
  };
}

export function getPublicPage(path: string, locale: Locale): PublicPageMeta | undefined {
  const lesson = getTracks(locale)
    .flatMap((track) => track.lessons)
    .find((item) => path === `/learn/${item.id}`);
  if (lesson)
    return searchMetadata(
      'lesson',
      locale === 'en' ? (englishLessonSearchTitles[lesson.id] ?? lesson.title) : lesson.title,
      lesson.summary,
      locale,
    );
  const challenge = getChallenges(locale).find((item) => path === `/challenges/${item.id}`);
  if (challenge) return searchMetadata('challenge', challenge.title, challenge.summary, locale);
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

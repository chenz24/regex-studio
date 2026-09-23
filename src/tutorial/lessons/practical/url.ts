import type { Locale } from '@/paraglide/runtime';
import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';
import { addStandaloneReading } from '../../readingGuides';

export const URL_PATTERN =
  'https?://[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+(?:/(?:[^\\s),;]*[\\w/#])?)?';
export const URL_GROUPS =
  '(https?)://([A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+)((?:/(?:[^\\s),;]*[\\w/#])?)?)';
export const EXPECTED_URLS = [
  'https://example.com/api?token=abc',
  'http://legacy.example.org',
  'https://blog.example.io/posts/2024-05-09',
];
const TEXT = [
  'Docs: https://example.com/api?token=abc.',
  'Old site (http://legacy.example.org)',
  'Visit https://blog.example.io/posts/2024-05-09 today!',
  'No protocol here: example.com is not enough.',
].join('\n');
const TEXTS = {
  en: {
    title: 'Extract URLs from text',
    summary:
      'Keep domain dots, exclude surrounding punctuation, and extract protocol, host and path in a limited URL format.',
    titles: [
      'A broad match includes punctuation',
      'Separate the host from the path',
      'Capture the three fields',
      'Know the extraction limits',
    ],
  },
  zh: {
    title: '从段落里抓 URL',
    summary: '保留域名点号、排除外层标点，并在限定 URL 格式中提取协议、主机与路径。',
    titles: ['宽泛匹配会带入标点', '将主机与路径分开', '捕获三个字段', '明确提取范围'],
  },
  ja: {
    title: 'テキストから URL を抽出する',
    summary:
      'ドメインのドットを保ち、周囲の記号を除き、限定した URL 形式からスキーム・ホスト・パスを取得します。',
    titles: [
      '広い一致は記号も含む',
      'ホストとパスを分ける',
      '3つの項目をキャプチャする',
      '抽出の範囲を知る',
    ],
  },
};
export function createUrlLesson(locale?: Locale): Lesson {
  const t = pickLocale(TEXTS, locale);
  const patterns = ['https?://\\S+', URL_PATTERN, URL_GROUPS];
  const validators = [
    v.matchedValuesAre([
      'https://example.com/api?token=abc.',
      'http://legacy.example.org)',
      EXPECTED_URLS[2],
    ]),
    v.matchedValuesAre(EXPECTED_URLS),
    v.matchedResultsAre([
      { text: EXPECTED_URLS[0], groups: ['https', 'example.com', '/api?token=abc'] },
      { text: EXPECTED_URLS[1], groups: ['http', 'legacy.example.org', ''] },
      { text: EXPECTED_URLS[2], groups: ['https', 'blog.example.io', '/posts/2024-05-09'] },
    ]),
  ];
  const lesson = addStandaloneReading(
    {
      id: 'practical-url',
      trackId: 'practical',
      title: t.title,
      summary: t.summary,
      difficulty: 'intermediate',
      estimatedMinutes: 7,
      initialState: { engine: 'javascript', pattern: '', flags: 'g', testText: TEXT },
      steps: t.titles.map((title, i) => ({
        id: `s${i + 1}`,
        title,
        body: '',
        validate: patterns[i] ? v.all(v.patternEquals(patterns[i]), validators[i]) : v.always(),
        ...(patterns[i] ? { solution: { pattern: patterns[i] } } : {}),
      })),
      nextLessonId: 'practical-log',
    },
    locale,
  );
  return {
    ...lesson,
    steps: lesson.steps.map((step) => ({
      ...step,
      body: step.reading!.body + (step.solution ? `\n\n\`${step.solution.pattern}\`` : ''),
    })),
  };
}
export const urlLesson = createUrlLesson();

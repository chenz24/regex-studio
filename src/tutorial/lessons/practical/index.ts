import type { Locale } from '@/paraglide/runtime';
import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { createEmailLesson } from './email';
import { createUrlLesson } from './url';
import { createLogLesson } from './log';
import { createMarkdownLinkLesson } from './markdown-link';
import { createCsvLesson } from './csv';

export function createPracticalTrack(locale?: Locale): Track {
  const t = pickLocale(
    {
      en: {
        title: 'Practical',
        description:
          'Apply everything you learned to real-world scenarios: email, URL, logs, Markdown links, CSV.',
      },
      zh: {
        title: 'Practical · 实战',
        description: '用前面学的所有工具解决真实场景：邮箱、URL、日志、Markdown 链接、CSV。',
      },
    },
    locale,
  );

  return {
    id: 'practical',
    title: t.title,
    description: t.description,
    order: 5,
    lessons: [
      createEmailLesson(locale),
      createUrlLesson(locale),
      createLogLesson(locale),
      createMarkdownLinkLesson(locale),
      createCsvLesson(locale),
    ],
  };
}

export const practicalTrack = createPracticalTrack();

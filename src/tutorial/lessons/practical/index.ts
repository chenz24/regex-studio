import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { emailLesson } from './email';
import { urlLesson } from './url';
import { logLesson } from './log';
import { markdownLinkLesson } from './markdown-link';
import { csvLesson } from './csv';

const t = pickLocale({
  en: {
    title: 'Practical',
    description: 'Apply everything you learned to real-world scenarios: email, URL, logs, Markdown links, CSV.',
  },
  zh: {
    title: 'Practical · 实战',
    description: '用前面学的所有工具解决真实场景：邮箱、URL、日志、Markdown 链接、CSV。',
  },
});

export const practicalTrack: Track = {
  id: 'practical',
  title: t.title,
  description: t.description,
  order: 5,
  lessons: [emailLesson, urlLesson, logLesson, markdownLinkLesson, csvLesson],
};

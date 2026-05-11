import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { lookaheadLesson } from './lookahead';
import { negativeLookaheadLesson } from './negative-lookahead';
import { lookbehindLesson } from './lookbehind';

const t = pickLocale({
  en: {
    title: 'Lookaround',
    description: 'Zero-width "peek before/after" — `(?=)` `(?!)` `(?<=)` `(?<!)`.',
  },
  zh: {
    title: 'Lookaround · 环视断言',
    description: '零宽的"看一眼前后"——`(?=)` `(?!)` `(?<=)` `(?<!)`。',
  },
});

export const lookaroundTrack: Track = {
  id: 'lookaround',
  title: t.title,
  description: t.description,
  order: 4,
  lessons: [lookaheadLesson, negativeLookaheadLesson, lookbehindLesson],
};

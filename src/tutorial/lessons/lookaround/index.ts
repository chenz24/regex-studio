import type { Locale } from '@/paraglide/runtime';
import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { createLookaheadLesson } from './lookahead';
import { createNegativeLookaheadLesson } from './negative-lookahead';
import { createLookbehindLesson } from './lookbehind';

export function createLookaroundTrack(locale?: Locale): Track {
  const t = pickLocale(
    {
      en: {
        title: 'Lookaround',
        description: 'Zero-width "peek before/after" — `(?=)` `(?!)` `(?<=)` `(?<!)`.',
      },
      zh: {
        title: 'Lookaround · 环视断言',
        description: '零宽的"看一眼前后"——`(?=)` `(?!)` `(?<=)` `(?<!)`。',
      },
    },
    locale,
  );

  return {
    id: 'lookaround',
    title: t.title,
    description: t.description,
    order: 4,
    lessons: [
      createLookaheadLesson(locale),
      createNegativeLookaheadLesson(locale),
      createLookbehindLesson(locale),
    ],
  };
}

export const lookaroundTrack = createLookaroundTrack();

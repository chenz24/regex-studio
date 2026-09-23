import type { Locale } from '@/paraglide/runtime';
import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { createGreedyLesson } from './greedy';
import { createLazyLesson } from './lazy';
import { createCountedLesson } from './counted';
import { createBacktrackingLesson } from './backtracking';

export function createQuantifiersTrack(locale?: Locale): Track {
  const t = pickLocale(
    {
      en: {
        title: 'Quantifiers',
        description: 'Deep dive into greedy, lazy, exact counts, and backtracking traps.',
      },
      zh: {
        title: 'Quantifiers · 量词',
        description: '深入贪婪、懒惰、精确次数与回溯陷阱。',
      },
      ja: {
        title: '量指定子',
        description:
          '貪欲一致・最短一致・回数指定と、バックトラッキングの落とし穴を詳しく学びます。',
      },
    },
    locale,
  );

  return {
    id: 'quantifiers',
    title: t.title,
    description: t.description,
    order: 2,
    lessons: [
      createGreedyLesson(locale),
      createLazyLesson(locale),
      createCountedLesson(locale),
      createBacktrackingLesson(locale),
    ],
  };
}

export const quantifiersTrack = createQuantifiersTrack();

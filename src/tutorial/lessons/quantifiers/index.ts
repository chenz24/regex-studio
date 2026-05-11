import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { greedyLesson } from './greedy';
import { lazyLesson } from './lazy';
import { countedLesson } from './counted';
import { backtrackingLesson } from './backtracking';

const t = pickLocale({
  en: {
    title: 'Quantifiers',
    description: 'Deep dive into greedy, lazy, exact counts, and backtracking traps.',
  },
  zh: {
    title: 'Quantifiers · 量词',
    description: '深入贪婪、懒惰、精确次数与回溯陷阱。',
  },
});

export const quantifiersTrack: Track = {
  id: 'quantifiers',
  title: t.title,
  description: t.description,
  order: 2,
  lessons: [greedyLesson, lazyLesson, countedLesson, backtrackingLesson],
};

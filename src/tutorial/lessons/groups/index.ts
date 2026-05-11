import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { capturingGroupsLesson } from './capturing';
import { alternationLesson } from './alternation';
import { backreferencesLesson } from './backreferences';
import { namedAndNonCapturingLesson } from './named-and-noncapturing';

const t = pickLocale({
  en: {
    title: 'Groups',
    description: 'Capturing groups, named groups, backreferences, non-capturing groups, and `|`.',
  },
  zh: {
    title: 'Groups · 分组',
    description: '捕获组、命名组、反向引用、非捕获组与 `|`。',
  },
});

export const groupsTrack: Track = {
  id: 'groups',
  title: t.title,
  description: t.description,
  order: 3,
  lessons: [
    capturingGroupsLesson,
    alternationLesson,
    backreferencesLesson,
    namedAndNonCapturingLesson,
  ],
};

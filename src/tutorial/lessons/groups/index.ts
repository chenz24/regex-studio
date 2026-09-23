import type { Locale } from '@/paraglide/runtime';
import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { createCapturingGroupsLesson } from './capturing';
import { createAlternationLesson } from './alternation';
import { createBackreferencesLesson } from './backreferences';
import { createNamedAndNonCapturingLesson } from './named-and-noncapturing';

export function createGroupsTrack(locale?: Locale): Track {
  const t = pickLocale(
    {
      en: {
        title: 'Groups',
        description:
          'Capturing groups, named groups, backreferences, non-capturing groups, and `|`.',
      },
      zh: {
        title: 'Groups · 分组',
        description: '捕获组、命名组、反向引用、非捕获组与 `|`。',
      },
      ja: {
        title: 'グループ',
        description:
          'キャプチャ・名前付きグループ・後方参照・非キャプチャグループと `|` を学びます。',
      },
    },
    locale,
  );

  return {
    id: 'groups',
    title: t.title,
    description: t.description,
    order: 3,
    lessons: [
      createCapturingGroupsLesson(locale),
      createAlternationLesson(locale),
      createBackreferencesLesson(locale),
      createNamedAndNonCapturingLesson(locale),
    ],
  };
}

export const groupsTrack = createGroupsTrack();

import type { Locale } from '@/paraglide/runtime';
import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { createLiteralsLesson } from './literals';
import { createClassesLesson } from './classes';
import { createDotAndEscapesLesson } from './dot-and-escapes';
import { createAnchorsLesson } from './anchors';
import { createQuantifiersIntroLesson } from './quantifiers';

export function createBasicsTrack(locale?: Locale): Track {
  const t = pickLocale(
    {
      en: {
        title: 'Basics',
        description:
          'Start from literals and gradually learn character classes, quantifiers, and anchors.',
      },
      zh: {
        title: 'Basics · 基础',
        description: '从最简单的字面量开始，逐步认识字符类、量词和锚点。',
      },
      ja: {
        title: '基礎',
        description: '通常の文字から始めて、文字クラス・量指定子・アンカーを順に学びます。',
      },
    },
    locale,
  );

  return {
    id: 'basics',
    title: t.title,
    description: t.description,
    order: 1,
    lessons: [
      createLiteralsLesson(locale),
      createClassesLesson(locale),
      createDotAndEscapesLesson(locale),
      createAnchorsLesson(locale),
      createQuantifiersIntroLesson(locale),
    ],
  };
}

export const basicsTrack = createBasicsTrack();

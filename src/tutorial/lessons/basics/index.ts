import type { Track } from '../../types';
import { pickLocale } from '../../i18n';
import { literalsLesson } from './literals';
import { classesLesson } from './classes';
import { dotAndEscapesLesson } from './dot-and-escapes';
import { anchorsLesson } from './anchors';
import { quantifiersIntroLesson } from './quantifiers';

const t = pickLocale({
  en: {
    title: 'Basics',
    description: 'Start from literals and gradually learn character classes, quantifiers, and anchors.',
  },
  zh: {
    title: 'Basics · 基础',
    description: '从最简单的字面量开始，逐步认识字符类、量词和锚点。',
  },
});

export const basicsTrack: Track = {
  id: 'basics',
  title: t.title,
  description: t.description,
  order: 1,
  lessons: [
    literalsLesson,
    classesLesson,
    dotAndEscapesLesson,
    anchorsLesson,
    quantifiersIntroLesson,
  ],
};

import type { Locale } from '@/paraglide/runtime';
import { createBasicsTrack } from './lessons/basics';
import { createQuantifiersTrack } from './lessons/quantifiers';
import { createGroupsTrack } from './lessons/groups';
import { createLookaroundTrack } from './lessons/lookaround';
import { createPracticalTrack } from './lessons/practical';
import type { Lesson, PersistedProgress, Track } from './types';
import { addStandaloneReading } from './readingGuides';

export function getTracks(locale?: Locale): Track[] {
  return [
    createBasicsTrack(locale),
    createQuantifiersTrack(locale),
    createGroupsTrack(locale),
    createLookaroundTrack(locale),
    createPracticalTrack(locale),
  ]
    .sort((a, b) => a.order - b.order)
    .map((track) => ({
      ...track,
      lessons: track.lessons.map((lesson) => addStandaloneReading(lesson, locale)),
    }));
}

export const TRACKS = getTracks();

export const ALL_LESSONS: Lesson[] = TRACKS.flatMap((t) => t.lessons);

export function findLesson(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id);
}

export function totalLessons(): number {
  return ALL_LESSONS.length;
}

export function lessonIsCompleted(lesson: Lesson, progress: PersistedProgress): boolean {
  const p = progress.completion[lesson.id];
  if (!p) return false;
  return lesson.steps.every((s) => p.completedSteps.includes(s.id));
}

export function totalCompleted(progress: PersistedProgress): number {
  return ALL_LESSONS.filter((l) => lessonIsCompleted(l, progress)).length;
}

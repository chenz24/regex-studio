import { basicsTrack } from './lessons/basics';
import { quantifiersTrack } from './lessons/quantifiers';
import { groupsTrack } from './lessons/groups';
import { lookaroundTrack } from './lessons/lookaround';
import { practicalTrack } from './lessons/practical';
import type { Lesson, PersistedProgress, Track } from './types';

export const TRACKS: Track[] = [
  basicsTrack,
  quantifiersTrack,
  groupsTrack,
  lookaroundTrack,
  practicalTrack,
].sort((a, b) => a.order - b.order);

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

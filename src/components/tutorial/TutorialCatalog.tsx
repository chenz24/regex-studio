import { Check, ChevronRight } from 'lucide-react';
import { useTutorialStore } from '@/stores/tutorialStore';
import { TRACKS, lessonIsCompleted } from '@/tutorial/registry';
import type { Lesson } from '@/tutorial/types';
import { useT } from '@/lib/i18n';

export function TutorialCatalog() {
  const t = useT();
  const completion = useTutorialStore((s) => s.completion);
  const startLesson = useTutorialStore((s) => s.startLesson);

  const progress = { version: 1 as const, completion };

  return (
    <div className="px-4 py-4 space-y-5">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t.tut_catalog_intro()}
      </p>

      {TRACKS.map((track) => {
        const completedCount = track.lessons.filter((l) => lessonIsCompleted(l, progress)).length;
        return (
          <div key={track.id}>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {track.title}
              </h4>
              <span className="text-[11px] text-gray-400">
                {completedCount}/{track.lessons.length}
              </span>
            </div>
            <ul className="space-y-1.5">
              {track.lessons.map((l) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  done={lessonIsCompleted(l, progress)}
                  onStart={() => startLesson(l.id, 0)}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function LessonRow({
  lesson,
  done,
  onStart,
}: {
  lesson: Lesson;
  done: boolean;
  onStart: () => void;
}) {
  const t = useT();
  return (
    <li>
      <button
        type="button"
        onClick={onStart}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-800/60"
      >
        <span
          className={`w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 ${
            done
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px]'
          }`}
        >
          {done ? <Check className="w-3 h-3" /> : '·'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {lesson.title}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {lesson.summary}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {t.tut_catalog_lesson_meta({ minutes: String(lesson.estimatedMinutes), steps: String(lesson.steps.length) })}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
    </li>
  );
}

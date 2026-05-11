import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useRegexStore, useRegexDerived } from '@/stores/regexStore';
import { useTutorialStore } from '@/stores/tutorialStore';
import { findLesson } from '@/tutorial/registry';
import type { ValidationContext } from '@/tutorial/types';
import { MarkdownLite } from './MarkdownLite';
import { GoalCard } from './GoalCard';
import { HintList } from './HintList';
import { FlavorCompareBlock } from './FlavorCompareBlock';
import { useT } from '@/lib/i18n';

export function LessonRunner() {
  const t = useT();
  const lessonId = useTutorialStore((s) => s.currentLessonId);
  const stepIndex = useTutorialStore((s) => s.currentStepIndex);
  const lastResult = useTutorialStore((s) => s.lastResult);
  const failCount = useTutorialStore((s) => s.failCount);
  const completion = useTutorialStore((s) => s.completion);
  const next = useTutorialStore((s) => s.next);
  const prev = useTutorialStore((s) => s.prev);
  const exitLesson = useTutorialStore((s) => s.exitLesson);
  const markStepDone = useTutorialStore((s) => s.markStepDone);
  const reportValidation = useTutorialStore((s) => s.reportValidation);
  const revealSolution = useTutorialStore((s) => s.revealSolution);

  const pattern = useRegexStore((s) => s.pattern);
  const flags = useRegexStore((s) => s.flags);
  const testText = useRegexStore((s) => s.testText);
  const engine = useRegexStore((s) => s.engine);
  const testCases = useRegexStore((s) => s.testCases);
  const derived = useRegexDerived();

  const lesson = lessonId ? findLesson(lessonId) : undefined;
  const step = lesson?.steps[stepIndex];
  const nextLesson = lesson?.nextLessonId ? findLesson(lesson.nextLessonId) : undefined;
  const startLesson = useTutorialStore((s) => s.startLesson);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to heading on step change for a11y.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger on step change
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex, lessonId]);

  // Alt+ArrowLeft / Alt+ArrowRight to navigate steps. Skipped while the user
  // is typing in an editable element (CodeMirror, inputs, textareas).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          t.isContentEditable ||
          t.closest('.cm-editor')
        ) {
          return;
        }
      }
      e.preventDefault();
      if (e.key === 'ArrowRight') next();
      else prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  const ctx = useMemo<ValidationContext | null>(() => {
    if (!lesson) return null;
    const flagString = flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join('');
    return {
      pattern,
      flagString,
      jsFlagString: derived.jsFlagString,
      engine,
      testText,
      validation: derived.validation,
      matches: derived.matches,
      ast: derived.ast,
      testCases,
      testCaseResults: derived.testResults,
      hasFlag: (key: string) => flags.some((f) => f.key === key && f.enabled),
    };
  }, [pattern, flags, testText, engine, testCases, derived, lesson]);

  // Run validation whenever the context changes.
  useEffect(() => {
    if (!step || !ctx) return;
    const result = step.validate(ctx);
    reportValidation(result);
    if (result.pass && step.autoAdvance !== false) {
      markStepDone(step.id);
    }
  }, [step, ctx, reportValidation, markStepDone]);

  if (!lesson || !step) {
    return (
      <div className="p-4 text-sm text-gray-500">
        {t.tut_runner_lesson_not_found()}
        <button
          type="button"
          onClick={() => exitLesson(false)}
          className="ml-2 text-teal-600 hover:underline"
        >
          {t.tut_runner_back_to_catalog()}
        </button>
      </div>
    );
  }

  const total = lesson.steps.length;
  const stepDoneSet = new Set(completion[lesson.id]?.completedSteps ?? []);
  const isCurrentDone = stepDoneSet.has(step.id);
  const isLast = stepIndex === total - 1;
  const allDone = lesson.steps.every((s) => stepDoneSet.has(s.id));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => exitLesson(true)}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          title={t.tut_runner_back_title()}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 truncate">{lesson.title}</div>
          <div className="text-[11px] text-gray-400">
            {t.tut_runner_step_count({ current: String(stepIndex + 1), total: String(total) })}
          </div>
        </div>
      </div>

      {/* Step dots */}
      <div
        role="group"
        aria-label={t.tut_runner_step_progress()}
        className="px-4 pt-3 flex items-center gap-1.5"
      >
        {lesson.steps.map((s, i) => {
          const done = stepDoneSet.has(s.id);
          const current = i === stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => useTutorialStore.getState().goTo(i)}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                current
                  ? 'bg-teal-500'
                  : done
                    ? 'bg-teal-300 dark:bg-teal-700'
                    : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
              title={t.tut_runner_step_aria({ n: String(i + 1), title: s.title })}
              aria-label={t.tut_runner_step_aria({ n: String(i + 1), title: s.title })}
              aria-current={current ? 'step' : undefined}
            />
          );
        })}
      </div>

      {/* Body (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-gray-900 dark:text-gray-100 outline-none"
        >
          {step.title}
        </h3>

        <MarkdownLite source={step.body} />

        {step.flavorCompare && (
          <FlavorCompareBlock
            flavors={step.flavorCompare.flavors}
            commentary={step.flavorCompare.commentary}
          />
        )}

        <GoalCard result={lastResult} />

        <HintList step={step} failCount={failCount} onRevealSolution={revealSolution} />

        {allDone && isLast && (
          <div className="rounded-lg bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 border border-teal-200 dark:border-teal-800 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-900 dark:text-teal-100">
              <Sparkles className="w-4 h-4" />
              {t.tut_runner_completed_lesson({ title: lesson.title })}
            </div>
            {nextLesson ? (
              <button
                type="button"
                onClick={() => startLesson(nextLesson.id, 0)}
                className="w-full inline-flex items-center justify-between px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
              >
                <div className="text-left">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{t.tut_runner_next_lesson_label()}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {nextLesson.title}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-teal-500" />
              </button>
            ) : (
              <div className="text-xs text-teal-700 dark:text-teal-300">
                {t.tut_runner_track_done()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-2"
        title={t.tut_runner_keyboard_hint()}
      >
        <button
          type="button"
          onClick={prev}
          disabled={stepIndex === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {t.tut_runner_prev()}
        </button>

        <button
          type="button"
          onClick={next}
          disabled={isLast}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isCurrentDone
              ? 'bg-teal-500 text-white hover:bg-teal-600'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {isLast ? t.tut_runner_last() : t.tut_runner_next()}
          {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

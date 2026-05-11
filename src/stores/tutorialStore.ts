import { create } from 'zustand';
import type { LessonProgress, PersistedProgress, ValidationResult } from '@/tutorial/types';
import { findLesson } from '@/tutorial/registry';
import { useRegexStore } from './regexStore';
import type { TestCase } from '@/types/regex';

const STORAGE_KEY = 'regex-studio:tutorial-progress';
const STORAGE_VERSION = 1;

type TutorialView = 'closed' | 'catalog' | 'lesson';

interface TutorialState {
  view: TutorialView;
  currentLessonId: string | null;
  currentStepIndex: number;

  /** Progress, indexed by lessonId. */
  completion: Record<string, LessonProgress>;

  /** Last validation result for the current step (UI displays it). */
  lastResult: ValidationResult | null;

  /** Failure counter — drives progressive hint reveal. */
  failCount: number;

  /** Snapshot of regex store taken when a lesson was started, for restore. */
  snapshotBeforeLesson: SnapshotBeforeLesson | null;
}

interface SnapshotBeforeLesson {
  pattern: string;
  flagString: string;
  testText: string;
  testCases: TestCase[];
  engine: string;
}

interface TutorialActions {
  openCatalog: () => void;
  close: () => void;
  startLesson: (lessonId: string, stepIndex?: number) => void;
  exitLesson: (restore?: boolean) => void;

  next: () => void;
  prev: () => void;
  goTo: (stepIndex: number) => void;

  markStepDone: (stepId: string) => void;
  revealSolution: () => void;
  reportValidation: (r: ValidationResult) => void;

  resetLesson: (lessonId: string) => void;

  /** Hydrate completion from localStorage. Call once on client mount. */
  hydrate: () => void;
}

export type TutorialStore = TutorialState & TutorialActions;

function loadProgress(): Record<string, LessonProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedProgress;
    if (parsed.version !== STORAGE_VERSION) return {};
    return parsed.completion ?? {};
  } catch {
    return {};
  }
}

function saveProgress(completion: Record<string, LessonProgress>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedProgress = { version: STORAGE_VERSION, completion };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function applyStepSetup(
  setup: Partial<import('@/tutorial/types').LessonInitialState> | undefined,
): void {
  if (!setup) return;
  const r = useRegexStore.getState();
  if (setup.engine) r.setEngine(setup.engine);
  if (setup.pattern !== undefined || setup.flags !== undefined) {
    const currentFlagString = r.flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join('');
    r.loadPattern(setup.pattern ?? r.pattern, setup.flags ?? currentFlagString);
  }
  if (setup.testText !== undefined) r.setTestText(setup.testText);
}

function applyLessonInitialState(lessonId: string, stepIndex: number): SnapshotBeforeLesson | null {
  const lesson = findLesson(lessonId);
  if (!lesson) return null;

  const r = useRegexStore.getState();
  const snapshot: SnapshotBeforeLesson = {
    pattern: r.pattern,
    flagString: r.flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join(''),
    testText: r.testText,
    testCases: r.testCases,
    engine: r.engine,
  };

  // Apply lesson initial state.
  const init = lesson.initialState;
  if (init.engine) r.setEngine(init.engine);
  r.loadPattern(init.pattern, init.flags ?? '');
  r.setTestText(init.testText);
  if (init.testCases) {
    r.setTestCases(
      init.testCases.map((tc, idx) => ({
        id: `tut_${lesson.id}_${idx}`,
        label: tc.label ?? `Test ${idx + 1}`,
        input: tc.input,
        expect: tc.expect,
      })),
    );
  } else {
    r.setTestCases([]);
  }

  // Apply per-step setup overrides cumulatively up to stepIndex.
  for (let i = 0; i <= stepIndex && i < lesson.steps.length; i++) {
    applyStepSetup(lesson.steps[i].setup);
  }

  return snapshot;
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  view: 'closed',
  currentLessonId: null,
  currentStepIndex: 0,
  completion: {},
  lastResult: null,
  failCount: 0,
  snapshotBeforeLesson: null,

  openCatalog: () => set({ view: 'catalog' }),

  close: () => set({ view: 'closed' }),

  startLesson: (lessonId, stepIndex = 0) => {
    const lesson = findLesson(lessonId);
    if (!lesson) return;
    const idx = Math.max(0, Math.min(stepIndex, lesson.steps.length - 1));
    const snapshot = applyLessonInitialState(lessonId, idx);
    set({
      view: 'lesson',
      currentLessonId: lessonId,
      currentStepIndex: idx,
      lastResult: null,
      failCount: 0,
      snapshotBeforeLesson: snapshot,
    });
  },

  exitLesson: (restore = false) => {
    const { snapshotBeforeLesson } = get();
    if (restore && snapshotBeforeLesson) {
      const r = useRegexStore.getState();
      r.setEngine(snapshotBeforeLesson.engine as never);
      r.loadPattern(snapshotBeforeLesson.pattern, snapshotBeforeLesson.flagString);
      r.setTestText(snapshotBeforeLesson.testText);
      r.setTestCases(snapshotBeforeLesson.testCases);
    }
    set({
      view: 'catalog',
      currentLessonId: null,
      currentStepIndex: 0,
      lastResult: null,
      failCount: 0,
      snapshotBeforeLesson: null,
    });
  },

  next: () => {
    const { currentLessonId, currentStepIndex } = get();
    if (!currentLessonId) return;
    const lesson = findLesson(currentLessonId);
    if (!lesson) return;
    const nextIdx = Math.min(currentStepIndex + 1, lesson.steps.length - 1);
    if (nextIdx === currentStepIndex) return;
    // Apply step setup if any.
    applyStepSetup(lesson.steps[nextIdx].setup);
    set({ currentStepIndex: nextIdx, lastResult: null, failCount: 0 });
  },

  prev: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex === 0) return;
    set({ currentStepIndex: currentStepIndex - 1, lastResult: null, failCount: 0 });
  },

  goTo: (stepIndex) => {
    const { currentLessonId } = get();
    if (!currentLessonId) return;
    const lesson = findLesson(currentLessonId);
    if (!lesson) return;
    const idx = Math.max(0, Math.min(stepIndex, lesson.steps.length - 1));
    set({ currentStepIndex: idx, lastResult: null, failCount: 0 });
  },

  markStepDone: (stepId) =>
    set((state) => {
      const lessonId = state.currentLessonId;
      if (!lessonId) return state;
      const existing = state.completion[lessonId] ?? { completedSteps: [], usedSolution: false };
      if (existing.completedSteps.includes(stepId)) return state;
      const completion = {
        ...state.completion,
        [lessonId]: {
          ...existing,
          completedSteps: [...existing.completedSteps, stepId],
        },
      };
      saveProgress(completion);
      return { completion };
    }),

  revealSolution: () =>
    set((state) => {
      const lessonId = state.currentLessonId;
      if (!lessonId) return state;
      const existing = state.completion[lessonId] ?? { completedSteps: [], usedSolution: false };
      const completion = {
        ...state.completion,
        [lessonId]: { ...existing, usedSolution: true },
      };
      saveProgress(completion);
      return { completion };
    }),

  reportValidation: (r) =>
    set((state) => {
      // Only bump fail counter when the result transitions from non-fail to fail
      // or when a previously failing result is replaced by another failure.
      const wasPass = state.lastResult?.pass ?? false;
      const failBump = !r.pass && (state.lastResult === null || wasPass) ? 1 : 0;
      return {
        lastResult: r,
        failCount: r.pass ? 0 : state.failCount + failBump,
      };
    }),

  resetLesson: (lessonId) =>
    set((state) => {
      const completion = { ...state.completion };
      delete completion[lessonId];
      saveProgress(completion);
      return { completion };
    }),

  hydrate: () => set({ completion: loadProgress() }),
}));

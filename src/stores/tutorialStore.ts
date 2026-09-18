import { create } from 'zustand';
import type { LessonProgress, PersistedProgress, ValidationResult } from '@/tutorial/types';
import { findLoadedLesson, loadTutorialContent } from '@/tutorial/content';
import { useRegexStore } from './regexStore';
import type { TestCase } from '@/types/regex';
import type { ExecutionEngine, CompatibilityTarget } from '@/types/engineTypes';

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
  stepSnapshots: Record<number, SnapshotBeforeLesson>;
}

interface SnapshotBeforeLesson {
  pattern: string;
  flagString: string;
  testText: string;
  replacement: string;
  showReplace: boolean;
  testCases: TestCase[];
  engine: ExecutionEngine;
  compatibilityTarget: CompatibilityTarget | null;
  legacyTargetFlags: string;
}

interface TutorialActions {
  openCatalog: () => void;
  close: () => void;
  startLesson: (lessonId: string, stepIndex?: number) => Promise<void>;
  exitLesson: (restore?: boolean) => void;

  next: () => void;
  prev: () => void;
  goTo: (stepIndex: number) => void;

  markStepDone: (stepId: string) => void;
  revealSolution: () => void;
  reportValidation: (r: ValidationResult | null) => void;

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
  if (setup.engine) useRegexStore.getState().setEngine(setup.engine);
  const r = useRegexStore.getState();
  if (setup.pattern !== undefined || setup.flags !== undefined) {
    const currentFlagString = r.flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join('');
    r.loadPattern(setup.pattern ?? r.pattern, setup.flags ?? currentFlagString);
  }
  if (setup.testText !== undefined) r.setTestText(setup.testText);
}

function snapshotWorkspace(): SnapshotBeforeLesson {
  const r = useRegexStore.getState();
  return {
    pattern: r.pattern,
    flagString: r.flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join(''),
    testText: r.testText,
    replacement: r.replacement,
    showReplace: r.showReplace,
    testCases: r.testCases,
    engine: r.engine,
    compatibilityTarget: r.compatibilityTarget,
    legacyTargetFlags: r.legacyTargetFlags,
  };
}

function restoreWorkspace(snapshot: SnapshotBeforeLesson): void {
  const r = useRegexStore.getState();
  r.setEngine(snapshot.engine);
  r.setCompatibilityTarget(snapshot.compatibilityTarget);
  r.setLegacyTargetFlags(snapshot.legacyTargetFlags);
  r.loadPattern(snapshot.pattern, snapshot.flagString);
  r.setTestText(snapshot.testText);
  r.setReplacement(snapshot.replacement);
  r.setShowReplace(snapshot.showReplace);
  r.setTestCases(snapshot.testCases);
}

function applyLessonInitialState(lessonId: string, stepIndex: number): void {
  const lesson = findLoadedLesson(lessonId);
  if (!lesson) return;
  const r = useRegexStore.getState();

  // Apply lesson initial state.
  r.setCompatibilityTarget(null);
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
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  view: 'closed',
  currentLessonId: null,
  currentStepIndex: 0,
  completion: {},
  lastResult: null,
  failCount: 0,
  snapshotBeforeLesson: null,
  stepSnapshots: {},

  openCatalog: () => set({ view: 'catalog' }),

  close: () => set({ view: 'closed' }),

  // Async because the lesson content is a separate chunk. Every other
  // transition runs after a lesson has started, so by then it is loaded.
  startLesson: async (lessonId, stepIndex = 0) => {
    await loadTutorialContent();
    const lesson = findLoadedLesson(lessonId);
    if (!lesson) return;
    const idx = Math.max(0, Math.min(stepIndex, lesson.steps.length - 1));
    // Advancing to another lesson must not replace the user's workspace
    // with the previous lesson's exercises.
    const snapshot = get().snapshotBeforeLesson ?? snapshotWorkspace();
    applyLessonInitialState(lessonId, idx);
    set({
      view: 'lesson',
      currentLessonId: lessonId,
      currentStepIndex: idx,
      lastResult: null,
      failCount: 0,
      snapshotBeforeLesson: snapshot,
      stepSnapshots: {},
    });
  },

  exitLesson: (restore = false) => {
    const { snapshotBeforeLesson } = get();
    if (restore && snapshotBeforeLesson) {
      restoreWorkspace(snapshotBeforeLesson);
    }
    set({
      view: 'catalog',
      currentLessonId: null,
      currentStepIndex: 0,
      lastResult: null,
      failCount: 0,
      snapshotBeforeLesson: null,
      stepSnapshots: {},
    });
  },

  next: () => {
    get().goTo(get().currentStepIndex + 1);
  },

  prev: () => {
    get().goTo(get().currentStepIndex - 1);
  },

  goTo: (stepIndex) => {
    const { currentLessonId, currentStepIndex, stepSnapshots } = get();
    if (!currentLessonId || !Number.isFinite(stepIndex)) return;
    const lesson = findLoadedLesson(currentLessonId);
    if (!lesson) return;
    const idx = Math.max(0, Math.min(Math.trunc(stepIndex), lesson.steps.length - 1));
    if (idx === currentStepIndex) return;
    const snapshots = { ...stepSnapshots, [currentStepIndex]: snapshotWorkspace() };
    if (snapshots[idx]) {
      restoreWorkspace(snapshots[idx]);
    } else if (idx > currentStepIndex) {
      // Keep the learner's answer and apply every skipped setup, just as
      // pressing Next repeatedly would do.
      for (let i = currentStepIndex + 1; i <= idx; i++) applyStepSetup(lesson.steps[i].setup);
    } else {
      // Deep links can start midway through a lesson, before earlier steps
      // have a saved answer.
      applyLessonInitialState(currentLessonId, idx);
    }
    set({ currentStepIndex: idx, stepSnapshots: snapshots, lastResult: null, failCount: 0 });
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
      if (!r) return state.lastResult === null ? state : { lastResult: null };
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

import { create } from 'zustand';
import { findChallenge } from '@/challenges/data';
import type {
  ChallengeProgress,
  PersistedChallengeProgress,
} from '@/challenges/types';
import { useRegexStore } from './regexStore';
import type { TestCase } from '@/types/regex';

const STORAGE_KEY = 'regex-studio:challenges-progress';
const STORAGE_VERSION = 1;

type ChallengeView = 'closed' | 'catalog' | 'challenge';

interface SnapshotBeforeChallenge {
  pattern: string;
  flagString: string;
  testText: string;
  testCases: TestCase[];
  engine: string;
}

interface State {
  view: ChallengeView;
  currentChallengeId: string | null;
  /** Reveal solution button clicked. Per-challenge flag stored in memory only. */
  solutionRevealed: Record<string, boolean>;
  /** Persisted: which challenges the user has solved + the pattern they used. */
  completion: Record<string, ChallengeProgress>;
  snapshotBeforeChallenge: SnapshotBeforeChallenge | null;
}

interface Actions {
  openCatalog: () => void;
  close: () => void;
  startChallenge: (id: string) => void;
  exitChallenge: (restore?: boolean) => void;

  /** Mark the active challenge as solved with the current regex state. */
  markSolved: () => void;
  revealSolution: (id: string) => void;
  resetChallenge: (id: string) => void;
  resetAll: () => void;

  hydrate: () => void;
}

export type ChallengeStore = State & Actions;

function loadProgress(): Record<string, ChallengeProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedChallengeProgress;
    if (parsed.version !== STORAGE_VERSION) return {};
    return parsed.completion ?? {};
  } catch {
    return {};
  }
}

function saveProgress(completion: Record<string, ChallengeProgress>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedChallengeProgress = {
      version: STORAGE_VERSION,
      completion,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function snapshotRegex(): SnapshotBeforeChallenge {
  const r = useRegexStore.getState();
  return {
    pattern: r.pattern,
    flagString: r.flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join(''),
    testText: r.testText,
    testCases: r.testCases,
    engine: r.engine,
  };
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  view: 'closed',
  currentChallengeId: null,
  solutionRevealed: {},
  completion: {},
  snapshotBeforeChallenge: null,

  openCatalog: () => set({ view: 'catalog' }),

  close: () => {
    const { snapshotBeforeChallenge } = get();
    if (snapshotBeforeChallenge) {
      const r = useRegexStore.getState();
      r.setEngine(snapshotBeforeChallenge.engine as Parameters<typeof r.setEngine>[0]);
      r.loadPattern(snapshotBeforeChallenge.pattern, snapshotBeforeChallenge.flagString);
      r.setTestText(snapshotBeforeChallenge.testText);
      r.setTestCases(snapshotBeforeChallenge.testCases);
    }
    set({ view: 'closed', currentChallengeId: null, snapshotBeforeChallenge: null });
  },

  startChallenge: (id) => {
    const challenge = findChallenge(id);
    if (!challenge) return;

    const snapshot = get().snapshotBeforeChallenge ?? snapshotRegex();

    const r = useRegexStore.getState();
    // Push the challenge's test cases into the regex store so the existing
    // test panel UI evaluates them live. We give them stable ids so result
    // ordering is predictable.
    const tcs: TestCase[] = challenge.testCases.map((tc, i) => ({
      id: `${challenge.id}__${i}`,
      label: tc.label,
      input: tc.input,
      expect: tc.expect,
    }));
    r.setTestCases(tcs);
    if (challenge.starterPattern !== undefined || challenge.starterFlags !== undefined) {
      const cur = r.flags
        .filter((f) => f.enabled)
        .map((f) => f.key)
        .join('');
      r.loadPattern(challenge.starterPattern ?? '', challenge.starterFlags ?? cur);
    } else {
      r.loadPattern('', '');
    }

    set({
      view: 'challenge',
      currentChallengeId: id,
      snapshotBeforeChallenge: snapshot,
    });
  },

  exitChallenge: (restore = true) => {
    const { snapshotBeforeChallenge } = get();
    if (restore && snapshotBeforeChallenge) {
      const r = useRegexStore.getState();
      r.setEngine(snapshotBeforeChallenge.engine as Parameters<typeof r.setEngine>[0]);
      r.loadPattern(snapshotBeforeChallenge.pattern, snapshotBeforeChallenge.flagString);
      r.setTestText(snapshotBeforeChallenge.testText);
      r.setTestCases(snapshotBeforeChallenge.testCases);
    }
    set({ view: 'catalog', currentChallengeId: null, snapshotBeforeChallenge: null });
  },

  markSolved: () => {
    const { currentChallengeId, completion } = get();
    if (!currentChallengeId) return;
    if (completion[currentChallengeId]) return; // already solved
    const r = useRegexStore.getState();
    const flagString = r.flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join('');
    const next = {
      ...completion,
      [currentChallengeId]: {
        pattern: r.pattern,
        flags: flagString,
        completedAt: Date.now(),
      },
    };
    saveProgress(next);
    set({ completion: next });
  },

  revealSolution: (id) =>
    set((state) => ({
      solutionRevealed: { ...state.solutionRevealed, [id]: true },
    })),

  resetChallenge: (id) => {
    const next = { ...get().completion };
    delete next[id];
    saveProgress(next);
    set((state) => {
      const sr = { ...state.solutionRevealed };
      delete sr[id];
      return { completion: next, solutionRevealed: sr };
    });
  },

  resetAll: () => {
    saveProgress({});
    set({ completion: {}, solutionRevealed: {} });
  },

  hydrate: () => set({ completion: loadProgress() }),
}));

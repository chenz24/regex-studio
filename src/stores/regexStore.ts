import { useCallback, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { RegexFlag, MatchInfo, ASTNode, TestCase, TestCaseResult } from '../types/regex';
import type {
  ExecutionEngine,
  CompatibilityTarget,
  CompatibilityWarning,
} from '../types/engineTypes';
import { ENGINE_FLAVORS, toJsFlagString } from '../types/engineTypes';
import { parseRegex } from '../utils/regexParser';
import { parsePcre2 } from '../utils/pcre2Parser';
import { isValidRegex } from '../utils/regexMatcher';
import {
  cachedOutcome,
  matchInputKey,
  runMatch,
  runMatchInlineCached,
  type MatchInput,
  type MatchOutcome,
} from '../utils/matchEngine';
import { MAX_TEST_CASES } from '../lib/testCases';
import type { SharePayload } from '../lib/share';
import { gradeTestCase } from '../utils/testCaseGrader';
import { checkCompatibility } from '../utils/compatibilityChecker';
import { layoutAST, type LayoutResult } from '../utils/diagramLayout';

// ─── Helpers ───────────────────────────────────────────────────────────

function getDefaultFlags(engine: ExecutionEngine): RegexFlag[] {
  return ENGINE_FLAVORS[engine].flags.map((f) => ({ ...f }));
}

const DEFAULT_PATTERN = '(\\w+)\\s(\\w+)';
const DEFAULT_TEXT = `Hello World
Regex Tool is a powerful online regular expression tester.
Test your patterns here with sample text.
foo bar baz 123 456`;

// ─── State Types ───────────────────────────────────────────────────────

interface RegexState {
  // Core state
  engine: ExecutionEngine;
  compatibilityTarget: CompatibilityTarget | null;
  /** Informational options recovered from a legacy share; never executed. */
  legacyTargetFlags: string;
  pattern: string;
  flags: RegexFlag[];
  testText: string;
  replacement: string;
  showReplace: boolean;

  // Test cases (saved expectations evaluated against the current pattern)
  testCases: TestCase[];

  // UI state
  hoveredNodeId: string | null;

  // History for pattern undo/redo
  patternPast: string[];
  patternFuture: string[];
}

interface RegexActions {
  setEngine: (engine: ExecutionEngine) => void;
  setCompatibilityTarget: (target: CompatibilityTarget | null) => void;
  setLegacyTargetFlags: (flags: string) => void;
  setPattern: (pattern: string) => void;
  toggleFlag: (key: string) => void;
  setTestText: (text: string) => void;
  setReplacement: (replacement: string) => void;
  setShowReplace: (show: boolean) => void;
  loadPattern: (pattern: string, flagString: string) => void;
  loadShare: (payload: SharePayload) => void;

  // Test case actions
  addTestCase: (init?: Partial<Omit<TestCase, 'id'>>) => void;
  updateTestCase: (id: string, patch: Partial<Omit<TestCase, 'id'>>) => void;
  removeTestCase: (id: string) => void;
  setTestCases: (cases: TestCase[]) => void;
  importTestCases: (cases: TestCase[]) => void;

  // History actions
  undoPattern: () => void;
  redoPattern: () => void;

  // UI actions
  setHoveredNodeId: (id: string | null) => void;
}

interface RegexDerived {
  visualizationSupported: boolean;
  visualizationReason?: string;
  executionEngine: 'javascript' | 'pcre2';
  /** Flags as displayed in `/pattern/flags` for the execution engine. */
  flagString: string;
  /** Flags actually forwarded to `new RegExp(...)`. JS-safe subset only. */
  jsFlagString: string;
  validation: { valid: boolean; error?: string };
  matches: MatchInfo[];
  matchesTruncated: boolean;
  ast: ASTNode;
  diagram: LayoutResult;
  compatibilityWarnings: CompatibilityWarning[];
  replacedText: string;
  testResults: TestCaseResult[];
  testsPassed: number;
  /** The pattern overran its deadline and was abandoned. */
  timedOut: boolean;
  /** Results shown are from the previous input while the current one runs. */
  pending: boolean;
  executionError?: string;
  replacementError?: string;
  retry: () => void;
}

type RegexStore = RegexState & RegexActions;

// ─── Derived State Selectors ───────────────────────────────────────────

/** Everything derivable from the pattern alone — our own code, and bounded. */
function computeStatic(
  state: Pick<RegexState, 'engine' | 'pattern' | 'flags' | 'compatibilityTarget'>,
) {
  const flagString = state.flags
    .filter((f) => f.enabled)
    .map((f) => f.key)
    .join('');

  // PCRE2 receives its complete flagString, including x/U/J. Compatibility
  // checks never participate in execution flag selection.
  const jsFlagString = toJsFlagString(state.flags);
  const executionEngine = state.engine;
  const validation =
    executionEngine === 'pcre2' ? { valid: true } : isValidRegex(state.pattern, jsFlagString);

  const visual = executionEngine === 'pcre2' ? parsePcre2(state.pattern, flagString) : undefined;
  const ast: ASTNode =
    visual?.ast ??
    (state.pattern
      ? parseRegex(state.pattern, jsFlagString)
      : { type: 'sequence', value: '', children: [], raw: '', id: 'empty', start: 0, end: 0 });

  const diagram = layoutAST(ast);

  const compatibilityWarnings: CompatibilityWarning[] =
    state.pattern &&
    validation.valid &&
    executionEngine === 'javascript' &&
    state.compatibilityTarget
      ? checkCompatibility(ast, state.compatibilityTarget)
      : [];

  return {
    visualizationSupported: visual?.supported ?? true,
    visualizationReason: visual?.reason,
    flagString,
    jsFlagString,
    executionEngine,
    validation,
    ast,
    diagram,
    compatibilityWarnings,
  };
}

/**
 * Run the pattern off the main thread.
 *
 * Only the built-in default is computed inline for hydration. Other consumers
 * can mount after the user has entered an arbitrary pattern.
 * Every later input goes to the worker, which can be killed if the pattern
 * turns out to be one that never finishes. While a run is outstanding the
 * previous result stays on screen rather than flashing to empty.
 */
function useMatchOutcome(
  input: MatchInput,
): MatchOutcome & { pending: boolean; retry: () => void } {
  const key = matchInputKey(input);
  const [attempt, setAttempt] = useState(0);
  const [entry, setEntry] = useState(() => ({
    key,
    engine: input.engine,
    outcome:
      cachedOutcome(key) ??
      (input.engine !== 'pcre2' &&
      input.pattern === DEFAULT_PATTERN &&
      input.flags === 'g' &&
      input.text === DEFAULT_TEXT &&
      input.replacement === '' &&
      input.testInputs.length === 0
        ? runMatchInlineCached(input, key)
        : undefined),
  }));
  const empty = useMemo<MatchOutcome>(
    () => ({
      matches: [],
      replacedText: input.text,
      testMatchCounts: [],
      timedOut: false,
    }),
    [input.text],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt deliberately retries identical input.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    runMatch(input, controller.signal).then((outcome) => {
      if (!cancelled) setEntry({ key, engine: input.engine, outcome });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, input, attempt]);

  const retry = useCallback(() => {
    setEntry({ key, engine: input.engine, outcome: undefined });
    setAttempt((value) => value + 1);
  }, [key, input.engine]);

  const settled = entry.key === key ? entry.outcome : cachedOutcome(key);
  // Must be memoised: consumers key effects off the derived object, and a
  // fresh identity on every render turns those into an update loop.
  return useMemo(
    () => ({
      ...(settled ?? (entry.engine === input.engine ? entry.outcome : undefined) ?? empty),
      pending: settled === undefined,
      retry,
    }),
    [settled, entry.outcome, entry.engine, input.engine, empty, retry],
  );
}

// ─── Store ─────────────────────────────────────────────────────────────

const HISTORY_LIMIT = 100;
const testCaseId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useRegexStore = create<RegexStore>((set) => ({
  // Initial state
  engine: 'javascript',
  compatibilityTarget: null,
  legacyTargetFlags: '',
  pattern: DEFAULT_PATTERN,
  flags: getDefaultFlags('javascript'),
  testText: DEFAULT_TEXT,
  replacement: '',
  showReplace: false,
  testCases: [],
  hoveredNodeId: null,
  patternPast: [],
  patternFuture: [],

  // Actions
  setCompatibilityTarget: (compatibilityTarget) =>
    set({ compatibilityTarget, legacyTargetFlags: '' }),
  setLegacyTargetFlags: (legacyTargetFlags) => set({ legacyTargetFlags }),
  setEngine: (engine) =>
    set((state) => {
      // Carry the user's choice across for flags the new engine also has —
      // including the choice to turn one off, which `||` used to undo — and
      // fall back to the new engine's default for flags that are new.
      const previous = new Map(state.flags.map((f) => [f.key, f.enabled]));
      const nextFlags = getDefaultFlags(engine).map((f) => ({
        ...f,
        enabled: previous.get(f.key) ?? f.enabled,
      }));
      return { engine, flags: nextFlags };
    }),

  setPattern: (pattern) =>
    set((state) => {
      if (pattern === state.pattern) return state;
      const past = [...state.patternPast, state.pattern];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { pattern, patternPast: past, patternFuture: [] };
    }),

  undoPattern: () =>
    set((state) => {
      if (state.patternPast.length === 0) return state;
      const past = state.patternPast.slice();
      const prev = past.pop()!;
      return {
        pattern: prev,
        patternPast: past,
        patternFuture: [state.pattern, ...state.patternFuture].slice(0, HISTORY_LIMIT),
      };
    }),

  redoPattern: () =>
    set((state) => {
      if (state.patternFuture.length === 0) return state;
      const [next, ...rest] = state.patternFuture;
      return {
        pattern: next,
        patternPast: [...state.patternPast, state.pattern].slice(-HISTORY_LIMIT),
        patternFuture: rest,
      };
    }),

  toggleFlag: (key) =>
    set((state) => ({
      flags: state.flags.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)),
    })),

  setTestText: (testText) => set({ testText }),

  setReplacement: (replacement) => set({ replacement }),

  setShowReplace: (showReplace) => set({ showReplace }),

  loadPattern: (pattern, flagString) =>
    set((state) => {
      const past =
        pattern === state.pattern
          ? state.patternPast
          : [...state.patternPast, state.pattern].slice(-HISTORY_LIMIT);
      return {
        pattern,
        patternPast: past,
        patternFuture: pattern === state.pattern ? state.patternFuture : [],
        flags: state.flags.map((flag) => ({
          ...flag,
          enabled: flagString.includes(flag.key),
        })),
      };
    }),

  // A share represents a whole workspace. Omitted optional fields use the
  // same defaults as a fresh tab, rather than leaking from the previous link.
  loadShare: (payload) =>
    set({
      engine: payload.e,
      compatibilityTarget: payload.c ?? null,
      legacyTargetFlags: payload.lf ?? '',
      pattern: payload.p,
      flags: getDefaultFlags(payload.e).map((flag) => ({
        ...flag,
        enabled: payload.f.includes(flag.key),
      })),
      testText: payload.t ?? DEFAULT_TEXT,
      replacement: payload.r ?? '',
      showReplace: payload.sr ?? false,
      testCases: payload.tc ?? [],
      patternPast: [],
      patternFuture: [],
      hoveredNodeId: null,
    }),

  setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),

  addTestCase: (init) =>
    set((state) => {
      if (state.testCases.length >= MAX_TEST_CASES) return state;
      const id = testCaseId();
      const newCase: TestCase = {
        id,
        label: init?.label ?? `Test ${state.testCases.length + 1}`,
        input: init?.input ?? '',
        expect: init?.expect ?? 'match',
        assertions: init?.assertions,
      };
      return { testCases: [...state.testCases, newCase] };
    }),

  updateTestCase: (id, patch) =>
    set((state) => ({
      testCases: state.testCases.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc)),
    })),

  removeTestCase: (id) =>
    set((state) => ({
      testCases: state.testCases.filter((tc) => tc.id !== id),
    })),

  setTestCases: (testCases) => set({ testCases }),
  importTestCases: (cases) =>
    set((state) => {
      if (state.testCases.length + cases.length > MAX_TEST_CASES)
        throw new Error('Too many test cases');
      return {
        testCases: [...state.testCases, ...cases.map((test) => ({ ...test, id: testCaseId() }))],
      };
    }),
}));

// ─── Selector Hooks ────────────────────────────────────────────────────

export function useRegexDerived(fixedTestCases?: TestCase[]): RegexDerived {
  const engine = useRegexStore((s) => s.engine);
  const compatibilityTarget = useRegexStore((s) => s.compatibilityTarget);
  const pattern = useRegexStore((s) => s.pattern);
  const flags = useRegexStore((s) => s.flags);
  const testText = useRegexStore((s) => s.testText);
  const replacement = useRegexStore((s) => s.replacement);
  const storedTestCases = useRegexStore((s) => s.testCases);
  const testCases = fixedTestCases ?? storedTestCases;

  const derived = useMemo(
    () => computeStatic({ engine, pattern, flags, compatibilityTarget }),
    [engine, pattern, flags, compatibilityTarget],
  );

  // Expectations and labels do not affect execution, including after a timeout.
  const testInputKey = JSON.stringify(
    testCases.map((tc) => [tc.input, tc.assertions?.replacement !== undefined]),
  );
  const testRequests = useMemo(
    () => JSON.parse(testInputKey) as [string, boolean][],
    [testInputKey],
  );
  const matchInput: MatchInput = useMemo(
    () => ({
      engine: derived.executionEngine,
      // An invalid pattern has nothing to run; the error is reported by
      // `validation` instead.
      pattern: derived.validation.valid ? pattern : '',
      flags: derived.executionEngine === 'pcre2' ? derived.flagString : derived.jsFlagString,
      text: testText,
      replacement,
      testInputs: testRequests.map(([text]) => text),
      testReplacements: testRequests.map(([, replace]) => replace),
    }),
    [
      pattern,
      derived.validation.valid,
      derived.executionEngine,
      derived.flagString,
      derived.jsFlagString,
      testText,
      replacement,
      testRequests,
    ],
  );

  const outcome = useMatchOutcome(matchInput);

  return useMemo(() => {
    const validation =
      derived.executionEngine === 'pcre2' && !outcome.pending
        ? (outcome.validation ?? derived.validation)
        : derived.validation;
    const executionError = outcome.pending ? undefined : outcome.executionError;
    const testResults: TestCaseResult[] = testCases.map((tc, i) =>
      gradeTestCase(tc, outcome.testExecutions?.[i], {
        invalid: !validation.valid,
        pending: outcome.pending,
        timedOut: outcome.timedOut,
        executionError,
      }),
    );

    return {
      ...derived,
      validation,
      matches: outcome.matches,
      matchesTruncated: !!outcome.matchesTruncated,
      replacedText: outcome.replacedText,
      testResults,
      testsPassed: testResults.filter((r) => r.pass).length,
      timedOut: !outcome.pending && outcome.timedOut,
      pending: outcome.pending,
      executionError,
      replacementError: outcome.pending ? undefined : outcome.replacementError,
      retry: outcome.retry,
    };
  }, [derived, outcome, testCases]);
}

// Fine-grained selectors for performance
export const usePattern = () => useRegexStore((s) => s.pattern);
export const useTestText = () => useRegexStore((s) => s.testText);
export const useEngine = () => useRegexStore((s) => s.engine);
export const useFlags = () => useRegexStore((s) => s.flags);
export const useReplacement = () => useRegexStore((s) => s.replacement);
export const useHoveredNodeId = () => useRegexStore((s) => s.hoveredNodeId);

/**
 * All actions in one object. The shallow comparator is required: without it
 * the freshly built object is a new reference on every store read, which
 * re-renders the consumer on every state change.
 */
export const useRegexActions = () =>
  useRegexStore(
    useShallow((s) => ({
      setEngine: s.setEngine,
      setCompatibilityTarget: s.setCompatibilityTarget,
      setLegacyTargetFlags: s.setLegacyTargetFlags,
      setPattern: s.setPattern,
      undoPattern: s.undoPattern,
      redoPattern: s.redoPattern,
      toggleFlag: s.toggleFlag,
      setTestText: s.setTestText,
      setReplacement: s.setReplacement,
      setShowReplace: s.setShowReplace,
      loadPattern: s.loadPattern,
      loadShare: s.loadShare,
      setHoveredNodeId: s.setHoveredNodeId,
      addTestCase: s.addTestCase,
      updateTestCase: s.updateTestCase,
      removeTestCase: s.removeTestCase,
      setTestCases: s.setTestCases,
      importTestCases: s.importTestCases,
    })),
  );

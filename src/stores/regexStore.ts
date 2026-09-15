import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { RegexFlag, MatchInfo, ASTNode, TestCase, TestCaseResult } from '../types/regex';
import type { RegexEngine, CompatibilityWarning } from '../types/engineTypes';
import { ENGINE_FLAVORS, toJsFlagString } from '../types/engineTypes';
import { parseRegex } from '../utils/regexParser';
import { isValidRegex } from '../utils/regexMatcher';
import {
  cachedOutcome,
  matchInputKey,
  runMatch,
  runMatchInlineCached,
  type MatchInput,
  type MatchOutcome,
} from '../utils/matchEngine';
import { checkCompatibility } from '../utils/compatibilityChecker';
import { layoutAST, type LayoutResult } from '../utils/diagramLayout';

// ─── Helpers ───────────────────────────────────────────────────────────

function getDefaultFlags(engine: RegexEngine): RegexFlag[] {
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
  engine: RegexEngine;
  pattern: string;
  flags: RegexFlag[];
  testText: string;
  replacement: string;
  showReplace: boolean;

  // Test cases (saved expectations evaluated against the current pattern)
  testCases: TestCase[];

  // UI state
  selectedMatch: number | null;
  hoveredNodeId: string | null;

  // History for pattern undo/redo
  patternPast: string[];
  patternFuture: string[];
}

interface RegexActions {
  setEngine: (engine: RegexEngine) => void;
  setPattern: (pattern: string) => void;
  toggleFlag: (key: string) => void;
  setTestText: (text: string) => void;
  setReplacement: (replacement: string) => void;
  setShowReplace: (show: boolean) => void;
  loadPattern: (pattern: string, flagString: string) => void;

  // Test case actions
  addTestCase: (init?: Partial<Omit<TestCase, 'id'>>) => void;
  updateTestCase: (id: string, patch: Partial<Omit<TestCase, 'id'>>) => void;
  removeTestCase: (id: string) => void;
  setTestCases: (cases: TestCase[]) => void;

  // History actions
  undoPattern: () => void;
  redoPattern: () => void;

  // UI actions
  setSelectedMatch: (index: number | null) => void;
  setHoveredNodeId: (id: string | null) => void;
}

interface RegexDerived {
  /** Flags as displayed in `/pattern/flags` (target-engine view). */
  flagString: string;
  /** Flags actually forwarded to `new RegExp(...)`. JS-safe subset only. */
  jsFlagString: string;
  validation: { valid: boolean; error?: string };
  matches: MatchInfo[];
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
}

type RegexStore = RegexState & RegexActions;

// ─── Derived State Selectors ───────────────────────────────────────────

/** Everything derivable from the pattern alone — our own code, and bounded. */
function computeStatic(state: Pick<RegexState, 'engine' | 'pattern' | 'flags'>) {
  const flagString = state.flags
    .filter((f) => f.enabled)
    .map((f) => f.key)
    .join('');

  // Only the JS-safe subset is forwarded to `new RegExp(...)`. Display-only
  // flags (e.g. Python `x`, PCRE `U/J`, .NET `n`) never reach the engine.
  const jsFlagString = toJsFlagString(state.flags);
  const validation = isValidRegex(state.pattern, jsFlagString);

  const ast: ASTNode = state.pattern
    ? parseRegex(state.pattern, jsFlagString)
    : { type: 'sequence', value: '', children: [], raw: '', id: 'empty', start: 0, end: 0 };

  const diagram = layoutAST(ast);

  const compatibilityWarnings: CompatibilityWarning[] =
    state.pattern && validation.valid ? checkCompatibility(ast, state.engine) : [];

  return { flagString, jsFlagString, validation, ast, diagram, compatibilityWarnings };
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
function useMatchOutcome(input: MatchInput): MatchOutcome & { pending: boolean } {
  const key = matchInputKey(input);
  const [entry, setEntry] = useState(() => ({
    key,
    outcome:
      cachedOutcome(key) ??
      (input.pattern === DEFAULT_PATTERN &&
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

  useEffect(() => {
    let cancelled = false;
    runMatch(input).then((outcome) => {
      if (!cancelled) setEntry({ key, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [key, input]);

  const settled = entry.key === key ? entry.outcome : cachedOutcome(key);
  // Must be memoised: consumers key effects off the derived object, and a
  // fresh identity on every render turns those into an update loop.
  return useMemo(
    () => ({ ...(settled ?? entry.outcome ?? empty), pending: settled === undefined }),
    [settled, entry.outcome, empty],
  );
}

// ─── Store ─────────────────────────────────────────────────────────────

const HISTORY_LIMIT = 100;

export const useRegexStore = create<RegexStore>((set) => ({
  // Initial state
  engine: 'javascript',
  pattern: DEFAULT_PATTERN,
  flags: getDefaultFlags('javascript'),
  testText: DEFAULT_TEXT,
  replacement: '',
  showReplace: false,
  testCases: [],
  selectedMatch: null,
  hoveredNodeId: null,
  patternPast: [],
  patternFuture: [],

  // Actions
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

  setSelectedMatch: (selectedMatch) => set({ selectedMatch }),

  setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),

  addTestCase: (init) =>
    set((state) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newCase: TestCase = {
        id,
        label: init?.label ?? `Test ${state.testCases.length + 1}`,
        input: init?.input ?? '',
        expect: init?.expect ?? 'match',
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
}));

// ─── Selector Hooks ────────────────────────────────────────────────────

export function useRegexDerived(fixedTestCases?: TestCase[]): RegexDerived {
  const engine = useRegexStore((s) => s.engine);
  const pattern = useRegexStore((s) => s.pattern);
  const flags = useRegexStore((s) => s.flags);
  const testText = useRegexStore((s) => s.testText);
  const replacement = useRegexStore((s) => s.replacement);
  const storedTestCases = useRegexStore((s) => s.testCases);
  const testCases = fixedTestCases ?? storedTestCases;

  const derived = useMemo(
    () => computeStatic({ engine, pattern, flags }),
    [engine, pattern, flags],
  );

  const matchInput: MatchInput = useMemo(
    () => ({
      // An invalid pattern has nothing to run; the error is reported by
      // `validation` instead.
      pattern: derived.validation.valid ? pattern : '',
      flags: derived.jsFlagString,
      text: testText,
      replacement,
      testInputs: testCases.map((tc) => tc.input),
    }),
    [pattern, derived.validation.valid, derived.jsFlagString, testText, replacement, testCases],
  );

  const outcome = useMatchOutcome(matchInput);

  return useMemo(() => {
    const testResults: TestCaseResult[] = testCases.map((tc, i) => {
      if (!derived.validation.valid) {
        return { id: tc.id, pass: false, matchCount: 0, invalid: true };
      }
      if (outcome.pending || outcome.timedOut) {
        return {
          id: tc.id,
          pass: false,
          matchCount: 0,
          invalid: false,
          pending: outcome.pending,
          timedOut: outcome.timedOut && !outcome.pending,
        };
      }
      const matchCount = outcome.testMatchCounts[i] ?? 0;
      const hasMatch = matchCount > 0;
      return {
        id: tc.id,
        pass: tc.expect === 'match' ? hasMatch : !hasMatch,
        matchCount,
        invalid: false,
      };
    });

    return {
      ...derived,
      matches: outcome.matches,
      replacedText: outcome.replacedText,
      testResults,
      testsPassed: testResults.filter((r) => r.pass).length,
      timedOut: outcome.timedOut,
      pending: outcome.pending,
    };
  }, [derived, outcome, testCases]);
}

// Fine-grained selectors for performance
export const usePattern = () => useRegexStore((s) => s.pattern);
export const useTestText = () => useRegexStore((s) => s.testText);
export const useEngine = () => useRegexStore((s) => s.engine);
export const useFlags = () => useRegexStore((s) => s.flags);
export const useReplacement = () => useRegexStore((s) => s.replacement);
export const useSelectedMatch = () => useRegexStore((s) => s.selectedMatch);
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
      setPattern: s.setPattern,
      toggleFlag: s.toggleFlag,
      setTestText: s.setTestText,
      setReplacement: s.setReplacement,
      setShowReplace: s.setShowReplace,
      loadPattern: s.loadPattern,
      setSelectedMatch: s.setSelectedMatch,
      setHoveredNodeId: s.setHoveredNodeId,
      addTestCase: s.addTestCase,
      updateTestCase: s.updateTestCase,
      removeTestCase: s.removeTestCase,
      setTestCases: s.setTestCases,
    })),
  );

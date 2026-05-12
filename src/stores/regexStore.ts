import { useMemo } from 'react';
import { create } from 'zustand';
import type { RegexFlag, MatchInfo, ASTNode, TestCase, TestCaseResult } from '../types/regex';
import type { RegexEngine, CompatibilityWarning } from '../types/engineTypes';
import { ENGINE_FLAVORS, toJsFlagString } from '../types/engineTypes';
import { parseRegex } from '../utils/regexParser';
import { findMatches, isValidRegex, replaceMatches } from '../utils/regexMatcher';
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
}

type RegexStore = RegexState & RegexActions;

// ─── Derived State Selectors ───────────────────────────────────────────

function computeDerived(state: RegexState): RegexDerived {
  const flagString = state.flags
    .filter((f) => f.enabled)
    .map((f) => f.key)
    .join('');

  // Only the JS-safe subset is forwarded to `new RegExp(...)`. Display-only
  // flags (e.g. Python `x`, PCRE `U/J`, .NET `n`) never reach the engine.
  const jsFlagString = toJsFlagString(state.flags);

  const validation = isValidRegex(state.pattern, jsFlagString);

  const matches: MatchInfo[] = validation.valid
    ? findMatches(state.pattern, jsFlagString, state.testText)
    : [];

  const ast: ASTNode = state.pattern
    ? parseRegex(state.pattern)
    : { type: 'sequence', value: '', children: [], raw: '', id: 'empty', start: 0, end: 0 };

  const diagram = layoutAST(ast);

  const compatibilityWarnings: CompatibilityWarning[] =
    state.pattern && validation.valid ? checkCompatibility(ast, state.engine) : [];

  const replacedText =
    state.replacement && validation.valid
      ? replaceMatches(state.pattern, jsFlagString, state.testText, state.replacement)
      : state.testText;

  const testResults: TestCaseResult[] = state.testCases.map((tc) => {
    if (!validation.valid) {
      return { id: tc.id, pass: false, matchCount: 0, invalid: true };
    }
    const m = findMatches(state.pattern, jsFlagString, tc.input);
    const hasMatch = m.length > 0;
    const pass = tc.expect === 'match' ? hasMatch : !hasMatch;
    return { id: tc.id, pass, matchCount: m.length, invalid: false };
  });
  const testsPassed = testResults.filter((r) => r.pass).length;

  return {
    flagString,
    jsFlagString,
    validation,
    matches,
    ast,
    diagram,
    compatibilityWarnings,
    replacedText,
    testResults,
    testsPassed,
  };
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
      // Preserve enabled state for flags that exist (by key) in the new
      // engine; drop flags that don't apply to the new target.
      const previouslyEnabled = new Set(state.flags.filter((f) => f.enabled).map((f) => f.key));
      const nextFlags = getDefaultFlags(engine).map((f) => ({
        ...f,
        enabled: previouslyEnabled.has(f.key) || f.enabled,
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

export function useRegexDerived(): RegexDerived {
  const engine = useRegexStore((s) => s.engine);
  const pattern = useRegexStore((s) => s.pattern);
  const flags = useRegexStore((s) => s.flags);
  const testText = useRegexStore((s) => s.testText);
  const replacement = useRegexStore((s) => s.replacement);
  const showReplace = useRegexStore((s) => s.showReplace);
  const testCases = useRegexStore((s) => s.testCases);

  return useMemo(() => {
    return computeDerived({
      engine,
      pattern,
      flags,
      testText,
      replacement,
      showReplace,
      testCases,
      selectedMatch: null,
      hoveredNodeId: null,
      patternPast: [],
      patternFuture: [],
    });
  }, [engine, pattern, flags, testText, replacement, showReplace, testCases]);
}

// Fine-grained selectors for performance
export const usePattern = () => useRegexStore((s) => s.pattern);
export const useTestText = () => useRegexStore((s) => s.testText);
export const useEngine = () => useRegexStore((s) => s.engine);
export const useFlags = () => useRegexStore((s) => s.flags);
export const useReplacement = () => useRegexStore((s) => s.replacement);
export const useSelectedMatch = () => useRegexStore((s) => s.selectedMatch);
export const useHoveredNodeId = () => useRegexStore((s) => s.hoveredNodeId);

// Action selectors (stable references)
export const useRegexActions = () =>
  useRegexStore((s) => ({
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
  }));

import type { ASTNode, MatchInfo, TestCase, TestCaseResult } from '@/types/regex';
import type { RegexEngine } from '@/types/engineTypes';

export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** A track groups lessons by topic. */
export interface Track {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
}

/** A lesson is a sequence of steps teaching one concept. */
export interface Lesson {
  id: string;
  trackId: string;
  title: string;
  summary: string;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  /** State written to the regex store when the lesson starts. */
  initialState: LessonInitialState;
  steps: Step[];
  /** Recommended next lesson after completion. */
  nextLessonId?: string;
}

export interface LessonInitialState {
  engine?: RegexEngine;
  pattern: string;
  flags?: string;
  testText: string;
  testCases?: Array<{ input: string; expect: 'match' | 'noMatch'; label?: string }>;
}

export interface Step {
  id: string;
  title: string;
  /** Markdown body. Rendered as plain prose with minimal inline formatting. */
  body: string;
  /** Optional patch applied to regex store when this step is entered. */
  setup?: Partial<LessonInitialState>;
  validate: (ctx: ValidationContext) => ValidationResult;
  hints?: string[];
  solution?: { pattern: string; flags?: string; explanation?: string };
  /** When true (default), step auto-completes on validation pass. */
  autoAdvance?: boolean;
  /**
   * Optional visual linkage to the main editor surface. When a step specifies
   * a spotlight, matching AST nodes are highlighted in the Railroad diagram
   * AND the Explanation panel; the Tool panel can be force-opened to a
   * specific tab; and the Explanation scroller is pulled to the first match.
   */
  spotlight?: StepSpotlight;
  /**
   * Inline Flavor comparison widget. Renders a small tab strip inside the
   * lesson body showing how each selected flavor would treat the current
   * pattern (compatibility warnings + optional per-flavor commentary).
   */
  flavorCompare?: StepFlavorCompare;
}

export interface StepSpotlight {
  /**
   * Substrings of the current pattern. Every occurrence is resolved to the
   * smallest AST node whose [start, end) covers it; falls back to the
   * deepest covering node when there's no exact match.
   */
  patternSubstrings?: string[];
  /** Or pick ranges explicitly if substrings are ambiguous. */
  patternRanges?: Array<[number, number]>;
  /** Which Tool panel tab to auto-open when entering the step. */
  openPanel?: ToolPanelTab;
  /** When true, also scroll the Explanation panel to the first match. */
  scrollExplanation?: boolean;
}

export type ToolPanelTab =
  | 'debugger'
  | 'matches'
  | 'explanation'
  | 'tests'
  | 'replace'
  | 'codegen'
  | 'ast';

export interface StepFlavorCompare {
  flavors: RegexEngine[];
  /** Optional per-flavor commentary shown under the warnings list. */
  commentary?: Partial<Record<RegexEngine, string>>;
}

export interface ValidationContext {
  pattern: string;
  /** Flag string as displayed (target-engine view). */
  flagString: string;
  /** Flag string actually used by the JS regex engine. */
  jsFlagString: string;
  engine: RegexEngine;
  testText: string;
  validation: { valid: boolean; error?: string };
  matches: MatchInfo[];
  ast: ASTNode;
  testCases: TestCase[];
  testCaseResults: TestCaseResult[];
  /** Convenience: is a given flag character enabled? */
  hasFlag: (key: string) => boolean;
}

export interface ValidationCheck {
  label: string;
  pass: boolean;
  detail?: string;
}

export interface ValidationResult {
  pass: boolean;
  checks: ValidationCheck[];
  feedback?: string;
}

export type Validator = (ctx: ValidationContext) => ValidationResult;

// ─── Persisted progress ─────────────────────────────────────────────────

export interface LessonProgress {
  completedSteps: string[];
  usedSolution: boolean;
}

export interface PersistedProgress {
  version: 1;
  completion: Record<string, LessonProgress>;
}

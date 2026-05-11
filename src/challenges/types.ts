import type { TestCase } from '../types/regex';

export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * A self-contained regex puzzle. The user must come up with a pattern + flags
 * such that **every** test case yields the expected outcome (`match` →
 * `findMatches(...).length > 0`; `noMatch` → length 0).
 *
 * Validation challenges (e.g. "is this string a strong password?") expect
 * the user to anchor with `^...$` so substring matches don't slip through —
 * the challenge description should make this clear.
 */
export interface Challenge {
  id: string;
  title: string;
  /** One-line subtitle shown in the catalog. */
  summary: string;
  /** Full markdown body shown in the runner. */
  description: string;
  difficulty: ChallengeDifficulty;
  /** Pre-filled pattern shown when the user opens the challenge. */
  starterPattern?: string;
  starterFlags?: string;
  /** Hidden testCases. The user must pass all of them. */
  testCases: Array<Omit<TestCase, 'id'>>;
  /** Optional reveal-on-demand reference solution. */
  idealSolution?: { pattern: string; flags?: string; explanation?: string };
  hints?: string[];
}

export interface ChallengeProgress {
  /** Pattern the user submitted when they passed. */
  pattern: string;
  flags: string;
  completedAt: number;
}

export interface PersistedChallengeProgress {
  version: 1;
  completion: Record<string, ChallengeProgress>;
}

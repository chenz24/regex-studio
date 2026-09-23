import type { TestCase } from '../types/regex';

export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * A self-contained regex puzzle. The user must come up with a pattern + flags
 * such that every test case satisfies its presence expectation and assertions.
 * Published extraction cases specify complete ordered matches; validation
 * cases specify a single whole-input match or no match.
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
  /** Visible test cases. The user must pass all of them. */
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

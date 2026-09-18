import { retainReplacement, TEST_REPLACEMENT_BUDGET } from './testResultBudget';
import type { MatchInput, MatchOutcome } from './matchEngine';
import {
  findMatchResult,
  isValidRegex,
  TEST_DETAIL_BUDGET,
  TEST_DETAIL_LIMIT,
} from './regexMatcher';

function substitute(input: MatchInput, text: string) {
  try {
    return {
      replacedText: input.pattern
        ? text.replace(new RegExp(input.pattern, input.flags), input.replacement)
        : text,
    };
  } catch (error) {
    return { replacedText: text, replacementError: (error as Error).message };
  }
}

/** Shared by the real Worker and the trusted SSR/default-input path. */
export function executeJavascript(input: MatchInput): MatchOutcome {
  const outcome: MatchOutcome = {
    matches: [],
    replacedText: input.text,
    testMatchCounts: [],
    timedOut: false,
    validation: isValidRegex(input.pattern, input.flags),
  };
  if (!outcome.validation?.valid || input.validateOnly) return outcome;
  try {
    const main = findMatchResult(input.pattern, input.flags, input.text);
    outcome.matches = main.matches;
    outcome.matchesTruncated = main.truncated;
    Object.assign(outcome, substitute(input, input.text));
    const budget = { remaining: TEST_DETAIL_BUDGET };
    const replacementBudget = { remaining: TEST_REPLACEMENT_BUDGET };
    outcome.testExecutions = input.testInputs.map((text, index) => ({
      ...findMatchResult(input.pattern, input.flags, text, TEST_DETAIL_LIMIT, budget),
      ...(input.testReplacements?.[index]
        ? retainReplacement(substitute(input, text), replacementBudget)
        : {}),
    }));
    outcome.testMatchCounts = outcome.testExecutions.map((result) => result.matchCount);
  } catch (error) {
    outcome.executionError = (error as Error).message;
    outcome.testExecutions = [];
    outcome.testMatchCounts = [];
    outcome.matches = [];
    outcome.matchesTruncated = false;
  }
  return outcome;
}

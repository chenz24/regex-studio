/** Limit retained replacement strings across a whole test batch, in UTF-16 units. */
export const TEST_REPLACEMENT_BUDGET = 2_000_000;
export function retainReplacement(
  result: { replacedText: string; replacementError?: string },
  budget: { remaining: number },
): { replacedText?: string; replacementError?: string } {
  if (result.replacementError) return { replacementError: result.replacementError };
  if (result.replacedText.length > budget.remaining)
    return { replacementError: 'Test replacement output exceeds the size limit' };
  budget.remaining -= result.replacedText.length;
  return result;
}

import { describe, expect, it } from 'vitest';
import { executeJavascript } from './javascriptMatcher';

describe('main-text result completeness', () => {
  it.each([
    10000, 10001,
  ])('marks only incomplete counts at length %i without limiting replacement', (count) => {
    const result = executeJavascript({
      pattern: 'a',
      flags: 'g',
      text: 'a'.repeat(count),
      replacement: 'X',
      testInputs: [],
    });
    expect(result.matches).toHaveLength(Math.min(count, 10000));
    expect(result.matchesTruncated).toBe(count > 10000);
    expect(result.replacedText).toBe('X'.repeat(count));
  });
});

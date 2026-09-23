import { describe, expect, it } from 'vitest';
import { v } from './validators';
import type { ValidationContext } from './types';

const context: ValidationContext = {
  pattern: 'cat',
  flagString: 'g',
  jsFlagString: 'g',
  engine: 'javascript',
  testText: 'cat',
  validation: { valid: true },
  matches: [{ index: 0, match: 'cat', groups: [], start: 0, end: 3 }],
  ast: { id: 'root', type: 'sequence', value: '', raw: 'cat', start: 0, end: 3, children: [] },
  testCases: [],
  testCaseResults: [],
  hasFlag: (flag) => flag === 'g',
};

describe('localized lesson checks', () => {
  it('keeps pass/fail results unchanged when the feedback language changes', () => {
    const checks = [
      v.patternEquals('cat'),
      v.patternEquals('dog'),
      v.matchesAtLeast(1),
      v.matchesAtLeast(2),
      v.matchesExactly(1),
      v.matchesExactly(0),
      v.matchedValuesAre(['cat']),
      v.matchedValuesAre(['dog']),
      v.flagEnabled('g'),
      v.flagDisabled('g'),
      v.engineIs('pcre2'),
      v.allTestCasesPass(),
    ];
    for (const locale of ['en', 'zh', 'ja'] as const) {
      expect(checks.map((check) => check({ ...context, locale }).pass)).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        false,
        false,
      ]);
    }
  });
  it('binds feedback to the explicit locale without changing regex literals', () => {
    const result = v.patternEquals('dog')({ ...context, locale: 'ja' });
    expect(result.checks[0].label).toBe('パターンが `dog` と一致');
    expect(result.checks[0].detail).toBe('現在: `cat`');
    expect(v.matchesExactly(1)({ ...context, locale: 'ja' }).checks[0].detail).toBe(
      '1 件見つかりました',
    );
    expect(v.patternEquals('dog')({ ...context, locale: 'zh' }).checks[0].label).toBe(
      '表达式为 `dog`',
    );
  });
});

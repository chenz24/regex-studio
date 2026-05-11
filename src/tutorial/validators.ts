import type { RegexEngine } from '@/types/engineTypes';
import type { ValidationCheck, ValidationResult, Validator } from './types';

function ok(label: string, detail?: string): ValidationCheck {
  return { label, pass: true, detail };
}

function fail(label: string, detail?: string): ValidationCheck {
  return { label, pass: false, detail };
}

function singleCheck(check: ValidationCheck, feedback?: string): ValidationResult {
  return { pass: check.pass, checks: [check], feedback };
}

/** Combine multiple validators into one with all checks listed. */
function all(...validators: Validator[]): Validator {
  return (ctx) => {
    const checks: ValidationCheck[] = [];
    let feedback: string | undefined;
    for (const v of validators) {
      const r = v(ctx);
      checks.push(...r.checks);
      if (!r.pass && r.feedback && !feedback) feedback = r.feedback;
    }
    return { pass: checks.every((c) => c.pass), checks, feedback };
  };
}

/** Pass if any validator passes; surface the first set of checks. */
function any(...validators: Validator[]): Validator {
  return (ctx) => {
    const all: ValidationResult[] = validators.map((v) => v(ctx));
    const passing = all.find((r) => r.pass);
    if (passing) return passing;
    // Return the first attempt's checks for guidance.
    return all[0] ?? { pass: false, checks: [] };
  };
}

const patternEquals = (expected: string): Validator => (ctx) =>
  singleCheck(
    ctx.pattern === expected
      ? ok(`Pattern equals \`${expected}\``)
      : fail(`Pattern equals \`${expected}\``, `Current: \`${ctx.pattern || '(empty)'}\``),
  );

const patternNonEmpty = (): Validator => (ctx) =>
  singleCheck(
    ctx.pattern.length > 0 ? ok('Pattern is non-empty') : fail('Pattern is non-empty'),
  );

const patternIsValid = (): Validator => (ctx) =>
  singleCheck(
    ctx.validation.valid
      ? ok('Pattern is syntactically valid')
      : fail('Pattern is syntactically valid', ctx.validation.error),
  );

const matchesAtLeast = (n: number): Validator => (ctx) => {
  const c = ctx.matches.length;
  return singleCheck(
    c >= n
      ? ok(`At least ${n} match${n === 1 ? '' : 'es'}`, `Found ${c}`)
      : fail(`At least ${n} match${n === 1 ? '' : 'es'}`, `Found ${c}`),
  );
};

const matchesExactly = (n: number): Validator => (ctx) => {
  const c = ctx.matches.length;
  return singleCheck(
    c === n
      ? ok(`Exactly ${n} match${n === 1 ? '' : 'es'}`, `Found ${c}`)
      : fail(`Exactly ${n} match${n === 1 ? '' : 'es'}`, `Found ${c}`),
  );
};

/** All matched substrings (order-insensitive) must equal the expected set. */
const matchedValuesAre = (expected: string[]): Validator => (ctx) => {
  const got = ctx.matches.map((m) => m.match).sort();
  const exp = [...expected].sort();
  const equal = got.length === exp.length && got.every((v, i) => v === exp[i]);
  const label = `Matches are exactly: ${expected.map((e) => `"${e}"`).join(', ')}`;
  return singleCheck(
    equal
      ? ok(label)
      : fail(label, `Got: ${got.map((g) => `"${g}"`).join(', ') || '(none)'}`),
  );
};

const flagEnabled = (key: string): Validator => (ctx) =>
  singleCheck(
    ctx.hasFlag(key)
      ? ok(`Flag \`${key}\` is enabled`)
      : fail(`Flag \`${key}\` is enabled`),
  );

const flagDisabled = (key: string): Validator => (ctx) =>
  singleCheck(
    !ctx.hasFlag(key)
      ? ok(`Flag \`${key}\` is disabled`)
      : fail(`Flag \`${key}\` is disabled`),
  );

const engineIs = (engine: RegexEngine): Validator => (ctx) =>
  singleCheck(
    ctx.engine === engine
      ? ok(`Engine is \`${engine}\``)
      : fail(`Engine is \`${engine}\``, `Current: \`${ctx.engine}\``),
  );

const allTestCasesPass = (): Validator => (ctx) => {
  if (ctx.testCases.length === 0) {
    return singleCheck(fail('All test cases pass', 'No test cases defined'));
  }
  const passing = ctx.testCaseResults.filter((r) => r.pass).length;
  const total = ctx.testCases.length;
  return singleCheck(
    passing === total
      ? ok(`All test cases pass (${passing}/${total})`)
      : fail(`All test cases pass`, `${passing}/${total} passing`),
  );
};

/** Always passes — useful for "informational" steps that just need user click-through. */
const always = (): Validator => () => ({ pass: true, checks: [] });

export const v = {
  all,
  any,
  patternEquals,
  patternNonEmpty,
  patternIsValid,
  matchesAtLeast,
  matchesExactly,
  matchedValuesAre,
  flagEnabled,
  flagDisabled,
  engineIs,
  allTestCasesPass,
  always,
};

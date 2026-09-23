import type { RegexEngine } from '@/types/engineTypes';
import type { ValidationCheck, ValidationContext, ValidationResult, Validator } from './types';
import { m } from '@/paraglide/messages';
import { baseLocale } from '@/paraglide/runtime';

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

const options = (ctx: ValidationContext) => ({ locale: ctx.locale ?? baseLocale });

const patternEquals =
  (expected: string): Validator =>
  (ctx) =>
    singleCheck({
      label: m.tut_check_pattern({ expected }, options(ctx)),
      pass: ctx.pattern === expected,
      detail:
        ctx.pattern === expected
          ? undefined
          : m.tut_check_current(
              {
                value: ctx.pattern || m.tut_check_empty({}, options(ctx)),
              },
              options(ctx),
            ),
    });

const patternNonEmpty = (): Validator => (ctx) =>
  singleCheck({
    label: m.tut_check_nonempty({}, options(ctx)),
    pass: ctx.pattern.length > 0,
  });

const patternIsValid = (): Validator => (ctx) =>
  singleCheck({
    label: m.tut_check_valid({}, options(ctx)),
    pass: ctx.validation.valid,
    detail: ctx.validation.valid ? undefined : ctx.validation.error,
  });

const matchesAtLeast =
  (count: number): Validator =>
  (ctx) =>
    singleCheck({
      label: m.tut_check_at_least({ count }, options(ctx)),
      pass: ctx.matches.length >= count,
      detail: m.tut_check_found({ count: ctx.matches.length }, options(ctx)),
    });

const matchesExactly =
  (count: number): Validator =>
  (ctx) =>
    singleCheck({
      label: m.tut_check_exactly({ count }, options(ctx)),
      pass: ctx.matches.length === count,
      detail: m.tut_check_found({ count: ctx.matches.length }, options(ctx)),
    });

/** All matched substrings (order-insensitive) must equal the expected set. */
const matchedValuesAre =
  (expected: string[]): Validator =>
  (ctx) => {
    const got = ctx.matches.map((match) => match.match).sort();
    const exp = [...expected].sort();
    const pass = got.length === exp.length && got.every((value, index) => value === exp[index]);
    return singleCheck({
      label: m.tut_check_values(
        { values: expected.map((value) => `"${value}"`).join(', ') },
        options(ctx),
      ),
      pass,
      detail: pass
        ? undefined
        : m.tut_check_got(
            {
              values:
                got.map((value) => `"${value}"`).join(', ') || m.tut_check_none({}, options(ctx)),
            },
            options(ctx),
          ),
    });
  };

const flagEnabled =
  (flag: string): Validator =>
  (ctx) =>
    singleCheck({
      label: m.tut_check_flag_enabled({ flag }, options(ctx)),
      pass: ctx.hasFlag(flag),
    });

const flagDisabled =
  (flag: string): Validator =>
  (ctx) =>
    singleCheck({
      label: m.tut_check_flag_disabled({ flag }, options(ctx)),
      pass: !ctx.hasFlag(flag),
    });

const engineIs =
  (engine: RegexEngine): Validator =>
  (ctx) =>
    singleCheck({
      label: m.tut_check_engine({ engine }, options(ctx)),
      pass: ctx.engine === engine,
      detail:
        ctx.engine === engine
          ? undefined
          : m.tut_check_current({ value: ctx.engine }, options(ctx)),
    });

const allTestCasesPass = (): Validator => (ctx) => {
  const passed = ctx.testCaseResults.filter((result) => result.pass).length;
  const total = ctx.testCases.length;
  return singleCheck({
    label: m.tut_check_cases({}, options(ctx)),
    pass: total > 0 && passed === total,
    detail:
      total === 0
        ? m.tut_check_no_cases({}, options(ctx))
        : m.tut_check_case_progress({ passed, total }, options(ctx)),
  });
};

/** Always passes — useful for "informational" steps that just need user click-through. */
const always = (): Validator => () => ({ pass: true, checks: [] });

/** Verify the documented complete matches and captures, not only a hit count. */
const matchedResultsAre =
  (expected: Array<{ text: string; groups: string[] }>): Validator =>
  (ctx) => {
    const values = matchedValuesAre(expected.map((item) => item.text))(ctx);
    const capturesMatch =
      ctx.matches.length === expected.length &&
      ctx.matches.every(
        (match, i) =>
          match.match === expected[i].text &&
          JSON.stringify(match.groups.map((group) => group.value)) ===
            JSON.stringify(expected[i].groups),
      );
    return {
      pass: values.pass && capturesMatch,
      checks: [
        ...values.checks,
        {
          label:
            m.reading_whole_match({}, options(ctx)) +
            ' / ' +
            m.reading_group({ number: '1…' }, options(ctx)),
          pass: capturesMatch,
        },
      ],
    };
  };

export const v = {
  all,
  any,
  patternEquals,
  patternNonEmpty,
  patternIsValid,
  matchesAtLeast,
  matchesExactly,
  matchedValuesAre,
  matchedResultsAre,
  flagEnabled,
  flagDisabled,
  engineIs,
  allTestCasesPass,
  always,
};

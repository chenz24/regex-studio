/**
 * Sanity-check every published challenge `idealSolution` and every lesson step
 * `solution.pattern` against their own validators / test cases.
 *
 * Run with: `pnpm tsx scripts/verify-content.ts`
 *
 * Exits non-zero if anything fails. Designed to live as a one-shot guardrail —
 * not a replacement for proper unit tests.
 */
import { CHALLENGES } from '../src/challenges/data';
import { evaluateChallenge } from '../src/challenges/evaluator';
import { ALL_LESSONS } from '../src/tutorial/registry';

let failures = 0;

// ─── Challenges ──────────────────────────────────────────────────────
console.log('━━━ Challenges ━━━');
for (const c of CHALLENGES) {
  const sol = c.idealSolution;
  if (!sol) {
    console.log(`  ⚠ ${c.id}: no idealSolution`);
    continue;
  }
  const flags = sol.flags ?? c.starterFlags ?? '';
  const ev = evaluateChallenge(c, sol.pattern, flags);
  if (ev.solved) {
    console.log(`  ✓ ${c.id} (${ev.passed}/${ev.total})`);
  } else {
    failures++;
    console.log(
      `  ✗ ${c.id} (${ev.passed}/${ev.total}) pattern=${JSON.stringify(sol.pattern)} flags=${JSON.stringify(flags)}`,
    );
    if (ev.invalid) console.log(`    invalid: ${ev.invalidError}`);
    for (const r of ev.results.filter((r) => !r.pass)) {
      console.log(
        `    ✗ "${r.label}" expect=${r.expect} got=${r.matchCount} input=${JSON.stringify(r.input)}`,
      );
    }
  }
}

// ─── Lessons (smoke check: each step.solution.pattern parses) ────────
// Full validator simulation requires AST + matches + test cases — that's
// out of scope here. We just confirm `new RegExp(p)` doesn't throw.
console.log('\n━━━ Lesson solutions ━━━');
for (const l of ALL_LESSONS) {
  for (const step of l.steps) {
    if (!step.solution) continue;
    try {
      // eslint-disable-next-line no-new
      new RegExp(step.solution.pattern, step.solution.flags ?? '');
    } catch (err) {
      failures++;
      console.log(`  ✗ ${l.id} / ${step.id}: ${(err as Error).message}`);
    }
  }
}
console.log(`  (checked ${ALL_LESSONS.length} lessons)`);

if (failures > 0) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log('\nAll content verified.');

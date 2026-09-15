/**
 * Compile and run the generated snippets, and check they behave like the
 * pattern does in JavaScript.
 *
 * Run with: `pnpm verify:codegen`
 *
 * The unit tests cover the escaping by reading the pattern back out of the
 * generated source; this goes the rest of the way and hands the code to the
 * real compiler. Languages whose toolchain is not installed are skipped, so
 * what it can check depends on the machine — it is a guardrail to run when
 * touching the generators, not part of `pnpm test`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCode } from '../src/utils/codegen/index';
import type { CodeGenLanguage, CodeGenOperation } from '../src/utils/codegen/types';

interface Case {
  name: string;
  pattern: string;
  text: string;
  flags?: string;
  replace?: string;
}

/** Characters that have to survive two layers of escaping to work at all. */
const MATCH_CASES: Case[] = [
  { name: 'slash', pattern: 'https://(\\w+)', text: 'visit https://example' },
  { name: 'escaped-slash', pattern: 'https:\\/\\/(\\w+)', text: 'visit https://example' },
  { name: 'double-quote', pattern: '"([^"]*)"', text: 'say "hi"' },
  { name: 'single-quote', pattern: "'([^']*)'", text: "say 'hi'" },
  { name: 'braces', pattern: '\\d{3}-\\d{4}', text: 'call 555-1234' },
  { name: 'backslash', pattern: 'a\\\\b', text: 'a\\b here' },
  { name: 'hash-brace', pattern: '#\\{(\\w+)\\}', text: 'a #{name} b' },
  { name: 'hash-interp', pattern: '#{2}', text: 'a ## b' },
  { name: 'dollar', pattern: '\\$(\\d+)', text: 'cost $42' },
  { name: 'dollar-word', pattern: '\\$name', text: 'cost $name' },
  { name: 'backtick', pattern: '`([a-z]+)`', text: 'use `code` here' },
  { name: 'anchors', pattern: '^[\\w.]+@[\\w.]+$', text: 'a.b@c.d' },
  { name: 'multiline', pattern: '^two$', text: 'one "x"\ntwo\nthree#{z}\\end', flags: 'm' },
  { name: 'no-match', pattern: 'zzz(\\d)', text: 'nothing here' },
];

const REPLACE_CASES: Case[] = [
  { name: 'groups', pattern: '(\\w+)@(\\w+)', text: 'bob@host', replace: '$2 at $1' },
  { name: 'delete', pattern: 'a', text: 'banana', replace: '' },
  { name: 'literal-dollar', pattern: '(\\d+)', text: 'cost 42', replace: '$$$1' },
  { name: 'quotes', pattern: '(\\w+)', text: 'hi', replace: '"$1"' },
  { name: 'whole-match', pattern: '\\d+', text: 'a 42 b', replace: '[$&]' },
  { name: 'named', pattern: '(?<num>\\d+)', text: 'a 42 b', replace: '<$<num>>' },
  { name: 'digit-after-ref', pattern: '(\\d)', text: 'x5y', replace: '$10' },
  { name: 'hash', pattern: '(\\w+)', text: 'hi', replace: '#{$1}' },
];

interface Runner {
  language: CodeGenLanguage;
  /** Command that must exist for this language to be checked. */
  probe: string;
  file: string;
  run: (dir: string) => string;
}

const exec = (cmd: string, args: string[], cwd: string) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const RUNNERS: Runner[] = [
  {
    language: 'javascript',
    probe: 'node',
    file: 'main.mjs',
    run: (dir) => exec('node', ['main.mjs'], dir),
  },
  {
    language: 'python',
    probe: 'python3',
    file: 'main.py',
    run: (dir) => exec('python3', ['main.py'], dir),
  },
  {
    language: 'ruby',
    probe: 'ruby',
    file: 'main.rb',
    run: (dir) => exec('ruby', ['main.rb'], dir),
  },
  {
    language: 'java',
    probe: 'java',
    file: 'RegexDemo.java',
    run: (dir) => exec('java', ['RegexDemo.java'], dir),
  },
  {
    language: 'swift',
    probe: 'swift',
    file: 'main.swift',
    run: (dir) => exec('swift', ['main.swift'], dir),
  },
];

function available(command: string): boolean {
  try {
    execFileSync('command', ['-v', command], { shell: '/bin/sh', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** What the generated program prints, as JavaScript would have it. */
function expected(c: Case): string {
  const re = new RegExp(c.pattern, c.flags ? `${c.flags}g` : 'g');
  if (c.replace === undefined) return String(new RegExp(c.pattern, c.flags ?? '').test(c.text));
  return c.text.replace(re, c.replace);
}

function actual(output: string): string | null {
  const line = output
    .split('\n')
    .find((l) => /^(Match|Result|Replaced):/.test(l))
    ?.replace(/^\w+:\s*/, '');
  return line === undefined
    ? null
    : line.trim().toLowerCase() === 'true'
      ? 'true'
      : line.trim().toLowerCase() === 'false'
        ? 'false'
        : line;
}

const root = mkdtempSync(join(tmpdir(), 'regexstudio-codegen-'));
let failures = 0;
let checked = 0;
const skipped: string[] = [];

for (const runner of RUNNERS) {
  if (!available(runner.probe)) {
    skipped.push(`${runner.language} (no \`${runner.probe}\`)`);
    continue;
  }

  const results: string[] = [];
  for (const c of [...MATCH_CASES, ...REPLACE_CASES]) {
    const operation: CodeGenOperation = c.replace === undefined ? 'test' : 'replace';
    const { code } = generateCode({
      pattern: c.pattern,
      flags: c.flags ? `${c.flags}g` : 'g',
      testText: c.text,
      replaceText: c.replace ?? '',
      operation,
      language: runner.language,
    });

    const dir = join(root, runner.language, c.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, runner.file), code);

    checked++;
    const want = expected(c);
    let got: string | null;
    try {
      got = actual(runner.run(dir));
    } catch (error) {
      failures++;
      results.push(`  ✗ ${c.name}: did not run — ${String(error).split('\n')[0]}`);
      continue;
    }

    if (got === want) results.push(`  ✓ ${c.name}`);
    else {
      failures++;
      results.push(`  ✗ ${c.name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    }
  }

  console.log(`${runner.language}`);
  for (const line of results) console.log(line);
}

rmSync(root, { recursive: true, force: true });

if (skipped.length > 0) console.log(`\nskipped: ${skipped.join(', ')}`);
console.log(`\n${checked - failures}/${checked} generated programs behaved like JavaScript`);

if (failures > 0) process.exit(1);

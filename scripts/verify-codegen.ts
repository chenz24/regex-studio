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
  operation?: CodeGenOperation;
  languages?: CodeGenLanguage[];
}

/** Characters that have to survive two layers of escaping to work at all. */
const MATCH_CASES: Case[] = [
  { name: 'nul-input', pattern: 'b', text: 'a\0b', languages: ['javascript', 'python'] },
  { name: 'nul-pattern', pattern: 'a\0b', text: 'a\0b', languages: ['javascript', 'python'] },
  {
    name: 'pattern-line-separator',
    pattern: 'a\u2028b',
    text: 'a\u2028b',
    languages: ['javascript'],
  },
  {
    name: 'pattern-paragraph-separator',
    pattern: 'a\u2029b',
    text: 'a\u2029b',
    languages: ['javascript'],
  },
  { name: 'long-input', pattern: 'Z$', text: `${'a'.repeat(199)}😀${'b'.repeat(200)}Z` },
  { name: 'preserved-crlf', pattern: 'a\\r\\nb', text: 'a\r\nb' },
  { name: 'preserved-cr', pattern: 'a\\rb', text: 'a\rb' },
  { name: 'multiline-delimiters', pattern: 'Z$', text: `a\nTEXT\n""""#\\\n  Z` },
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
  { name: 'literal-group-in-class', pattern: '[(?<x>)]', text: 'P' },
  { name: 'literal-named-reference', pattern: String.raw`\\k<name>`, text: String.raw`\k<name>` },
];

const REPLACE_CASES: Case[] = [
  ...['', 'g'].flatMap((flags): Case[] => [
    { name: `prefix-${flags || 'first'}`, pattern: 'a', text: 'aba', replace: '$`', flags },
    { name: `suffix-${flags || 'first'}`, pattern: 'a', text: 'aba', replace: "$'", flags },
    {
      name: `context-capture-${flags || 'first'}`,
      pattern: '(a)',
      text: 'aba',
      replace: "$`|$&|$1|$'",
      flags,
    },
    {
      name: `context-named-${flags || 'first'}`,
      pattern: '(?<x>a)',
      text: 'aba',
      replace: "$`<$<x>>$'",
      flags,
    },
    {
      name: `context-unset-${flags || 'first'}`,
      pattern: '(a)?b',
      text: 'bb',
      replace: "$`<$1>$'",
      flags,
    },
    {
      name: `context-empty-${flags || 'first'}`,
      pattern: '(?=a)',
      text: 'aaa',
      replace: "$`/$'",
      flags,
    },
    {
      name: `context-absent-${flags || 'first'}`,
      pattern: 'z',
      text: 'aba',
      replace: "$`/$'",
      flags,
    },
    {
      name: `context-escape-${flags || 'first'}`,
      pattern: 'a',
      text: 'aba',
      replace: "$$`-$$'-$$$`-$$$'",
      flags,
    },
    {
      name: `context-backslash-${flags || 'first'}`,
      pattern: 'a',
      text: 'aba',
      replace: "$`\\$'",
      flags,
    },
  ]),
  ...['', 'g'].flatMap((flags): Case[] => [
    { name: `scope-${flags || 'first'}`, pattern: 'a', text: 'aaa', replace: 'X', flags },
    { name: `empty-${flags || 'first'}`, pattern: 'a', text: 'banana', replace: '', flags },
    { name: `capture-${flags || 'first'}`, pattern: '(a)', text: 'aba', replace: '<$1>', flags },
    { name: `absent-${flags || 'first'}`, pattern: 'z', text: 'aaa', replace: 'X', flags },
    { name: `zero-width-${flags || 'first'}`, pattern: '^', text: 'aaa', replace: 'X', flags },
    {
      name: `context-${flags || 'first'}`,
      pattern: '(?<=a)(b)(?=c)',
      text: 'abcabc',
      replace: '<$1>',
      flags,
    },
  ]),
  { name: 'replacement-newlines', pattern: 'b', text: 'a\r\nb', replace: 'X\r\nY\r' },
  { name: 'long-replacement', pattern: 'a', text: 'aaa', flags: '', replace: 'x'.repeat(240) },
  { name: 'groups', pattern: '(\\w+)@(\\w+)', text: 'bob@host', replace: '$2 at $1' },
  { name: 'delete', pattern: 'a', text: 'banana', replace: '' },
  { name: 'literal-dollar', pattern: '(\\d+)', text: 'cost 42', replace: '$$$1' },
  { name: 'quotes', pattern: '(\\w+)', text: 'hi', replace: '"$1"' },
  { name: 'whole-match', pattern: '\\d+', text: 'a 42 b', replace: '[$&]' },
  { name: 'named', pattern: '(?<num>\\d+)', text: 'a 42 b', replace: '<$<num>>' },
  { name: 'digit-after-ref', pattern: '(\\d)', text: 'x5y', replace: '$10' },
  { name: 'hash', pattern: '(\\w+)', text: 'hi', replace: '#{$1}' },
  { name: 'unknown-number', pattern: '(a)', text: 'a', replace: '$2' },
  { name: 'zero-number', pattern: '(a)', text: 'a', replace: '$0' },
  { name: 'leading-zero', pattern: '(a)', text: 'a', replace: '$01' },
  { name: 'name-without-groups', pattern: 'a', text: 'a', replace: '$<name>' },
  { name: 'unknown-name', pattern: '(?<name>a)', text: 'a', replace: '$<other>' },
  { name: 'literal-path', pattern: 'a', text: 'a', replace: String.raw`C:\users\tmp` },
  { name: 'literal-backreference', pattern: '(a)', text: 'a', replace: String.raw`\1` },
  { name: 'backslash-then-reference', pattern: '(a)', text: 'a', replace: String.raw`\$1` },
  { name: 'plain-dollar', pattern: 'a', text: 'a', replace: '$price' },
];

const SPLIT_CASES: Case[] = [
  ...[
    [',', 'a,'],
    ['(,)', 'a,b,'],
    ['(,)|(x)', 'a,b'],
    [',', ',a,,'],
    [',', ''],
    ['(?:)', ''],
    ['(?:)', 'ab'],
    ['a*', 'aba'],
    ['(?=b)', 'ab'],
    ['^', 'abc'],
    ['$', 'abc'],
    ['z', 'abc'],
    ['(a)', 'a'],
  ].map(
    ([pattern, text], index): Case => ({
      name: `split-${index}`,
      pattern,
      text,
      operation: 'split',
      languages: ['javascript', 'java', 'ruby'],
    }),
  ),
];

const OTHER_CASES: Case[] = ['match', 'matchAll', 'capture'].map((operation) => ({
  name: `operation-${operation}`,
  operation: operation as CodeGenOperation,
  pattern: '(a)',
  text: 'aba',
}));

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
    // Keep compiler output inside this verification run's writable temp tree.
    run: (dir) =>
      exec('swift', ['-module-cache-path', join(root, 'swift-modules'), 'main.swift'], dir),
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
  const re = new RegExp(c.pattern, c.flags ?? 'g');
  if (c.operation === 'split') return JSON.stringify(c.text.split(re).map(String));
  if (c.replace === undefined) return String(new RegExp(c.pattern, c.flags ?? '').test(c.text));
  return c.text.replace(re, c.replace);
}

function actual(output: string, c: Case): string | null {
  if (c.operation === 'split') {
    return JSON.stringify([...output.matchAll(/^\[\d+\] "(.*)"$/gm)].map((match) => match[1]));
  }
  if (c.operation === 'match' || c.operation === 'matchAll' || c.operation === 'capture') {
    // These smoke cases match; running the whole snippet catches syntax errors
    // in the operation-specific output templates too.
    return output.includes('"a"') || output.includes('Found: a') ? 'true' : 'false';
  }
  const match = /^(Match|Result|Replaced): ?/m.exec(output);
  if (!match) return null;
  const value = output.slice(match.index + match[0].length).replace(/\n$/, '');
  return match[1] === 'Match' ? value.trim().toLowerCase() : value;
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
  for (const c of [...MATCH_CASES, ...REPLACE_CASES, ...SPLIT_CASES, ...OTHER_CASES]) {
    if (c.languages && !c.languages.includes(runner.language)) continue;
    const operation: CodeGenOperation =
      c.operation ?? (c.replace === undefined ? 'test' : 'replace');
    const { code } = generateCode({
      pattern: c.pattern,
      flags: c.flags ?? 'g',
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
      got = actual(runner.run(dir), c);
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

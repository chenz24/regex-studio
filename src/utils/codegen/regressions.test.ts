import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generateCode } from './index';
import type { CodeGenContext, CodeGenLanguage, CodeGenOperation } from './types';

const defaults: CodeGenContext = {
  language: 'javascript',
  pattern: 'Z$',
  flags: '',
  testText: '',
  replaceText: '',
  operation: 'test',
};

function run(input: Partial<CodeGenContext>) {
  const { code } = generateCode({ ...defaults, ...input });
  const executable =
    input.language === 'typescript'
      ? ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
      : code;
  const output: unknown[][] = [];
  runInNewContext(executable, { console: { log: (...args: unknown[]) => output.push(args) } });
  return output;
}

describe.each(['javascript', 'typescript'] as const)('generated %s data integrity', (language) => {
  it.each(['\n', '\r', '\u2028', '\u2029'])('escapes pattern line terminator %j', (separator) => {
    for (const pattern of [`a${separator}b`, `a\\${separator}b`, `[${separator}/]`]) {
      const testText = `a${separator}b`;
      expect(run({ language, pattern, testText })).toEqual([
        ['Match:', new RegExp(pattern).test(testText)],
      ]);
    }
  });
  it('matches the full input beyond the old cutoff, including a split surrogate pair', () => {
    const testText = `${'a'.repeat(199)}😀${'b'.repeat(200)}Z`;
    expect(run({ language, testText })).toEqual([['Match:', true]]);
  });

  it.each([
    '\r',
    '\r\n',
    '\n',
    '\u2028',
    '\u2029',
    '\0',
    '\t',
    '\ud800',
  ])('preserves %j in text and replacement', (separator) => {
    const testText = `a${separator}'"\\\`\${text}b`;
    const replaceText = `<${separator}'"\\\`\${result}$&>`;
    expect(run({ language, pattern: 'b', testText })).toEqual([['Match:', true]]);
    expect(run({ language, pattern: 'b', testText, replaceText, operation: 'replace' })).toEqual([
      ['Result:', testText.replace(/b/, replaceText)],
    ]);
  });

  it.each<CodeGenOperation>([
    'test',
    'match',
    'matchAll',
    'capture',
    'replace',
    'split',
  ])('preserves declaration-like user input during %s', (operation) => {
    const text =
      'const text = const replacement = const isMatch = const match = const matches = const result = const parts =';
    const input = { pattern: text, testText: text.repeat(2), replaceText: text, operation };
    expect(run({ ...input, language })).toEqual(run({ ...input, language: 'javascript' }));
    expect(run({ ...input, language, operation: 'test' })).toEqual([['Match:', true]]);
  });
});

it('keeps the Rust matchAll format string syntactically closed', () => {
  const { code } = generateCode({
    ...defaults,
    language: 'rust',
    pattern: 'a',
    testText: 'a',
    operation: 'matchAll',
  });
  const line = code.split('\n').find((line) => line.includes('m.as_str()'))!;
  // Parse the quoted format string and require the remaining arguments to be outside it.
  expect(line).toMatch(/^\s*println!\("(?:[^"\\]|\\.)*", i, m\.as_str\(\), m\.start\(\)\);$/);
});

// The compiler verification script executes the available target toolchains.
// These checks keep the first/global API choice covered when a compiler is absent.
it.each<[CodeGenLanguage, string, string]>([
  ['java', 'matcher.replaceFirst(replacement)', 'matcher.replaceAll(replacement)'],
  ['kotlin', 'pattern.replaceFirst(text, replacement)', 'pattern.replace(text, replacement)'],
  ['rust', 'pattern.replace(text, replacement)', 'pattern.replace_all(text, replacement)'],
  ['dotnet', 'pattern.Replace(text, replacement, 1)', 'pattern.Replace(text, replacement)'],
  [
    'php',
    'preg_replace($pattern, $replacement, $text, 1)',
    'preg_replace($pattern, $replacement, $text)',
  ],
  ['go', 'pattern.FindStringSubmatchIndex(text)', 'pattern.ReplaceAllString(text, replacement)'],
  [
    'swift',
    'pattern.firstMatch(in: text, range: range)',
    'pattern.stringByReplacingMatches(in: text, range: range, withTemplate: replacement)',
  ],
])('%s selects the requested replacement scope', (language, first, all) => {
  for (const flags of ['', 'g']) {
    const { code } = generateCode({
      ...defaults,
      language,
      flags,
      pattern: '(a)',
      testText: 'aaa',
      replaceText: '$1X',
      operation: 'replace',
    });
    expect(code).toContain(flags ? all : first);
    expect(code).not.toContain(flags ? first : all);
  }
});

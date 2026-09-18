import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { generateCode } from './index';
import type { CodeGenContext } from './types';

// Run the generated programs when the target interpreter is installed.
// CI without it reports skips; it must not silently claim runtime coverage.
const runtimes = [
  { language: 'python', command: 'python3', option: '-c' },
  { language: 'ruby', command: 'ruby', option: '-e' },
] as const;

for (const runtime of runtimes) {
  const available = spawnSync(runtime.command, ['--version']).status === 0;
  describe.skipIf(!available)(`generated ${runtime.language} runtime behavior`, () => {
    const run = (input: Omit<CodeGenContext, 'language'>) => {
      const result = generateCode({ ...input, language: runtime.language });
      return execFileSync(runtime.command, [runtime.option, result.code], {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
    };

    if (runtime.language === 'ruby') {
      it.each([
        ['(?s:a.b)', '', 'a\nb', true],
        ['(?-s:a.b)', 's', 'a\nb', false],
        ['(?m:^b$)', '', 'a\rb\nc', true],
        ['(?-m:^b$)', 'm', 'a\nb\nc', false],
        ['(?s:a.b).c', '', 'a\rb\rc', false],
        ['(?m:^b$)|^c$', '', 'a\rc', false],
        ['(?s:a(?-s:.).b)', '', 'aX\nb', true],
        ['(?s:a(?-s:.).b)', '', 'a\n\nb', false],
        ['(?im-s:^a.b$)', 's', 'x\rA B\nz', true],
        ['(?i:a)(?-i:b)', '', 'Ab', true],
        ['(?i:a)(?-i:b)', '', 'AB', false],
        ['(?m:.)', '', '\n', false],
        ['(?-m:.)', 's', '\n', true],
        ['[(?s:).]+', '', '(?s:).', true],
        [String.raw`\(\?s:a\.b\)`, '', '(?s:a.b)', true],
      ] as const)('preserves scoped flags in /%s/%s on %j', (pattern, flags, text, expected) => {
        expect(run({ pattern, flags, testText: text, replaceText: '', operation: 'test' })).toBe(
          `Match: ${expected}`,
        );
      });
    }

    it.each(['', 'g'])('preserves contextual replacements with flags "%s"', (flags) => {
      for (const [pattern, text, replacement] of [
        ['a', 'ba', '$`'],
        ['a', 'ab', "$'"],
        ['(a)', 'aba', "$`|$&|$1|$'"],
        ['(?<x>a)', 'aba', "$`<$<x>>$'"],
        ['(a)?b', 'bb', "$`<$1>$'"],
        ['(?=a)', 'aaa', "$`/$'"],
        ['z', 'aba', "$`/$'"],
        ['a', 'aba', "$$`-$$'-$$$`-$$$'"],
        ['a', 'aba', "$`\\$'"],
      ]) {
        expect(
          run({ pattern, flags, testText: text, replaceText: replacement, operation: 'replace' }),
        ).toBe(`Result: ${text.replace(new RegExp(pattern, flags), replacement)}`);
      }
    });

    if (runtime.language === 'python') {
      it.each([
        ['(?=a)|a', 'a'],
        ['a*?', 'ab'],
        ['a*', 'aba'],
        ['(?:)|a', 'aa'],
        ['(?=(a))|a', 'aba'],
        ['a|$', 'a'],
        ['(?:)', ''],
        ['z', 'abc'],
      ])('advances once after empty global matches for /%s/ on %j', (pattern, text) => {
        const native = [...text.matchAll(new RegExp(pattern, 'g'))];
        const input = { pattern, flags: 'g', testText: text, replaceText: '' };
        const all = run({ ...input, operation: 'matchAll' });
        expect(
          [...all.matchAll(/^\[\d+\] "(.*)" at index (\d+)$/gm)].map((m) => [m[1], Number(m[2])]),
        ).toEqual(native.map((m) => [m[0], m.index]));
        const captures = run({ ...input, operation: 'capture' });
        expect([...captures.matchAll(/^Match \d+: "(.*)"$/gm)].map((m) => m[1])).toEqual(
          native.map((m) => m[0]),
        );
        for (const flags of ['', 'g']) {
          for (const replacement of ['X', '', '<$&>', "$`/$'"]) {
            expect(run({ ...input, flags, replaceText: replacement, operation: 'replace' })).toBe(
              `Result: ${text.replace(new RegExp(pattern, flags), replacement)}`.trim(),
            );
          }
        }
      });

      it('expands numbered and named captures in replacements after empty matches', () => {
        for (const replacement of ['$1', '<$<x>>', "$`<$1>$'"]) {
          const pattern = '(?<x>a*?)';
          expect(
            run({
              pattern,
              flags: 'g',
              testText: 'ab',
              replaceText: replacement,
              operation: 'replace',
            }),
          ).toBe(`Result: ${'ab'.replace(new RegExp(pattern, 'g'), replacement)}`);
        }
      });

      it('preserves NUL in patterns, input and replacements without writing NUL into source', () => {
        expect(
          run({ pattern: 'a\0b', flags: '', testText: 'a\0b', replaceText: '', operation: 'test' }),
        ).toBe('Match: True');
        expect(
          run({
            pattern: 'b',
            flags: '',
            testText: 'a\0b',
            replaceText: '\0X',
            operation: 'replace',
          }),
        ).toBe('Result: a\0\0X');
      });
    }

    it.each(['', 'g'])('preserves replacement scope with flags "%s"', (flags) => {
      for (const [pattern, text, replacement] of [
        ['a', 'aaa', 'X'],
        ['a', 'banana', ''],
        ['(a)', 'aba', '<$1>'],
        ['z', 'aaa', 'X'],
        ['(?=a)', 'aaa', 'X'],
      ]) {
        const expected = text.replace(new RegExp(pattern, flags), replacement);
        expect(
          run({ pattern, flags, testText: text, replaceText: replacement, operation: 'replace' }),
        ).toBe(`Result: ${expected}`);
      }
    });

    if (runtime.language === 'ruby' || runtime.language === 'python') {
      it.each([
        '',
        'm',
        's',
        'ms',
        'ims',
      ])('preserves dot and anchor rules with flags "%s"', (flags) => {
        for (const newline of ['\n', '\r', '\r\n', '\u2028', '\u2029']) {
          for (const [pattern, text] of [
            ['a.b', `a${newline}b`],
            ['^b', `a${newline}b`],
            ['a$', `a${newline}b`],
            ['a$', `a${newline}`],
          ]) {
            const expected = new RegExp(pattern, flags).test(text);
            expect(
              run({ pattern, flags, testText: text, replaceText: '', operation: 'test' }),
              JSON.stringify({ pattern, flags, text }),
            ).toBe(
              `Match: ${runtime.language === 'python' ? (expected ? 'True' : 'False') : expected}`,
            );
          }
        }
      });

      it('does not rewrite literal anchors or dots', () => {
        for (const pattern of [String.raw`\^\$\.`, '[^a][$.]', '[.^$]+']) {
          const text = '^$.';
          expect(
            run({ pattern, flags: '', testText: text, replaceText: '', operation: 'test' }),
          ).toBe(
            `Match: ${runtime.language === 'python' ? (new RegExp(pattern).test(text) ? 'True' : 'False') : new RegExp(pattern).test(text)}`,
          );
        }
      });
    }

    if (runtime.language === 'python') {
      it('preserves scoped dotAll and multiline overrides through nesting', () => {
        for (const [pattern, flags, text, expected] of [
          ['(?s:a.b)', '', 'a\rb', true],
          ['(?-s:a.b)', 's', 'a\rb', false],
          ['(?m:^b$)', '', 'a\rb\nc', true],
          ['(?-m:^b$)', 'm', 'a\nb\nc', false],
          ['(?s:a.b).c', '', 'a\rb\rc', false],
          ['(?m:^b$)|^c$', '', 'a\rc', false],
        ] as const) {
          expect(run({ pattern, flags, testText: text, replaceText: '', operation: 'test' })).toBe(
            `Match: ${expected ? 'True' : 'False'}`,
          );
        }
      });

      it.each([
        [String.raw`\b`, 'ab cd'],
        ['(?=a)', 'a'],
        ['(?=a)|a', 'ab'],
        ['a*?', 'ab'],
        ['a*', 'aba'],
        ['(,)', 'a,b,'],
        ['(,)|(x)', 'a,b'],
        [',', ',a,,'],
        ['^', 'abc'],
        ['$', 'abc'],
        ['(?:)', 'ab'],
        ['(?:)', ''],
        [',', ''],
        ['(?<=a)', 'abc'],
        ['(a)', 'a'],
      ])('preserves JS split behavior for /%s/ on %j', (pattern, text) => {
        const output = run({
          pattern,
          flags: '',
          testText: text,
          replaceText: '',
          operation: 'split',
        });
        const parts = [...output.matchAll(/^\[\d+\] "(.*)"$/gm)].map((match) => match[1]);
        expect(parts).toEqual(text.split(new RegExp(pattern)).map(String));
      });
    }
  });
}

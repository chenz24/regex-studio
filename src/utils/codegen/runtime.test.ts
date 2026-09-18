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

    if (runtime.language === 'ruby') {
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
            ).toBe(`Match: ${expected}`);
          }
        }
      });

      it('does not rewrite literal anchors or dots', () => {
        for (const pattern of [String.raw`\^\$\.`, '[^a][$.]', '[.^$]+']) {
          const text = '^$.';
          expect(
            run({ pattern, flags: '', testText: text, replaceText: '', operation: 'test' }),
          ).toBe(`Match: ${new RegExp(pattern).test(text)}`);
        }
      });
    }
  });
}

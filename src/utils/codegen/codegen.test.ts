import { describe, expect, it } from 'vitest';
import { generateCode } from './index';
import { escapePattern, pythonStringLiteral } from './escaper';
import type { CodeGenContext, CodeGenLanguage, CodeGenOperation } from './types';

function gen(overrides: Partial<CodeGenContext> & { language: CodeGenLanguage }): string {
  return generateCode({
    pattern: '(\\w+)\\s(\\w+)',
    flags: 'g',
    testText: 'foo bar',
    replaceText: '',
    operation: 'match' as CodeGenOperation,
    ...overrides,
  }).code;
}

describe('escapePattern', () => {
  it('escapes the delimiters of a regex literal', () => {
    expect(escapePattern('https://x', 'javascript')).toBe('https:\\/\\/x');
    expect(escapePattern('https://x', 'ruby')).toBe('https:\\/\\/x');
  });

  it('leaves slashes that are already escaped alone', () => {
    // A blanket replace produced `https:\\/\\/`, which closes the literal
    // early and makes the generated code a syntax error.
    expect(escapePattern('https:\\/\\/x', 'javascript')).toBe('https:\\/\\/x');
  });

  it('does not treat the character after a backslash as a delimiter', () => {
    expect(escapePattern('a\\\\/b', 'javascript')).toBe('a\\\\\\/b');
  });
});

describe('generated JavaScript', () => {
  const compiles = (code: string) => {
    // Compiles without running: proves the snippet is syntactically valid.
    new Function(code);
    return true;
  };

  it.each<CodeGenOperation>(['test', 'match', 'matchAll', 'replace', 'split'])(
    'is valid syntax for operation %s',
    (operation) => {
      expect(compiles(gen({ language: 'javascript', operation, replaceText: '$2 $1' }))).toBe(true);
    },
  );

  it('is valid syntax for a pattern containing escaped slashes', () => {
    const code = gen({ language: 'javascript', pattern: 'https:\\/\\/(\\w+)' });
    expect(code).toContain('/https:\\/\\/(\\w+)/');
    expect(compiles(code)).toBe(true);
  });

  it('is valid syntax for a pattern containing bare slashes', () => {
    expect(compiles(gen({ language: 'javascript', pattern: 'https://(\\w+)' }))).toBe(true);
  });
});

describe('pythonStringLiteral', () => {
  it('prefers a raw string', () => {
    expect(pythonStringLiteral('\\d+')).toBe("r'\\d+'");
  });

  it('switches quote style rather than escaping inside a raw string', () => {
    expect(pythonStringLiteral("it's")).toBe('r"it\'s"');
  });

  it('falls back to an escaped string when a raw one cannot express the value', () => {
    // A raw string may not end in an odd run of backslashes, and cannot hold
    // both quote styles or a newline.
    expect(pythonStringLiteral('a\\')).toBe("'a\\\\'");
    expect(pythonStringLiteral('a\\\\')).toBe("r'a\\\\'");
    expect(pythonStringLiteral(`'"`)).toBe("'\\'\"'");
    expect(pythonStringLiteral('a\nb')).toBe("'a\\nb'");
  });
});

describe('generated Python', () => {
  it('emits the pattern as a raw string', () => {
    expect(gen({ language: 'python' })).toContain("re.compile(r'(\\w+)\\s(\\w+)'");
  });

  it('emits group references in the replacement as a raw string', () => {
    // `'\1'` in a normal literal is the control character U+0001, not a
    // group reference.
    const code = gen({ language: 'python', operation: 'replace', replaceText: '$2 $1' });
    expect(code).toContain("replacement = r'\\2 \\1'");
  });

  it('translates named and whole-match references', () => {
    const code = gen({
      language: 'python',
      operation: 'replace',
      pattern: '(?<a>x)',
      replaceText: '$<a>-$&',
    });
    expect(code).toContain("replacement = r'\\g<a>-\\g<0>'");
  });
});

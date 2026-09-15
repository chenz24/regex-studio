import { describe, expect, it } from 'vitest';
import { generateCode } from './index';
import { escapePattern, escapeReplacement, pythonStringLiteral } from './escaper';
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

  it.each<CodeGenOperation>([
    'test',
    'match',
    'matchAll',
    'replace',
    'split',
  ])('is valid syntax for operation %s', (operation) => {
    expect(compiles(gen({ language: 'javascript', operation, replaceText: '$2 $1' }))).toBe(true);
  });

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
    // `\g<2>` rather than `\2`, which would swallow a following digit.
    expect(code).toContain("replacement = r'\\g<2> \\g<1>'");
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

describe('escapeReplacement', () => {
  const render = (repl: string, lang: CodeGenLanguage, pattern = '(\\w+)') =>
    escapeReplacement(repl, lang, pattern);

  it.each<[CodeGenLanguage, string]>([
    ['javascript', "'$$'"],
    ['python', "r'$'"],
    ['ruby', '"$"'],
    ['java', '"\\\\$"'],
    ['kotlin', '"\\\\\\$"'],
    ['go', '"$$"'],
    ['rust', '"$$"'],
    ['dotnet', '@"$$"'],
    ['php', "'\\\\$'"],
    ['swift', '"\\\\$"'],
  ])('writes a literal dollar the way %s spells it', (lang, expected) => {
    // `$$` is JavaScript's escape for one dollar. Left untranslated it either
    // doubled in the output or, in Java, threw "Illegal group ref".
    expect(render('$$', lang)).toBe(expected);
  });

  it.each<[CodeGenLanguage, string]>([
    ['python', "r'\\g<0>'"],
    ['ruby', '"\\\\0"'],
    ['java', '"$0"'],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Go's reference syntax
    ['go', '"${0}"'],
  ])('writes the whole match the way %s spells it', (lang, expected) => {
    expect(render('$&', lang)).toBe(expected);
  });

  it('reads the reference before the literal dollar that precedes it', () => {
    // `$$$1` is a dollar followed by group 1 — one left-to-right pass, not
    // two independent replaces.
    expect(render('$$$1', 'python')).toBe("r'$\\g<1>'");
    expect(render('$$$1', 'java')).toBe('"\\\\$$1"');
  });

  it('resolves a named reference for engines that only have numbers', () => {
    const pattern = '(?<first>\\w+)@(?<second>\\w+)';
    expect(render('$<second>', 'swift', pattern)).toBe('"$2"');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: PHP's reference syntax
    expect(render('$<second>', 'php', pattern)).toBe("'${2}'");
    // Engines with named templates keep the name.
    expect(render('$<second>', 'python', pattern)).toBe("r'\\g<second>'");
  });

  it('reads $10 as group 1 when the pattern has fewer than ten groups', () => {
    expect(render('$10', 'java', '(\\d)')).toBe('"$10"');
    expect(render('$10', 'python', '(\\d)')).toBe("r'\\g<1>0'");
  });

  it('escapes a hash in a Ruby replacement', () => {
    // Double-quoted, so `#{...}` would interpolate.
    expect(render('#{$1}', 'ruby')).toBe('"\\#{\\\\1}"');
  });
});

describe('python named groups', () => {
  it.each([
    String.raw`\\k<name>`,
    '[(?<x>)]',
    String.raw`[\\](?<x>a)\\k<x>`,
  ])('does not rewrite literal syntax inside %s', (pattern) => {
    const expected =
      pattern === String.raw`[\\](?<x>a)\\k<x>` ? String.raw`[\\](?P<x>a)\\k<x>` : pattern;
    expect(escapePattern(pattern, 'python')).toBe(expected);
  });
  it('translates the named-group syntax Python does not accept', () => {
    const code = gen({ language: 'python', pattern: '(?<year>\\d{4})-\\k<year>' });
    expect(code).toContain("re.compile(r'(?P<year>\\d{4})-(?P=year)'");
  });

  it('leaves lookbehind alone', () => {
    expect(gen({ language: 'python', pattern: '(?<=a)b' })).toContain("re.compile(r'(?<=a)b'");
  });
});

describe('replacement literals and nonexistent references', () => {
  it('keeps native prefix and suffix references for JavaScript and .NET', () => {
    const replacement = "$`-$'";
    expect(escapeReplacement(replacement, 'javascript', 'a')).toBe("'$`-$\\''");
    expect(escapeReplacement(replacement, 'dotnet', 'a')).toBe('@"$`-$\'"');
  });

  it('counts Python-style named captures when rendering replacement references', () => {
    expect(escapeReplacement('$1-$<name>', 'python', '(?P<name>a)')).toBe("r'\\g<1>-\\g<name>'");
  });
  it.each([
    '$0',
    '$00',
    '$2',
    '$99',
    '$<missing>',
  ])('preserves literal %s without the corresponding capture', (replacement) => {
    expect(escapeReplacement(replacement, 'python', '(a)')).toBe(`r'${replacement}'`);
    expect(escapeReplacement(replacement, 'javascript', '(a)')).toBe(`'${replacement}'`);
  });

  it('substitutes unknown names with empty text only when named captures exist', () => {
    expect(escapeReplacement('$<missing>-$<a>', 'python', '(?<a>x)')).toBe("r'-\\g<a>'");
  });

  it('recognizes leading-zero numbered references and their following literal digits', () => {
    expect(escapeReplacement('$01-$10', 'python', '(a)')).toBe("r'\\g<1>-\\g<1>0'");
  });

  it.each([
    String.raw`C:\users`,
    String.raw`C:\tmp`,
    String.raw`\1`,
    String.raw`\$1`,
  ])('escapes literal backslashes without escaping generated references: %s', (replacement) => {
    const expected =
      replacement === String.raw`\$1` ? String.raw`\\\g<1>` : replacement.replace(/\\/g, '\\\\');
    expect(escapeReplacement(replacement, 'python', '(a)')).toBe(`r'${expected}'`);
  });
});

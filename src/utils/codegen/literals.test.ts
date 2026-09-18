import { describe, expect, it } from 'vitest';
import { generateCode } from './index';
import { escapeTestString } from './escaper';
import type { CodeGenLanguage } from './types';

/**
 * Go, Rust, C#, PHP and Kotlin have no toolchain here, so instead of running
 * the generated programs we read the pattern back out of them.
 *
 * Each reader implements that language's *string literal* rules — which is
 * exactly the layer every escaping bug lives in — and the pattern it decodes
 * has to be the pattern the user typed. That catches a literal that ends
 * early, an escape that survives into the regex, and an interpolation that
 * quietly rewrites it.
 */

interface Literal {
  value: string;
  end: number;
}

/** `"…"` with the usual backslash escapes. `extra` maps language-specific ones. */
function readQuoted(
  src: string,
  start: number,
  extra: Record<string, string> = {},
  allowMultiline = false,
): Literal {
  const basic: Record<string, string> = {
    '\\': '\\',
    '"': '"',
    n: '\n',
    t: '\t',
    r: '\r',
    ...extra,
  };
  let value = '';
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (!allowMultiline && (ch === '\n' || ch === '\r'))
      throw new Error('newline in quoted string');
    if (ch === '\\') {
      const next = src[i + 1];
      if (!(next in basic)) throw new Error(`unknown escape \\${next}`);
      value += basic[next];
      i += 2;
      continue;
    }
    if (ch === '"') return { value, end: i + 1 };
    value += ch;
    i++;
  }
  throw new Error('unterminated string literal');
}

const readers: Record<string, (src: string, start: number) => Literal> = {
  javascript: readDelimited,
  ruby: readDelimited,
  python: readPython,
  java: (src, start) => readQuoted(src, start),
  swift: (src, start) => readQuoted(src, start),

  // Raw string, or an interpreted one with the usual escapes.
  go(src, start) {
    if (src[start] === '`') {
      const close = src.indexOf('`', start + 1);
      if (close === -1) throw new Error('unterminated raw string');
      return { value: src.slice(start + 1, close).replace(/\r/g, ''), end: close + 1 };
    }
    return readQuoted(src, start);
  },

  // `r#"…"#` keeps everything literal; otherwise the usual escapes.
  rust(src, start) {
    if (src.startsWith('r#"', start)) {
      const close = src.indexOf('"#', start + 3);
      if (close === -1) throw new Error('unterminated raw string');
      return { value: src.slice(start + 3, close).replace(/\r\n/g, '\n'), end: close + 2 };
    }
    return readQuoted(src, start, {}, true);
  },

  // `@"…"` is verbatim: backslashes are literal and `""` is one quote.
  dotnet(src, start) {
    if (!src.startsWith('@"', start)) return readQuoted(src, start);
    let value = '';
    let i = start + 2;
    while (i < src.length) {
      if (src[i] === '"') {
        if (src[i + 1] === '"') {
          value += '"';
          i += 2;
          continue;
        }
        return { value, end: i + 1 };
      }
      value += src[i];
      i++;
    }
    throw new Error('unterminated verbatim string');
  },

  // Single quotes: only `\\` and `\'` are escapes, every other backslash is
  // a literal backslash.
  php(src, start) {
    let value = '';
    let i = start + 1;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\\' && (src[i + 1] === '\\' || src[i + 1] === "'")) {
        value += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === "'") return { value, end: i + 1 };
      value += ch;
      i++;
    }
    throw new Error('unterminated string literal');
  },

  // Like Java, plus `\$`. A `$` that arrives unescaped and is followed by a
  // name or `{` is a string template, which silently rewrites the pattern —
  // or fails to compile.
  kotlin(src, start) {
    let value = '';
    let i = start + 1;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\n' || ch === '\r') throw new Error('newline in quoted string');
      if (ch === '\\') {
        const next = src[i + 1];
        const escapes: Record<string, string> = {
          '\\': '\\',
          '"': '"',
          $: '$',
          n: '\n',
          t: '\t',
          r: '\r',
        };
        if (!(next in escapes)) throw new Error(`unknown escape \\${next}`);
        value += escapes[next];
        i += 2;
        continue;
      }
      if (ch === '$' && /[A-Za-z_{]/.test(src[i + 1] ?? '')) {
        throw new Error('unescaped `$` starts a string template');
      }
      if (ch === '"') return { value, end: i + 1 };
      value += ch;
      i++;
    }
    throw new Error('unterminated string literal');
  },
};

// ── The languages that do have a toolchain here ─────────────────────────
// Verified for real by compiling and running the generated programs; these
// readers keep that coverage in CI, where the toolchains are absent.

/** `/…/flags` — a regex literal, not a string. */
function readDelimited(src: string, start: number): Literal {
  let value = '';
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      value += ch + (src[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (ch === '/') return { value, end: i + 1 };
    value += ch;
    i++;
  }
  throw new Error('unterminated regex literal');
}

/** `r'…'` / `r"…"` keep their content; a plain string applies escapes. */
function readPython(src: string, start: number): Literal {
  if (src[start] === 'r') {
    const quote = src[start + 1];
    const close = src.indexOf(quote, start + 2);
    if (close === -1) throw new Error('unterminated raw string');
    return { value: src.slice(start + 2, close), end: close + 1 };
  }
  let value = '';
  let i = start + 1;
  const escapes: Record<string, string> = { '\\': '\\', "'": "'", n: '\n', t: '\t', r: '\r' };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      if (!(next in escapes)) throw new Error(`unknown escape \\${next}`);
      value += escapes[next];
      i += 2;
      continue;
    }
    if (ch === "'") return { value, end: i + 1 };
    value += ch;
    i++;
  }
  throw new Error('unterminated string literal');
}

/** Pull the pattern literal out of a generated program. */
const MARKERS: Record<string, string> = {
  javascript: 'const pattern = ',
  python: 're.compile(',
  java: 'Pattern.compile(',
  swift: 'NSRegularExpression(pattern: ',
  ruby: 'pattern = ',
  go: 'regexp.MustCompile(',
  rust: 'Regex::new(',
  dotnet: 'new Regex(',
  php: '$pattern = ',
  kotlin: 'Regex(',
};

function readPattern(language: string, code: string): string {
  const marker = MARKERS[language];
  const at = code.indexOf(marker);
  expect(at, `${language}: no pattern in the generated code`).toBeGreaterThanOrEqual(0);
  return readers[language](code, at + marker.length).value;
}

function generate(language: CodeGenLanguage, pattern: string, flags = '') {
  return generateCode({
    pattern,
    flags,
    testText: 'sample',
    replaceText: '',
    operation: 'test',
    language,
  }).code;
}

const PATTERNS: Array<[name: string, pattern: string]> = [
  ['plain', '\\d{3}-\\d{4}'],
  ['bare slash', 'https://(\\w+)'],
  ['escaped slash', 'https:\\/\\/(\\w+)'],
  ['double quote', '"([^"]*)"'],
  ['single quote', "'([^']*)'"],
  ['backslash', 'a\\\\b'],
  ['backtick', '`([a-z]+)`'],
  ['dollar', '\\$(\\d+)'],
  ['dollar before a name', '\\$name'],
  ['hash brace', '#\\{(\\w+)\\}'],
  ['rust raw-string terminator', 'a"#b'],
  ['trailing backslash class', '[\\\\]'],
];

describe.each([
  'go',
  'rust',
  'dotnet',
  'kotlin',
  'php',
  'java',
  'swift',
  'python',
] as const)('%s exported input', (language) => {
  it('preserves long text, line endings, indentation and literal delimiters', () => {
    const text = `${'a'.repeat(199)}😀\r\n  b\r\nTEXT\n""""#\`'\\\t$word`;
    const encoded = escapeTestString(text, language);
    const decoded = readers[language](encoded, 0);
    expect(decoded).toEqual({ value: text, end: encoded.length });
  });
});

describe.each(['go', 'rust', 'dotnet', 'kotlin'] as const)('generated %s', (language) => {
  it.each(PATTERNS)('embeds the pattern unchanged: %s', (_name, pattern) => {
    expect(readPattern(language, generate(language, pattern))).toBe(pattern);
  });

  it('keeps the inline flag prefix in front of the pattern', () => {
    const decoded = readPattern(language, generate(language, 'abc', 'i'));
    expect(decoded.endsWith('abc')).toBe(true);
  });
});

describe.each(['java', 'swift'] as const)('generated %s', (language) => {
  it.each(PATTERNS)('embeds the pattern unchanged: %s', (_name, pattern) => {
    expect(readPattern(language, generate(language, pattern))).toBe(pattern);
  });
});

describe.each([
  'java',
  'swift',
  'kotlin',
  'go',
  'rust',
] as const)('multiline %s patterns', (language) => {
  it.each([
    '\n',
    '\r',
    '\r\n',
    '\t',
    '\u2028',
    '\u2029',
  ])('preserves %j inside a valid string literal', (separator) => {
    // Include raw-string delimiters to exercise the Go/Rust quoted fallback.
    for (const pattern of [`a\`"#${separator}b\\d`, `a${separator}b\\d`]) {
      expect(readPattern(language, generate(language, pattern))).toBe(pattern);
    }
  });
});

describe('generated python', () => {
  it.each(PATTERNS)('embeds the pattern unchanged: %s', (_name, pattern) => {
    expect(readPattern('python', generate('python', pattern))).toBe(pattern);
  });
});

describe.each(['javascript', 'ruby'] as const)('generated %s', (language) => {
  it.each(PATTERNS)('escapes only what the literal needs: %s', (_name, pattern) => {
    const body = readPattern(language, generate(language, pattern));

    // Nothing may end the literal early, and in Ruby nothing may start an
    // interpolation: `/#{2}/` is the pattern `2`.
    const hazards = language === 'ruby' ? /[/#]/ : /\//;
    const unescaped = body
      .replace(/\\./g, '')
      .split('')
      .some((ch) => hazards.test(ch));
    expect(unescaped, `unescaped delimiter in ${body}`).toBe(false);

    const normalise = (v: string) => v.replace(/\\([/#])/g, '$1');
    expect(normalise(body)).toBe(normalise(pattern));
  });
});

describe('generated php', () => {
  it.each(PATTERNS)('embeds the pattern with only the delimiter escaped: %s', (_name, pattern) => {
    const decoded = readPattern('php', generate('php', pattern));

    // The literal is `/…/flags`; strip the delimiters PHP's preg_* expects.
    expect(decoded.startsWith('/')).toBe(true);
    const close = decoded.lastIndexOf('/');
    const body = decoded.slice(1, close);

    // Nothing inside may close the pattern early.
    const unescapedSlash = /(?:^|[^\\])(?:\\\\)*\/(?!$)/.test(body);
    expect(unescapedSlash, `unescaped delimiter in ${body}`).toBe(false);

    // Dropping the delimiter escaping gives back exactly what was typed.
    expect(body.replace(/\\\//g, '/')).toBe(pattern.replace(/\\\//g, '/'));
  });
});

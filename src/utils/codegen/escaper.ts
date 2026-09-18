import { collectGroupNames } from '../regexMatcher';
import type { CodeGenLanguage } from './types';

/**
 * Backslash-escape every *unescaped* occurrence of `chars` in a regex.
 *
 * Only unescaped ones may be touched: a blanket replace turns the already
 * valid `https:\/\/` into `https:\\/\\/`, which ends the literal early and
 * makes the generated code a syntax error.
 */
export function escapeUnescaped(pattern: string, chars: string): string {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      // Copy the escape sequence through untouched.
      out += ch + (pattern[i + 1] ?? '');
      i++;
      continue;
    }
    out += chars.includes(ch) ? `\\${ch}` : ch;
  }
  return out;
}

/** A constructor accepts line terminators that cannot appear in a /literal/. */
function escapeJsPattern(pattern: string): string {
  const breaks: Record<string, string> = {
    '\n': '\\n',
    '\r': '\\r',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  };
  let result = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      const next = pattern[++i] ?? '';
      result += breaks[next] ?? `\\${next}`;
    } else {
      result += breaks[ch] ?? (ch === '/' ? '\\/' : ch);
    }
  }
  return result;
}

/** Translate actual named constructs, leaving escaped text and classes intact. */
function pythonPattern(pattern: string): string {
  let out = '';
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') {
      const ref = !inClass && /^\\k<([^>]+)>/.exec(pattern.slice(i));
      if (ref) {
        out += `(?P=${ref[1]})`;
        i += ref[0].length - 1;
      } else {
        out += pattern[i] + (pattern[++i] ?? '');
      }
    } else if (inClass) {
      out += pattern[i];
      if (pattern[i] === ']') inClass = false;
    } else if (pattern[i] === '[') {
      inClass = true;
      out += '[';
    } else {
      const group = /^\(\?<([^=!][^>]*)>/.exec(pattern.slice(i));
      if (group) {
        out += `(?P<${group[1]}>`;
        i += group[0].length - 1;
      } else {
        out += pattern[i];
      }
    }
  }
  return out;
}

/**
 * Python string literal for `value`.
 *
 * Prefers a raw string — idiomatic for patterns, and required for
 * replacements, where `'\1'` would be read as the control character U+0001
 * instead of a group reference. Falls back to a normal escaped string for
 * the values a raw string cannot express: those containing both quote
 * styles or a newline, or ending in an odd run of backslashes.
 */
export function pythonStringLiteral(value: string): string {
  const unrawable =
    value.includes('\0') || /[\n\r]/.test(value) || /(?:^|[^\\])(?:\\\\)*\\$/.test(value);
  if (!unrawable) {
    if (!value.includes("'")) return `r'${value}'`;
    if (!value.includes('"')) return `r"${value}"`;
  }
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .split('\0')
    .join('\\x00')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `'${escaped}'`;
}

/** Body of an ordinary double-quoted string (not a regex literal). */
function escapeDoubleQuoted(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

/**
 * Escape a regex pattern for use in different languages
 */
export function escapePattern(pattern: string, lang: CodeGenLanguage): string {
  switch (lang) {
    case 'javascript':
    case 'typescript':
      return escapeJsPattern(pattern);

    case 'python':
      // Python's `re` only knows Python's spelling of named groups, so
      // `(?<year>…)` and `\k<year>` have to be translated or the generated
      // code raises at compile time. Callers wrap the result with
      // pythonStringLiteral().
      return pythonPattern(pattern);

    case 'java':
      return escapeDoubleQuoted(pattern);

    case 'kotlin':
      // Same, plus `$`: Kotlin reads `$name` in a string as a template, so an
      // unescaped dollar either changes the pattern or fails to compile.
      return escapeDoubleQuoted(pattern).replace(/\$/g, '\\$');

    case 'go':
      // For raw string `...`, backticks cannot be escaped, fall back to regular string
      if (/[`\r]/.test(pattern)) {
        return escapeDoubleQuoted(pattern);
      }
      return pattern; // Raw string, no escaping needed

    case 'dotnet':
      // C# verbatim string @"...", double quotes need to be doubled
      return pattern.replace(/"/g, '""');

    case 'rust':
      // For raw string r#"..."#, no escaping needed unless it contains "#
      if (pattern.includes('"#') || pattern.includes('\r')) {
        return escapeDoubleQuoted(pattern);
      }
      return pattern;

    case 'pcre2':
    case 'php':
      // Two layers, and the order matters: escape the `/` delimiter first,
      // then the PHP single-quoted string. Escaping the delimiter afterwards
      // (as the generator used to) produced `\\\\\\/`, which PHP reads as an
      // escaped backslash followed by the delimiter — ending the pattern
      // early and making PCRE reject the rest as modifiers.
      return escapeUnescaped(pattern, '/').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    case 'ruby':
      // For regex literal /.../, escape the delimiter — and `#`, which would
      // otherwise start an interpolation: `/#{2}/` is the pattern `2`.
      return escapeUnescaped(pattern, '/#');

    case 'swift':
      return escapeDoubleQuoted(pattern);

    default:
      return pattern;
  }
}

/** A JavaScript literal that preserves every UTF-16 code unit and line ending. */
function javascriptStringLiteral(text: string): string {
  const body = JSON.stringify(text)
    .slice(1, -1)
    .replace(/'/g, "\\'")
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `'${body}'`;
}

/** Escape the complete test string for the target language. */
export function escapeTestString(text: string, lang: CodeGenLanguage): string {
  // Never shorten exported data. Raw multiline literals can also normalize
  // CRLF, strip indentation or collide with a delimiter in the user's input.
  const quoted = () => escapeDoubleQuoted(text);
  switch (lang) {
    case 'javascript':
    case 'typescript':
      return javascriptStringLiteral(text);
    case 'python':
      return pythonStringLiteral(text);
    case 'kotlin':
      return `"${quoted().replace(/\$/g, '\\$')}"`;
    case 'ruby':
      return `"${quoted().replace(/#/g, '\\#')}"`;
    case 'pcre2':
    case 'php':
      // PHP permits newlines inside ordinary single-quoted strings.
      return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    default:
      return `"${quoted()}"`;
  }
}

/**
 * One piece of a replacement string, in JavaScript's syntax.
 */
type ReplacementToken =
  | { kind: 'text'; value: string }
  | { kind: 'dollar' }
  | { kind: 'match' }
  | { kind: 'prefix' }
  | { kind: 'suffix' }
  | { kind: 'group'; index: string }
  | { kind: 'named'; name: string };

/**
 * Split a replacement on JavaScript's `$` forms, left to right.
 *
 * Order matters and sequential `String.replace` calls get it wrong: in
 * `$$$1` the leading `$$` is a literal dollar and only the tail is a group
 * reference, but a pass that rewrites `$1` first leaves the `$$` behind for
 * the next pass to mangle.
 */
function tokenizeReplacement(replacement: string, names: Array<string | null>): ReplacementToken[] {
  const groupCount = names.length;
  const hasNamedGroups = names.some((name) => name !== null);
  const tokens: ReplacementToken[] = [];
  let text = '';
  const flush = () => {
    if (text) tokens.push({ kind: 'text', value: text });
    text = '';
  };

  for (let i = 0; i < replacement.length; i++) {
    if (replacement[i] !== '$') {
      text += replacement[i];
      continue;
    }
    const rest = replacement.slice(i + 1);

    if (rest.startsWith('$')) {
      flush();
      tokens.push({ kind: 'dollar' });
      i++;
    } else if (rest.startsWith('&')) {
      flush();
      tokens.push({ kind: 'match' });
      i++;
    } else if (rest.startsWith('`') || rest.startsWith("'")) {
      flush();
      tokens.push({ kind: rest[0] === '`' ? 'prefix' : 'suffix' });
      i++;
    } else if (hasNamedGroups && /^<[^>]*>/.test(rest)) {
      const name = /^<([^>]*)>/.exec(rest)?.[1] ?? '';
      flush();
      // With named captures, unknown names substitute an empty string. With
      // no named captures at all, `$<name>` is ordinary text in JavaScript.
      if (names.includes(name)) tokens.push({ kind: 'named', name });
      i += name.length + 2;
    } else if (/^\d/.test(rest)) {
      // `$10` is group 10 only if the pattern has one; with fewer groups
      // JavaScript reads it as group 1 followed by a literal `0`.
      const digits = /^\d{1,2}/.exec(rest)?.[0] ?? '';
      const index =
        digits.length === 2 && Number(digits) > groupCount ? digits.slice(0, 1) : digits;
      if (Number(index) > 0 && Number(index) <= groupCount) {
        flush();
        tokens.push({ kind: 'group', index: String(Number(index)) });
        i += index.length;
      } else {
        text += '$';
      }
    } else {
      // Prefix/suffix forms are handled by targets that share this syntax.
      text += '$';
    }
  }

  flush();
  return tokens;
}

/** How a target language spells the same references. */
interface ReplacementDialect {
  text: (value: string) => string;
  dollar: string;
  match: string;
  group: (index: string) => string;
  /** `names` is the pattern's capture groups, for engines without named templates. */
  named: (name: string, names: Array<string | null>) => string;
}

/** `$<name>` as a numbered reference, for engines that only have those. */
function numberedRef(name: string, names: Array<string | null>, wrap: (n: string) => string) {
  const index = names.indexOf(name);
  return index === -1 ? `$<${name}>` : wrap(String(index + 1));
}

const DIALECTS: Record<string, ReplacementDialect> = {
  javascript: {
    text: (v) => v,
    dollar: '$$',
    match: '$&',
    group: (n) => `$${n}`,
    named: (n) => `$<${n}>`,
  },
  // `\g<1>` rather than `\1`, which would swallow a following digit.
  python: {
    text: escapeBackslashes,
    dollar: '$',
    match: '\\g<0>',
    group: (n) => `\\g<${n}>`,
    named: (n) => `\\g<${n}>`,
  },
  ruby: {
    text: escapeBackslashes,
    dollar: '$',
    match: '\\0',
    group: (n) => `\\${n}`,
    named: (n) => `\\k<${n}>`,
  },
  java: {
    text: escapeTemplate,
    dollar: '\\$',
    match: '$0',
    group: (n) => `$${n}`,
    named: (n) => `\${${n}}`,
  },
  // Go and Rust read `$1x` as a group named `1x`, so the braces are required.
  // biome-ignore-start lint/suspicious/noTemplateCurlyInString: the target language's syntax
  go: {
    text: escapeDollars,
    dollar: '$$',
    match: '${0}',
    group: (n) => `\${${n}}`,
    named: (n) => `\${${n}}`,
  },
  rust: {
    text: escapeDollars,
    dollar: '$$',
    match: '${0}',
    group: (n) => `\${${n}}`,
    named: (n) => `\${${n}}`,
  },
  // biome-ignore-end lint/suspicious/noTemplateCurlyInString: the target language's syntax
  dotnet: {
    // .NET shares JavaScript's prefix and suffix substitutions.
    text: (value) => value.replace(/\$(?![`'])/g, () => '$$'),
    dollar: '$$',
    match: '$0',
    group: (n) => `\${${n}}`,
    named: (n) => `\${${n}}`,
  },
  // preg_replace and NSRegularExpression templates are numbered only, so a
  // named reference has to be resolved against the pattern.
  php: {
    text: escapeTemplate,
    dollar: '\\$',
    match: '$0',
    group: (n) => `\${${n}}`,
    named: (n, names) => numberedRef(n, names, (i) => `\${${i}}`),
  },
  swift: {
    text: escapeTemplate,
    dollar: '\\$',
    match: '$0',
    group: (n) => `$${n}`,
    named: (n, names) => numberedRef(n, names, (i) => `$${i}`),
  },
};

function escapeBackslashes(value: string): string {
  return value.replace(/\\/g, '\\\\');
}

function escapeDollars(value: string): string {
  return value.replace(/\$/g, () => '$$');
}

function escapeTemplate(value: string): string {
  return escapeBackslashes(value).replace(/\$/g, '\\$');
}

function dialectFor(lang: CodeGenLanguage): ReplacementDialect {
  if (lang === 'typescript') return DIALECTS.javascript;
  if (lang === 'kotlin') return DIALECTS.java;
  if (lang === 'pcre2') return DIALECTS.php;
  return DIALECTS[lang] ?? DIALECTS.javascript;
}

/** Rewrite a replacement into the target language's template syntax. */
function renderReplacement(
  replacement: string,
  lang: CodeGenLanguage,
  names: Array<string | null>,
): string {
  // Preserve all native JavaScript forms, including prefix/suffix references.
  if (lang === 'javascript' || lang === 'typescript') return replacement;
  const dialect = dialectFor(lang);
  return tokenizeReplacement(replacement, names)
    .map((token) => {
      if (token.kind === 'text') return dialect.text(token.value);
      if (token.kind === 'dollar') return dialect.dollar;
      if (token.kind === 'match') return dialect.match;
      if (token.kind === 'prefix' || token.kind === 'suffix') {
        const symbol = token.kind === 'prefix' ? '`' : "'";
        return lang === 'ruby' ? `\\${symbol}` : dialect.text(`$${symbol}`);
      }
      if (token.kind === 'group') return dialect.group(token.index);
      return dialect.named(token.name, names);
    })
    .join('');
}

/** Emit a callback expression when the template needs the original match context. */
export function contextReplacement(
  replacement: string,
  lang: CodeGenLanguage,
  pattern: string,
  context: { capture: (index: number) => string; prefix: string; suffix: string },
): string | null {
  const names = collectGroupNames(pattern);
  const tokens = tokenizeReplacement(replacement, names);
  if (!tokens.some((token) => token.kind === 'prefix' || token.kind === 'suffix')) return null;
  const pieces = tokens.map((token) => {
    if (token.kind === 'prefix') return context.prefix;
    if (token.kind === 'suffix') return context.suffix;
    if (token.kind === 'match') return context.capture(0);
    if (token.kind === 'group') return context.capture(Number(token.index));
    if (token.kind === 'named') return context.capture(names.indexOf(token.name) + 1);
    return escapeTestString(token.kind === 'dollar' ? '$' : token.value, lang);
  });
  return lang === 'rust'
    ? `[${pieces.join(', ')}].concat()`
    : pieces.join(lang === 'php' ? ' . ' : ' + ');
}

/**
 * Rewrite a replacement for the target language and wrap it in a string
 * literal. Two separate layers: the template syntax the regex engine reads,
 * then the source syntax the compiler reads.
 */
export function escapeReplacement(
  replacement: string,
  lang: CodeGenLanguage,
  pattern = '',
): string {
  const template = renderReplacement(replacement, lang, collectGroupNames(pattern));

  if (lang === 'dotnet') return `@"${template.replace(/"/g, '""')}"`;
  return escapeTestString(template, lang);
}

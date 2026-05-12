import type { RegexFlag } from './regex';

export type RegexEngine = 'javascript' | 'python' | 'pcre2' | 'java' | 'go' | 'dotnet' | 'rust';

export interface EngineFlavor {
  id: RegexEngine;
  name: string;
  shortName: string;
  version: string;
  flags: RegexFlag[];
  unsupportedFeatures: UnsupportedFeature[];
  notes: string;
}

// Flags that are safe to forward to JavaScript's RegExp without changing
// semantics in surprising ways across the supported targets.
const JS_SAFE_FLAGS = new Set(['g', 'i', 'm', 's', 'u', 'v', 'y']);

/** Build the flag string actually fed to `new RegExp(...)`. */
export function toJsFlagString(flags: RegexFlag[]): string {
  const seen = new Set<string>();
  let out = '';
  for (const f of flags) {
    if (!f.enabled) continue;
    const key = f.jsFlag;
    if (!key || !JS_SAFE_FLAGS.has(key) || seen.has(key)) continue;
    seen.add(key);
    out += key;
  }
  return out;
}

export interface UnsupportedFeature {
  /** AST node type(s) that trigger this warning */
  nodeTypes: string[];
  /** Human-readable feature name (English fallback) */
  feature: string;
  /** Explanation shown in the warning (English fallback) */
  message: string;
  /** i18n key for `feature` (preferred when present) */
  featureKey?: string;
  /** i18n key for `message` (preferred when present) */
  messageKey?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface CompatibilityWarning {
  feature: string;
  message: string;
  /** i18n keys propagated from the matching UnsupportedFeature rule. */
  featureKey?: string;
  messageKey?: string;
  severity: 'error' | 'warning' | 'info';
  /** The AST node id that triggered this */
  nodeId?: string;
  /** The raw regex fragment */
  raw?: string;
}

// ─── Engine Flavor Definitions ────────────────────────────────────────

/**
 * Flag entry shape used to build per-engine flag tables.
 * `jsFlag` is the character actually forwarded to JavaScript's RegExp;
 * if omitted, the flag is display-only (does not affect matching preview).
 */
interface FlagEntry {
  key: string;
  description: string;
  descKey?: string;
  jsFlag?: string;
  enabled?: boolean;
}

function flags(entries: FlagEntry[]): RegexFlag[] {
  return entries.map((e) => ({
    key: e.key,
    label: e.key,
    description: e.description,
    descKey: e.descKey,
    enabled: e.enabled ?? false,
    jsFlag: e.jsFlag,
  }));
}

// Common JS-mapped flag entries reused across engines.
const F = {
  i: { key: 'i', description: 'Case insensitive', descKey: 'flag_desc_js_i', jsFlag: 'i' as const },
  m: { key: 'm', description: 'Multiline - ^ and $ match line boundaries', descKey: 'flag_desc_js_m', jsFlag: 'm' as const },
  s: { key: 's', description: 'Dotall - . matches newline', descKey: 'flag_desc_js_s', jsFlag: 's' as const },
};

export const ENGINE_FLAVORS: Record<RegexEngine, EngineFlavor> = {
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    shortName: 'JS',
    version: 'ES2024 (V8)',
    flags: flags([
      { key: 'g', description: 'Global - find all matches', descKey: 'flag_desc_js_g', jsFlag: 'g', enabled: true },
      F.i,
      F.m,
      F.s,
      { key: 'u', description: 'Unicode', descKey: 'flag_desc_js_u', jsFlag: 'u' },
      { key: 'd', description: 'hasIndices - generate indices for substring matches', descKey: 'flag_desc_js_d', jsFlag: 'd' },
      { key: 'v', description: 'Unicode sets mode (supersets `u`)', descKey: 'flag_desc_js_v', jsFlag: 'v' },
    ]),
    unsupportedFeatures: [],
    notes: 'Native browser engine. Full support for all modern JavaScript regex features.',
  },

  python: {
    id: 'python',
    name: 'Python',
    shortName: 'PY',
    version: 're (3.12+)',
    // No `g` flag in Python — re.findall / re.finditer iterate by default.
    flags: flags([
      { key: 'i', description: 'IGNORECASE (re.I)', descKey: 'flag_desc_py_i', jsFlag: 'i' },
      { key: 'm', description: 'MULTILINE (re.M)', descKey: 'flag_desc_py_m', jsFlag: 'm' },
      { key: 's', description: 'DOTALL (re.S)', descKey: 'flag_desc_py_s', jsFlag: 's' },
      // Python 3 is Unicode by default; toggle is informational.
      { key: 'u', description: 'UNICODE (re.U) - default in Python 3', descKey: 'flag_desc_py_u' },
      // x is Python-only; cannot forward to JS.
      {
        key: 'x',
        description: 'VERBOSE (re.X) - ignore whitespace and allow comments (display only)',
        descKey: 'flag_desc_py_x',
      },
    ]),
    unsupportedFeatures: [
      {
        nodeTypes: ['lookbehind', 'negativeLookbehind'],
        feature: 'Variable-length lookbehind',
        featureKey: 'compat_python_lookbehind_feature',
        message:
          'Python `re` requires fixed-width lookbehind. Alternations or quantifiers inside `(?<=...)` / `(?<!...)` are rejected. Use the third-party `regex` module if you need variable-length lookbehind.',
        messageKey: 'compat_python_lookbehind_message',
        severity: 'info',
      },
    ],
    notes:
      'Python re module. Lookbehind must be fixed-width; named groups also accept (?P<name>...) syntax.',
  },

  pcre2: {
    id: 'pcre2',
    name: 'PCRE2',
    shortName: 'PCRE2',
    version: '10.x (PHP, Nginx)',
    // PCRE2 modifiers (no `g` — that\'s a host-language concept like PHP\'s preg_match_all).
    flags: flags([
      { key: 'i', description: 'PCRE2_CASELESS', descKey: 'flag_desc_pcre2_i', jsFlag: 'i' },
      { key: 'm', description: 'PCRE2_MULTILINE', descKey: 'flag_desc_pcre2_m', jsFlag: 'm' },
      { key: 's', description: 'PCRE2_DOTALL', descKey: 'flag_desc_pcre2_s', jsFlag: 's' },
      { key: 'u', description: 'PCRE2_UTF / UCP', descKey: 'flag_desc_pcre2_u', jsFlag: 'u' },
      { key: 'x', description: 'PCRE2_EXTENDED - ignore whitespace and # comments (display only)', descKey: 'flag_desc_pcre2_x' },
      { key: 'U', description: 'PCRE2_UNGREEDY - swap greedy/lazy default (display only)', descKey: 'flag_desc_pcre2_U_flag' },
      { key: 'J', description: 'PCRE2_DUPNAMES - allow duplicate named groups (display only)', descKey: 'flag_desc_pcre2_J' },
    ]),
    unsupportedFeatures: [],
    notes:
      'Most feature-rich target. Supports recursion (?R), atomic groups, possessive quantifiers, and \\K resets.',
  },

  java: {
    id: 'java',
    name: 'Java',
    shortName: 'Java',
    version: 'java.util.regex (21+)',
    // Java has no `g`. UNIX_LINES is `(?d)` inline in Java but conflicts with JS `d`,
    // so it is not forwarded to the matching preview.
    flags: flags([
      { key: 'i', description: 'CASE_INSENSITIVE', descKey: 'flag_desc_java_i', jsFlag: 'i' },
      { key: 'm', description: 'MULTILINE', descKey: 'flag_desc_java_m', jsFlag: 'm' },
      { key: 's', description: 'DOTALL', descKey: 'flag_desc_java_s', jsFlag: 's' },
      { key: 'u', description: 'UNICODE_CASE', descKey: 'flag_desc_java_u', jsFlag: 'u' },
      { key: 'x', description: 'COMMENTS - permits whitespace and # comments (display only)', descKey: 'flag_desc_java_x' },
    ]),
    unsupportedFeatures: [
      {
        nodeTypes: ['lookbehind', 'negativeLookbehind'],
        feature: 'Bounded lookbehind',
        featureKey: 'compat_java_lookbehind_feature',
        message:
          'Java requires lookbehind to have a determinable maximum length. Unbounded quantifiers (* or +) inside `(?<=...)` / `(?<!...)` will be rejected.',
        messageKey: 'compat_java_lookbehind_message',
        severity: 'info',
      },
    ],
    notes:
      'Java regex engine. Lookbehind must have a bounded width; supports possessive quantifiers and atomic groups.',
  },

  go: {
    id: 'go',
    name: 'Go',
    shortName: 'Go',
    version: 'regexp (RE2)',
    // Go has no `g` (host-language API). RE2 has very few inline modifiers.
    flags: flags([
      { key: 'i', description: '(?i) - case insensitive', descKey: 'flag_desc_go_i', jsFlag: 'i' },
      { key: 'm', description: '(?m) - multiline', descKey: 'flag_desc_go_m', jsFlag: 'm' },
      { key: 's', description: '(?s) - let . match \\n', descKey: 'flag_desc_go_s', jsFlag: 's' },
      { key: 'U', description: '(?U) - swap greedy/lazy default (display only)', descKey: 'flag_desc_go_U_flag' },
    ]),
    unsupportedFeatures: [
      {
        nodeTypes: ['lookahead', 'negativeLookahead'],
        feature: 'Lookahead',
        featureKey: 'compat_go_lookahead_feature',
        message:
          "Go's regexp package (RE2) does not support lookahead assertions (?=...) or (?!...). Consider restructuring your pattern.",
        messageKey: 'compat_go_lookahead_message',
        severity: 'error',
      },
      {
        nodeTypes: ['lookbehind', 'negativeLookbehind'],
        feature: 'Lookbehind',
        featureKey: 'compat_go_lookbehind_feature',
        message:
          "Go's regexp package (RE2) does not support lookbehind assertions (?<=...) or (?<!...). Consider restructuring your pattern.",
        messageKey: 'compat_go_lookbehind_message',
        severity: 'error',
      },
      {
        nodeTypes: ['backreference'],
        feature: 'Backreference',
        featureKey: 'compat_go_backreference_feature',
        message:
          "Go's regexp package (RE2) does not support backreferences (\\1, \\2, etc.). This is by design for guaranteed linear-time matching.",
        messageKey: 'compat_go_backreference_message',
        severity: 'error',
      },
    ],
    notes:
      'Go uses RE2, which guarantees linear-time matching but does not support lookaround or backreferences.',
  },

  dotnet: {
    id: 'dotnet',
    name: '.NET',
    shortName: '.NET',
    version: 'System.Text.RegularExpressions',
    // .NET has no `g` (Regex.Matches handles iteration).
    flags: flags([
      { key: 'i', description: 'IgnoreCase', descKey: 'flag_desc_dotnet_i', jsFlag: 'i' },
      { key: 'm', description: 'Multiline', descKey: 'flag_desc_dotnet_m', jsFlag: 'm' },
      { key: 's', description: 'Singleline (DOTALL)', descKey: 'flag_desc_dotnet_s', jsFlag: 's' },
      { key: 'x', description: 'IgnorePatternWhitespace (display only)', descKey: 'flag_desc_dotnet_x' },
      { key: 'n', description: 'ExplicitCapture - only named groups capture (display only)', descKey: 'flag_desc_dotnet_n' },
    ]),
    unsupportedFeatures: [],
    notes:
      ".NET regex engine. Supports variable-length lookbehind, balancing groups, and named captures with `(?<name>...)` / `(?'name'...)`.",
  },

  rust: {
    id: 'rust',
    name: 'Rust',
    shortName: 'Rust',
    version: 'regex crate (1.x)',
    // Rust has no `g`.
    flags: flags([
      { key: 'i', description: '(?i) - case insensitive', descKey: 'flag_desc_rust_i', jsFlag: 'i' },
      { key: 'm', description: '(?m) - multiline', descKey: 'flag_desc_rust_m', jsFlag: 'm' },
      { key: 's', description: '(?s) - let . match \\n', descKey: 'flag_desc_rust_s', jsFlag: 's' },
      { key: 'u', description: 'Unicode - enabled by default; (?-u) to disable', descKey: 'flag_desc_rust_u' },
      { key: 'x', description: '(?x) - ignore whitespace and # comments (display only)', descKey: 'flag_desc_rust_x' },
    ]),
    unsupportedFeatures: [
      {
        nodeTypes: ['lookahead', 'negativeLookahead'],
        feature: 'Lookahead',
        featureKey: 'compat_rust_lookahead_feature',
        message:
          "Rust's regex crate does not support lookahead assertions. Consider using the `fancy-regex` crate instead.",
        messageKey: 'compat_rust_lookahead_message',
        severity: 'error',
      },
      {
        nodeTypes: ['lookbehind', 'negativeLookbehind'],
        feature: 'Lookbehind',
        featureKey: 'compat_rust_lookbehind_feature',
        message:
          "Rust's regex crate does not support lookbehind assertions. Consider using the `fancy-regex` crate instead.",
        messageKey: 'compat_rust_lookbehind_message',
        severity: 'error',
      },
      {
        nodeTypes: ['backreference'],
        feature: 'Backreference',
        featureKey: 'compat_rust_backreference_feature',
        message:
          "Rust's regex crate does not support backreferences. Consider using the `fancy-regex` crate instead.",
        messageKey: 'compat_rust_backreference_message',
        severity: 'error',
      },
    ],
    notes:
      'Rust regex crate guarantees linear-time matching. For lookaround/backreferences, use fancy-regex.',
  },
};

export const ENGINE_LIST: RegexEngine[] = [
  'javascript',
  'python',
  'pcre2',
  'java',
  'go',
  'dotnet',
  'rust',
];

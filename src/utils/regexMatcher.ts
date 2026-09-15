import type { MatchInfo, GroupInfo } from '../types/regex';

/**
 * Upper bound on matches collected in a single run. A pathological pattern
 * (or a very large document) can otherwise produce an unbounded list and
 * take the tab down with it — this runs on the main thread during render.
 */
export const MAX_MATCHES = 10_000;

/**
 * Advance past the character at `index`.
 *
 * With the `u`/`v` flags the engine works in code points: bumping
 * `lastIndex` by one lands *inside* a surrogate pair, and the engine snaps
 * back to the start of that code point on the next `exec` — the same empty
 * match is then found forever. Astral characters therefore have to be
 * stepped over as a whole.
 */
/**
 * Whether this engine accepts the `d` (hasIndices) flag — ES2022, so every
 * current browser, but compiling with an unknown flag throws and would take
 * matching down entirely on an older one.
 */
const SUPPORTS_INDICES = (() => {
  try {
    // Must be the constructor: a literal with an unsupported flag is a parse
    // error, which would take the whole module down instead of being caught.
    // biome-ignore lint/complexity/useRegexLiterals: runtime feature detection
    new RegExp('', 'd');
    return true;
  } catch {
    return false;
  }
})();

function advanceIndex(text: string, index: number, unicode: boolean): number {
  if (!unicode) return index + 1;
  const code = text.codePointAt(index);
  if (code === undefined) return index + 1;
  return index + (code > 0xffff ? 2 : 1);
}

export function findMatches(pattern: string, flags: string, text: string): MatchInfo[] {
  if (!pattern) return [];

  try {
    // `d` makes the engine report exact group offsets in `match.indices`.
    const execFlags = SUPPORTS_INDICES && !flags.includes('d') ? `${flags}d` : flags;
    const regex = new RegExp(pattern, execFlags);
    const groupNames = collectGroupNames(pattern);
    const matches: MatchInfo[] = [];
    const unicode = flags.includes('u') || flags.includes('v');
    let match: RegExpExecArray | null;

    if (flags.includes('g')) {
      match = regex.exec(text);
      while (match !== null) {
        matches.push(buildMatchInfo(match, groupNames));
        if (matches.length >= MAX_MATCHES) break;
        // A zero-length match leaves lastIndex where it is; step forward
        // ourselves or `exec` returns the same match indefinitely.
        if (match[0].length === 0) {
          regex.lastIndex = advanceIndex(text, regex.lastIndex, unicode);
          if (regex.lastIndex > text.length) break;
        }
        match = regex.exec(text);
      }
    } else {
      match = regex.exec(text);
      if (match) {
        matches.push(buildMatchInfo(match, groupNames));
      }
    }

    return matches;
  } catch {
    return [];
  }
}

/**
 * Names of the capturing groups in `pattern`, indexed by group number − 1.
 *
 * Group names cannot be recovered from a match result: `match.groups` is
 * keyed by name, and looking a name up by comparing captured *values*
 * mislabels every group that captured the same text. Reading the names off
 * the pattern in source order is exact.
 */
function collectGroupNames(pattern: string): Array<string | null> {
  const names: Array<string | null> = [];
  let inClass = false;

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      i++; // skip the escaped character
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      continue;
    }
    if (ch !== '(') continue;

    if (pattern[i + 1] !== '?') {
      names.push(null); // plain capturing group
      continue;
    }
    // `(?<name>` is a named group; `(?<=` / `(?<!` are lookbehinds, and
    // every other `(?…` form is non-capturing.
    if (pattern[i + 2] !== '<' || pattern[i + 3] === '=' || pattern[i + 3] === '!') continue;
    const close = pattern.indexOf('>', i + 3);
    if (close === -1) continue;
    names.push(pattern.slice(i + 3, close));
  }

  return names;
}

function buildMatchInfo(match: RegExpExecArray, groupNames: Array<string | null>): MatchInfo {
  const groups: GroupInfo[] = [];
  // Present whenever the regex was compiled with the `d` flag, which
  // `findMatches` always adds.
  const indices = match.indices;

  for (let i = 1; i < match.length; i++) {
    const span = indices?.[i];
    groups.push({
      name: groupNames[i - 1] ?? null,
      index: i,
      value: match[i],
      start: span ? span[0] : -1,
      end: span ? span[1] : -1,
    });
  }

  return {
    index: match.index,
    match: match[0],
    groups,
    start: match.index,
    end: match.index + match[0].length,
  };
}

export function replaceMatches(
  pattern: string,
  flags: string,
  text: string,
  replacement: string,
): string {
  if (!pattern || !text) return text;

  try {
    const regex = new RegExp(pattern, flags);
    return text.replace(regex, replacement);
  } catch {
    return text;
  }
}

export function isValidRegex(pattern: string, flags: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

import type { MatchInfo, GroupInfo } from '../types/regex';
import { decodeGroupName } from './regexNames';

/**
 * Upper bound on matches collected in a single run. A pathological pattern
 * (or a very large document) can otherwise produce an unbounded list and
 * take the tab down with it — this runs on the main thread during render.
 */
export const MAX_MATCHES = 10_000;

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

/**
 * Advance past the character at `index`.
 *
 * With the `u`/`v` flags the engine works in code points: bumping
 * `lastIndex` by one lands *inside* a surrogate pair, and the engine snaps
 * back to the start of that code point on the next `exec` — the same empty
 * match is then found forever. Astral characters therefore have to be
 * stepped over as a whole.
 */
function advanceIndex(text: string, index: number, unicode: boolean): number {
  if (!unicode) return index + 1;
  const code = text.codePointAt(index);
  if (code === undefined) return index + 1;
  return index + (code > 0xffff ? 2 : 1);
}

export interface MatchDetailBudget {
  remaining: number;
}
export const TEST_DETAIL_LIMIT = 100;
export const TEST_DETAIL_BUDGET = 200_000;

/** Bound retained strings and capture objects across the entire test batch. */
export function retainMatch(match: MatchInfo, budget?: MatchDetailBudget): boolean {
  if (!budget) return true;
  const cost =
    1 +
    match.match.length +
    match.groups.reduce(
      (total, group) => total + 1 + (group.value?.length ?? 0) + (group.name?.length ?? 0),
      0,
    );
  if (cost > budget.remaining) return false;
  budget.remaining -= cost;
  return true;
}

export function findMatchResult(
  pattern: string,
  flags: string,
  text: string,
  detailLimit = MAX_MATCHES,
  budget?: MatchDetailBudget,
) {
  const matches: MatchInfo[] = [];
  let matchCount = 0;
  let truncated = false;
  let retain = true;
  if (pattern) {
    const execFlags = SUPPORTS_INDICES && !flags.includes('d') ? `${flags}d` : flags;
    const regex = new RegExp(pattern, execFlags);
    const groupNames = collectGroupNames(pattern);
    const unicode = flags.includes('u') || flags.includes('v');
    for (;;) {
      const match = regex.exec(text);
      if (!match) break;
      // Probe one extra match so exactly MAX_MATCHES is still a complete count.
      if (matchCount === MAX_MATCHES) {
        truncated = true;
        break;
      }
      matchCount++;
      if (retain && matches.length < detailLimit) {
        const info = buildMatchInfo(match, groupNames);
        retain = retainMatch(info, budget);
        if (retain) matches.push(info);
      }
      if (!flags.includes('g')) break;
      if (match[0].length === 0) {
        regex.lastIndex = advanceIndex(text, regex.lastIndex, unicode);
        if (regex.lastIndex > text.length) break;
      }
    }
  }
  return { matches, matchCount, truncated, detailsTruncated: matches.length < matchCount };
}

export function findMatches(pattern: string, flags: string, text: string): MatchInfo[] {
  try {
    return findMatchResult(pattern, flags, text).matches;
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
export function collectGroupNames(pattern: string): Array<string | null> {
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
    const nameStart = pattern[i + 2] === 'P' && pattern[i + 3] === '<' ? i + 4 : i + 3;
    if (
      nameStart === i + 3 &&
      (pattern[i + 2] !== '<' || pattern[i + 3] === '=' || pattern[i + 3] === '!')
    )
      continue;
    const close = pattern.indexOf('>', nameStart);
    if (close === -1) continue;
    names.push(decodeGroupName(pattern.slice(nameStart, close)));
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
  if (!pattern) return text;

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

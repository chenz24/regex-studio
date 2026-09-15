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
function advanceIndex(text: string, index: number, unicode: boolean): number {
  if (!unicode) return index + 1;
  const code = text.codePointAt(index);
  if (code === undefined) return index + 1;
  return index + (code > 0xffff ? 2 : 1);
}

export function findMatches(pattern: string, flags: string, text: string): MatchInfo[] {
  if (!pattern) return [];

  try {
    const regex = new RegExp(pattern, flags);
    const matches: MatchInfo[] = [];
    const unicode = flags.includes('u') || flags.includes('v');
    let match: RegExpExecArray | null;

    if (flags.includes('g')) {
      match = regex.exec(text);
      while (match !== null) {
        matches.push(buildMatchInfo(match, text));
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
        matches.push(buildMatchInfo(match, text));
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function buildMatchInfo(match: RegExpExecArray, _text: string): MatchInfo {
  const groups: GroupInfo[] = [];

  for (let i = 1; i < match.length; i++) {
    let groupStart = -1;
    let groupEnd = -1;

    if (match[i] !== undefined && match.index !== undefined) {
      const before = match[0].indexOf(match[i]);
      if (before >= 0) {
        groupStart = match.index + before;
        groupEnd = groupStart + match[i].length;
      }
    }

    groups.push({
      name: match.groups
        ? Object.keys(match.groups).find((key) => match.groups![key] === match[i]) || null
        : null,
      index: i,
      value: match[i],
      start: groupStart,
      end: groupEnd,
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

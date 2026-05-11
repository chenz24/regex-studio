import type { MatchInfo, GroupInfo } from '../types/regex';

export function findMatches(pattern: string, flags: string, text: string): MatchInfo[] {
  if (!pattern || !text) return [];

  try {
    const regex = new RegExp(pattern, flags);
    const matches: MatchInfo[] = [];
    let match: RegExpExecArray | null;

    if (flags.includes('g')) {
      while ((match = regex.exec(text)) !== null) {
        matches.push(buildMatchInfo(match, text));
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
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

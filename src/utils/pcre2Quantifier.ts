import type { QuantifierInfo } from '../types/regex';

/** PCRE2 10.47 accepts horizontal whitespace and an omitted lower bound in braces. */
export function readPcre2Quantifier(source: string, ungreedy = false): QuantifierInfo | undefined {
  const match =
    /^(?:([*+?])|\{[ \t]*(?:(\d+)[ \t]*(?:,[ \t]*(\d*)[ \t]*)?|,[ \t]*(\d+)[ \t]*)\})([?+]?)/.exec(
      source,
    );
  if (!match) return;
  const [raw, short, lo, hi, upperOnly, suffix] = match;
  const min = short ? (short === '+' ? 1 : 0) : Number(lo ?? 0);
  const max = short
    ? short === '?'
      ? 1
      : null
    : upperOnly !== undefined
      ? Number(upperOnly)
      : hi === undefined
        ? min
        : hi === ''
          ? null
          : Number(hi);
  return {
    raw,
    min,
    max,
    lazy: suffix === '+' ? false : ungreedy !== (suffix === '?'),
    possessive: suffix === '+',
  };
}

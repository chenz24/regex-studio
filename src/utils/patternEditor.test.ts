import { describe, expect, it } from 'vitest';
import { parseRegex } from './regexParser';
import { groupInnerText, replaceNodeInPattern } from './patternEditor';

describe('groupInnerText', () => {
  it.each([
    ['(abc)', 'abc'],
    ['(?:abc)', 'abc'],
    ['(?<name>abc)', 'abc'],
    ['(a|bc)', 'a|bc'],
    ['(a(b)c)', 'a(b)c'],
    ['(?=abc)', 'abc'],
    ['(?<=ab)', 'ab'],
    ['()', ''],
  ])('reads the whole body of %s', (pattern, expected) => {
    expect(groupInnerText(parseRegex(pattern), pattern)).toBe(expected);
  });

  it('keeps the body when converting a group to another kind', () => {
    // The parser flattens the body into `children`, so reading only
    // `children[0]` turned `(abc)` into `(?:a)`.
    const pattern = '(abc)';
    const node = parseRegex(pattern);
    const converted = replaceNodeInPattern(pattern, node, `(?:${groupInnerText(node, pattern)})`);
    expect(converted).toBe('(?:abc)');
  });
});

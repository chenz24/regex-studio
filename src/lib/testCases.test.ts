import { describe, expect, it } from 'vitest';
import {
  decodeTestSet,
  encodeTestSet,
  MAX_TEST_CASES,
  validAssertions,
  validTestCases,
} from './testCases';
import { decodeShare, encodeShare } from './share';
import type { TestCase } from '../types/regex';

const test: TestCase = {
  id: '1',
  input: '😀a\0',
  label: '捕获',
  expect: 'match',
  assertions: {
    count: 1,
    texts: ['a'],
    ranges: [[2, 3]],
    replacement: '',
    captures: [
      [
        { index: 1, name: 'x', value: null, start: -1, end: -1 },
        { index: 2, name: null, value: '', start: 3, end: 3 },
      ],
    ],
  },
};

describe('test set serialization', () => {
  it('restores exported test sets larger than 2 MB without losing any input', () => {
    const cases = Array.from({ length: 500 }, (_, i) => ({
      id: String(i),
      label: `Case ${i}`,
      input: 'a'.repeat(4000),
      expect: 'match' as const,
    }));
    const json = encodeTestSet(cases);
    expect(new TextEncoder().encode(json).length).toBeGreaterThan(2_000_000);
    expect(decodeTestSet(json)).toEqual(cases);
  });

  it('restores large Unicode inputs and assertion snapshots', () => {
    const cases = [
      { ...test, input: '😀'.repeat(250_000), assertions: { replacement: '中'.repeat(350_000) } },
    ];
    const json = encodeTestSet(cases);
    expect(new TextEncoder().encode(json).length).toBeGreaterThan(2_000_000);
    expect(decodeTestSet(json)).toEqual(cases);
  });

  it('preserves all assertions, empty output, Unicode and unset captures in JSON and v3 shares', () => {
    expect(decodeTestSet(encodeTestSet([test]))).toEqual([test]);
    const payload = { v: 3 as const, e: 'javascript' as const, p: '(a)', f: 'g', tc: [test] };
    expect(decodeShare(encodeShare(payload))).toEqual(payload);
  });
  it.each([1, 2])('preserves v%s legacy count-free cases', (v) => {
    const { assertions: _assertions, ...legacy } = test;
    const payload = Buffer.from(
      JSON.stringify({ v, e: 'javascript', p: 'a', f: 'g', tc: [legacy] }),
    ).toString('base64url');
    expect(decodeShare(payload)).toMatchObject({ v: 3, tc: [legacy] });
  });
  it.each([
    { count: -1 },
    { count: 0.5 },
    { count: '1' },
    { text: ['a'] },
    { texts: [null] },
    { ranges: [[2, 1]] },
    { ranges: [[0]] },
    { captures: [[{ index: 1, name: null, value: null, start: 0, end: 0 }]] },
    { captures: [[{ index: 0, name: null, value: '', start: 0, end: 0 }]] },
    { replacement: null },
    { replacement: {} },
  ])('rejects invalid assertions instead of silently dropping them: %j', (assertions) => {
    expect(validAssertions(assertions)).toBe(false);
    const cases = [{ ...test, assertions }];
    expect(
      decodeTestSet(JSON.stringify({ format: 'regexstudio-tests', version: 1, cases })),
    ).toBeNull();
    expect(
      decodeShare(
        Buffer.from(JSON.stringify({ v: 3, e: 'javascript', p: 'a', f: 'g', tc: cases })).toString(
          'base64url',
        ),
      ),
    ).toBeNull();
  });
  it('rejects duplicate IDs, unsupported versions, invalid JSON and excessive case counts atomically', () => {
    expect(validTestCases([test, test])).toBe(false);
    expect(decodeTestSet('{')).toBeNull();
    expect(
      decodeTestSet(JSON.stringify({ format: 'regexstudio-tests', version: 2, cases: [test] })),
    ).toBeNull();
    const tooMany = Array.from({ length: MAX_TEST_CASES + 1 }, (_, i) => ({
      ...test,
      id: String(i),
    }));
    expect(decodeTestSet(encodeTestSet(tooMany))).toBeNull();
  });
});

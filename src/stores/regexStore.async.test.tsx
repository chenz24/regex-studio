// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRegexDerived, useRegexStore } from './regexStore';
import {
  runMatch,
  runMatchInline,
  timedOutOutcome,
  type MatchInput,
  type MatchOutcome,
} from '../utils/matchEngine';

vi.mock('../utils/matchEngine', async (original) => ({
  ...(await original<typeof import('../utils/matchEngine')>()),
  runMatch: vi.fn(),
}));

let requests: Array<{ input: MatchInput; resolve: (outcome: MatchOutcome) => void }>;
afterEach(cleanup);
beforeEach(() => {
  requests = [];
  vi.mocked(runMatch).mockImplementation(
    (input) =>
      new Promise((resolve) => {
        requests.push({ input, resolve });
      }),
  );
  act(() => {
    useRegexStore.getState().loadPattern('a+', 'g');
    useRegexStore.getState().setTestText('aaa');
    useRegexStore.getState().setTestCases([
      { id: 'positive', label: 'positive', input: 'aaa', expect: 'match' },
      { id: 'negative', label: 'negative', input: 'b', expect: 'noMatch' },
    ]);
  });
});

describe('asynchronous matching results', () => {
  it('does not evaluate arbitrary input inline when another consumer mounts', () => {
    const { result } = renderHook(() => useRegexDerived());
    expect(result.current.pending).toBe(true);
    expect(result.current.matches).toEqual([]);
    expect(result.current.testsPassed).toBe(0);
  });

  it('keeps previous highlights while withholding verdicts for the new input', async () => {
    const { result } = renderHook(() => useRegexDerived());
    await act(async () => requests[0].resolve(runMatchInline(requests[0].input)));
    expect(result.current.testsPassed).toBe(2);
    act(() => useRegexStore.getState().setPattern('b'));
    expect(result.current.pending).toBe(true);
    expect(result.current.matches[0].match).toBe('aaa');
    expect(result.current.testsPassed).toBe(0);
    expect(result.current.testResults.every((r) => r.pending && !r.pass)).toBe(true);
    await act(async () => requests[1].resolve(runMatchInline(requests[1].input)));
    expect(result.current.pending).toBe(false);
    expect(result.current.testsPassed).toBe(0);
  });

  it('does not treat timeout as a successful negative case', async () => {
    const { result } = renderHook(() => useRegexDerived());
    await act(async () => requests[0].resolve(timedOutOutcome(requests[0].input)));
    expect(result.current.pending).toBe(false);
    expect(result.current.timedOut).toBe(true);
    expect(result.current.testsPassed).toBe(0);
    expect(result.current.testResults.every((r) => r.timedOut && !r.pass)).toBe(true);
  });

  it('ignores a response belonging to an earlier input', async () => {
    const { result } = renderHook(() => useRegexDerived());
    act(() => useRegexStore.getState().setPattern('b'));
    await act(async () => requests[0].resolve(runMatchInline(requests[0].input)));
    expect(result.current.pending).toBe(true);
    await act(async () => requests[1].resolve(runMatchInline(requests[1].input)));
    expect(result.current.pending).toBe(false);
    expect(result.current.testsPassed).toBe(0);
  });
});

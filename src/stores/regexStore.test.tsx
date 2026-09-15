// @vitest-environment jsdom
import { useEffect } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRegexActions, useRegexDerived, useRegexStore } from './regexStore';

const initial = useRegexStore.getState();

beforeEach(() => {
  act(() => {
    useRegexStore.setState({
      pattern: initial.pattern,
      testText: initial.testText,
      replacement: '',
      testCases: [],
      engine: 'javascript',
      flags: initial.flags,
    });
  });
});

/** Render the hook and let the first match settle. */
async function renderDerived() {
  const view = renderHook(() => useRegexDerived());
  await act(async () => {});
  return view;
}

describe('useRegexDerived', () => {
  it('computes matches for the current pattern', async () => {
    const { result } = await renderDerived();
    expect(result.current.validation.valid).toBe(true);
    expect(result.current.matches.length).toBeGreaterThan(0);
    expect(result.current.timedOut).toBe(false);
  });

  // The derived object is what consumers key their effects off. When it was
  // rebuilt on every render, LessonRunner's validation effect re-ran, wrote to
  // the store, and the tutorial died with "Maximum update depth exceeded".
  it('keeps the same identity while the inputs do not change', async () => {
    const { result, rerender } = await renderDerived();
    const first = result.current;

    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  it('does not re-run an effect that depends on it', async () => {
    let runs = 0;
    const { rerender } = renderHook(() => {
      const derived = useRegexDerived();
      // Deliberately keyed on the whole object, the way LessonRunner keys its
      // validation effect.
      // biome-ignore lint/correctness/useExhaustiveDependencies: that is the point
      useEffect(() => {
        runs++;
      }, [derived]);
    });
    await act(async () => {});

    const settled = runs;
    rerender();
    rerender();
    rerender();

    expect(runs).toBe(settled);
  });

  it('produces a new result when the pattern changes', async () => {
    const { result } = await renderDerived();
    const before = result.current;

    await act(async () => {
      useRegexStore.getState().setPattern('\\d+');
    });

    expect(result.current).not.toBe(before);
    expect(result.current.ast.raw).toBe('\\d+');
  });

  it('evaluates test cases', async () => {
    await act(async () => {
      useRegexStore.getState().setPattern('\\d+');
      useRegexStore.getState().setTestCases([
        { id: 'a', label: 'has digits', input: 'abc 123', expect: 'match' },
        { id: 'b', label: 'no digits', input: 'abc', expect: 'noMatch' },
      ]);
    });
    const { result } = await renderDerived();

    expect(result.current.testResults.map((r) => r.pass)).toEqual([true, true]);
    expect(result.current.testsPassed).toBe(2);
  });

  it('reports an invalid pattern without matches', async () => {
    await act(async () => {
      useRegexStore.getState().setPattern('(');
    });
    const { result } = await renderDerived();

    expect(result.current.validation.valid).toBe(false);
    expect(result.current.matches).toEqual([]);
  });
});

describe('useRegexActions', () => {
  it('is stable across store updates', async () => {
    const { result, rerender } = renderHook(() => useRegexActions());
    const first = result.current;

    await act(async () => {
      useRegexStore.getState().setPattern('abc');
    });
    rerender();

    expect(result.current).toBe(first);
  });
});

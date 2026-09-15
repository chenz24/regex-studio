import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchInput, MatchRequest, MatchResponse } from './matchEngine';

class ControlledWorker {
  static instances: ControlledWorker[] = [];
  requests: MatchRequest[] = [];
  terminated = false;
  onmessage?: (event: { data: MatchResponse }) => void;
  onerror?: () => void;

  constructor() {
    ControlledWorker.instances.push(this);
  }
  postMessage(request: MatchRequest) {
    this.requests.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  respond(index = 0) {
    this.onmessage?.({
      data: {
        id: this.requests[index].id,
        matches: [],
        replacedText: 'done',
        testMatchCounts: [1],
      },
    });
  }
}

const input = (pattern: string): MatchInput => ({
  pattern,
  flags: 'g',
  text: 'aaa',
  replacement: '',
  testInputs: ['aaa'],
});

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  ControlledWorker.instances = [];
  vi.stubGlobal('Worker', ControlledWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('worker scheduling and recovery', () => {
  it('gives a queued request a fresh budget after the running request times out', async () => {
    const api = await import('./matchEngine');
    const slow = api.runMatch(input('(a+)+$'));
    await vi.advanceTimersByTimeAsync(50);
    const good = api.runMatch(input('a+'));
    const original = ControlledWorker.instances[0];
    expect(original.requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(api.MATCH_TIMEOUT_MS - 50);
    expect((await slow).timedOut).toBe(true);
    expect(original.terminated).toBe(true);
    const replacement = ControlledWorker.instances[1];
    expect(replacement.requests[0].pattern).toBe('a+');

    // An event queued by the dead worker must not kill its replacement.
    original.onerror?.();
    original.respond();
    await vi.advanceTimersByTimeAsync(1500);
    expect(replacement.terminated).toBe(false);
    replacement.respond();
    expect(await good).toMatchObject({ timedOut: false, testMatchCounts: [1] });
    expect(await api.runMatch(input('a+'))).toMatchObject({ timedOut: false });
    expect(replacement.requests).toHaveLength(1);
  });

  it('shares one execution between simultaneous consumers', async () => {
    const { runMatch } = await import('./matchEngine');
    const first = runMatch(input('a+'));
    expect(runMatch(input('a+'))).toBe(first);
    const worker = ControlledWorker.instances[0];
    expect(worker.requests).toHaveLength(1);
    worker.respond();
    await first;
  });

  it('allows an explicit retry of a timed-out input', async () => {
    const api = await import('./matchEngine');
    const first = api.runMatch(input('a+'));
    await vi.advanceTimersByTimeAsync(api.MATCH_TIMEOUT_MS);
    expect((await first).timedOut).toBe(true);
    expect(api.cachedOutcome(api.matchInputKey(input('a+')))).toBeUndefined();
    const retry = api.runMatch(input('a+'));
    ControlledWorker.instances[1].respond();
    expect((await retry).timedOut).toBe(false);
  });

  it('recovers queued work after a worker error', async () => {
    const { runMatch } = await import('./matchEngine');
    const failed = runMatch(input('broken'));
    const queued = runMatch(input('a+'));
    ControlledWorker.instances[0].onerror?.();
    expect((await failed).timedOut).toBe(true);
    ControlledWorker.instances[1].respond();
    expect((await queued).timedOut).toBe(false);
  });
});

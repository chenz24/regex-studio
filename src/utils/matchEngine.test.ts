import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchInput, MatchRequest, WorkerResponse } from './matchEngine';

class ControlledWorker {
  static instances: ControlledWorker[] = [];
  requests: MatchRequest[] = [];
  terminated = false;
  onmessage?: (event: { data: WorkerResponse }) => void;
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
  ready() {
    this.onmessage?.({ data: { type: 'ready' } });
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
  it('isolates native traces from matching and does not cache trace payloads', async () => {
    const api = await import('./matchEngine');
    const normal = { ...input('a'), engine: 'pcre2' as const };
    const debug = { ...normal, trace: true };
    const pendingTrace = api.runMatch(debug);
    expect(api.runMatch(debug)).toBe(pendingTrace);
    const matching = api.runMatch(normal);
    expect(ControlledWorker.instances).toHaveLength(2);
    const [traceWorker, matchWorker] = ControlledWorker.instances;
    traceWorker.ready();
    matchWorker.ready();
    matchWorker.respond();
    expect((await matching).timedOut).toBe(false);
    await vi.advanceTimersByTimeAsync(api.MATCH_TIMEOUT_MS);
    expect((await pendingTrace).timedOut).toBe(true);
    expect(matchWorker.terminated).toBe(false);
    const retry = api.runMatch(debug);
    const nextWorker = ControlledWorker.instances[2];
    nextWorker.ready();
    nextWorker.respond();
    await retry;
    const rerun = api.runMatch(debug);
    expect(nextWorker.requests).toHaveLength(2);
    nextWorker.respond(1);
    await rerun;
  });
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
    expect(await failed).toMatchObject({ timedOut: false, executionError: expect.any(String) });
    ControlledWorker.instances[1].respond();
    expect((await queued).timedOut).toBe(false);
  });

  it('separates PCRE2 loading from matching and lets JavaScript run concurrently', async () => {
    const api = await import('./matchEngine');
    const pcre = api.runMatch({ ...input('a+'), engine: 'pcre2' });
    const pcreWorker = ControlledWorker.instances[0];
    expect(pcreWorker.requests).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(api.MATCH_TIMEOUT_MS + 100);
    expect(pcreWorker.terminated).toBe(false);

    const js = api.runMatch({ ...input('a+'), engine: 'javascript' });
    const jsWorker = ControlledWorker.instances[1];
    expect(jsWorker.requests).toHaveLength(1);
    jsWorker.respond();
    expect((await js).timedOut).toBe(false);
    pcreWorker.ready();
    expect(pcreWorker.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(api.MATCH_TIMEOUT_MS - 1);
    expect(pcreWorker.terminated).toBe(false);
    pcreWorker.respond();
    expect((await pcre).timedOut).toBe(false);
  });

  it('times out an uninitialized PCRE2 engine as a load error and allows retry', async () => {
    const api = await import('./matchEngine');
    const value = { ...input('foo\\Kbar'), engine: 'pcre2' as const };
    const failed = api.runMatch(value);
    await vi.advanceTimersByTimeAsync(api.ENGINE_LOAD_TIMEOUT_MS);
    expect(await failed).toMatchObject({ timedOut: false, executionError: expect.any(String) });
    expect(api.cachedOutcome(api.matchInputKey(value))).toBeUndefined();
    const retry = api.runMatch(value);
    const replacement = ControlledWorker.instances[1];
    ControlledWorker.instances[0].ready();
    expect(replacement.requests).toHaveLength(0);
    replacement.ready();
    replacement.respond();
    expect((await retry).executionError).toBeUndefined();
  });

  it('never serves a JavaScript cache entry to PCRE2', async () => {
    const api = await import('./matchEngine');
    const jsInput = input('foo\\Kbar');
    const js = api.runMatch(jsInput);
    ControlledWorker.instances[0].respond();
    await js;
    const pcreInput = { ...jsInput, engine: 'pcre2' as const };
    expect(api.matchInputKey(jsInput)).not.toBe(api.matchInputKey(pcreInput));
    const pcre = api.runMatch(pcreInput);
    expect(ControlledWorker.instances).toHaveLength(2);
    ControlledWorker.instances[1].ready();
    ControlledWorker.instances[1].respond();
    await pcre;
  });

  it('does not fall back to JavaScript when a PCRE2 Worker cannot be created', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );
    const api = await import('./matchEngine');
    const result = await api.runMatch({ ...input('(a+)+$'), engine: 'pcre2' });
    expect(result.executionError).toBeDefined();
    expect(result.matches).toEqual([]);
    expect(result.timedOut).toBe(false);
  });

  it('recreates a PCRE2 instance after a runtime failure', async () => {
    const api = await import('./matchEngine');
    const value = { ...input('a+'), engine: 'pcre2' as const };
    const first = api.runMatch(value);
    const original = ControlledWorker.instances[0];
    original.ready();
    original.onmessage?.({
      data: {
        id: original.requests[0].id,
        matches: [],
        replacedText: '',
        testMatchCounts: [],
        executionError: 'out of memory',
      },
    });
    expect((await first).executionError).toBe('out of memory');
    expect(original.terminated).toBe(true);
    const retry = api.runMatch(value);
    ControlledWorker.instances[1].ready();
    ControlledWorker.instances[1].respond();
    expect((await retry).executionError).toBeUndefined();
  });
});

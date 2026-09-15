import type { MatchInfo } from '../types/regex';
import { findMatches, replaceMatches } from './regexMatcher';

export interface MatchRequest {
  id: number;
  pattern: string;
  flags: string;
  text: string;
  replacement: string;
  testInputs: string[];
}

export interface MatchResponse {
  id: number;
  matches: MatchInfo[];
  replacedText: string;
  testMatchCounts: number[];
}

export type MatchInput = Omit<MatchRequest, 'id'>;

export interface MatchOutcome {
  matches: MatchInfo[];
  replacedText: string;
  testMatchCounts: number[];
  /** The pattern was still running when the deadline passed. */
  timedOut: boolean;
}

/**
 * How long a pattern may run before we give up on it and kill the worker.
 * Long enough that a big document still matches, short enough that a runaway
 * pattern does not look like a hang.
 */
export const MATCH_TIMEOUT_MS = 2000;

/** Distinct results kept around so repeated state churn does not re-run work. */
const CACHE_LIMIT = 50;

export function matchInputKey(input: MatchInput): string {
  return JSON.stringify([
    input.pattern,
    input.flags,
    input.text,
    input.replacement,
    input.testInputs,
  ]);
}

/** Run inline and keep the result, so the follow-up request is a cache hit. */
export function runMatchInlineCached(input: MatchInput, key: string): MatchOutcome {
  return cachedOutcome(key) ?? remember(key, runMatchInline(input));
}

export function runMatchInline(input: MatchInput): MatchOutcome {
  return {
    matches: findMatches(input.pattern, input.flags, input.text),
    replacedText: replaceMatches(input.pattern, input.flags, input.text, input.replacement),
    testMatchCounts: input.testInputs.map(
      (testInput) => findMatches(input.pattern, input.flags, testInput).length,
    ),
    timedOut: false,
  };
}

export function timedOutOutcome(input: MatchInput): MatchOutcome {
  return {
    matches: [],
    replacedText: input.text,
    testMatchCounts: input.testInputs.map(() => 0),
    timedOut: true,
  };
}

const cache = new Map<string, MatchOutcome>();

function remember(key: string, outcome: MatchOutcome): MatchOutcome {
  cache.set(key, outcome);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return outcome;
}

export function cachedOutcome(key: string): MatchOutcome | undefined {
  return cache.get(key);
}

// ─── Worker plumbing ──────────────────────────────────────────────────

interface InFlight {
  id: number;
  key: string;
  resolve: (outcome: MatchOutcome) => void;
  input: MatchInput;
}

let worker: Worker | null = null;
let nextId = 1;
let running: InFlight | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const queue: InFlight[] = [];
const inFlight = new Map<string, Promise<MatchOutcome>>();

function workerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

function getWorker(): Worker | null {
  if (!workerAvailable()) return null;
  if (worker) return worker;
  try {
    const created = new Worker(new URL('../workers/matchWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker = created;
    created.onmessage = (event: MessageEvent<MatchResponse>) => {
      if (worker !== created) return;
      const { id, matches, replacedText, testMatchCounts } = event.data;
      if (running?.id !== id) return; // response from an abandoned request
      finish({ matches, replacedText, testMatchCounts, timedOut: false });
    };
    created.onerror = () => {
      if (worker === created) discardWorker();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * Only the running request failed. Queued requests have not used any of
 * their execution budget and can continue on a fresh worker.
 */
function discardWorker(): void {
  worker?.terminate();
  worker = null;
  if (running) finish(timedOutOutcome(running.input));
}

function finish(outcome: MatchOutcome): void {
  const entry = running;
  if (!entry) return;
  clearTimeout(timer);
  running = null;
  inFlight.delete(entry.key);
  // A timeout is not a reusable matching result; an explicit retry may work.
  if (!outcome.timedOut) remember(entry.key, outcome);
  entry.resolve(outcome);
  startNext();
}

function startNext(): void {
  if (running) return;
  const entry = queue.shift();
  if (!entry) return;
  running = entry;
  const active = getWorker();
  if (!active) {
    // SSR/test runtimes do not provide Worker. A browser that failed to
    // construct one must not execute an arbitrary regex on its UI thread.
    finish(workerAvailable() ? timedOutOutcome(entry.input) : runMatchInline(entry.input));
    return;
  }
  timer = setTimeout(discardWorker, MATCH_TIMEOUT_MS);
  try {
    active.postMessage({ id: entry.id, ...entry.input } satisfies MatchRequest);
  } catch {
    discardWorker();
  }
}

/**
 * Run `input` off the main thread, resolving with a `timedOut` outcome if it
 * overruns. Falls back to running inline where workers are unavailable —
 * during SSR, where only the built-in default pattern is ever rendered.
 */
export function runMatch(input: MatchInput): Promise<MatchOutcome> {
  const key = matchInputKey(input);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);

  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = new Promise<MatchOutcome>((resolve) => {
    queue.push({ id: nextId++, key, input, resolve });
  });
  inFlight.set(key, promise);
  startNext();
  return promise;
}

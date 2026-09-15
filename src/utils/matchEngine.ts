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
  resolve: (outcome: MatchOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
  input: MatchInput;
}

let worker: Worker | null = null;
let nextId = 1;
const inFlight = new Map<number, InFlight>();

function workerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

function getWorker(): Worker | null {
  if (!workerAvailable()) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/matchWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<MatchResponse>) => {
      const { id, matches, replacedText, testMatchCounts } = event.data;
      const entry = inFlight.get(id);
      if (!entry) return; // a response we already gave up on
      clearTimeout(entry.timer);
      inFlight.delete(id);
      entry.resolve({ matches, replacedText, testMatchCounts, timedOut: false });
    };
    worker.onerror = () => discardWorker();
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * Kill the worker and settle everything it was running. A pattern that blew
 * the deadline is still spinning in there — the thread is not recoverable,
 * so the next request gets a fresh one.
 */
function discardWorker(): void {
  worker?.terminate();
  worker = null;
  for (const [id, entry] of inFlight) {
    clearTimeout(entry.timer);
    inFlight.delete(id);
    entry.resolve(timedOutOutcome(entry.input));
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

  const active = getWorker();
  if (!active) return Promise.resolve(remember(key, runMatchInline(input)));

  const id = nextId++;
  return new Promise<MatchOutcome>((resolve) => {
    const timer = setTimeout(() => {
      // Only this request is reported as timed out; the rest are re-queued by
      // their own callers when the state settles.
      discardWorker();
    }, MATCH_TIMEOUT_MS);

    inFlight.set(id, {
      input,
      timer,
      resolve: (outcome) => resolve(remember(key, outcome)),
    });

    active.postMessage({ id, ...input } satisfies MatchRequest);
  });
}

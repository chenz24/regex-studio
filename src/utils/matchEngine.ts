import type { MatchInfo } from '../types/regex';
import { findMatches, replaceMatches } from './regexMatcher';
import type { Pcre2Trace } from './pcre2Trace';

export interface MatchRequest {
  trace?: boolean;
  id: number;
  engine?: 'javascript' | 'pcre2';
  pattern: string;
  flags: string;
  text: string;
  replacement: string;
  testInputs: string[];
}

export interface MatchResponse {
  trace?: Pcre2Trace;
  id: number;
  matches: MatchInfo[];
  replacedText: string;
  testMatchCounts: number[];
  timedOut?: boolean;
  validation?: { valid: boolean; error?: string; offset?: number };
  executionError?: string;
  replacementError?: string;
}

export type WorkerResponse =
  | MatchResponse
  | { type: 'ready' }
  | { type: 'load-error'; message: string };

export type MatchInput = Omit<MatchRequest, 'id'>;

export interface MatchOutcome {
  trace?: Pcre2Trace;
  matches: MatchInfo[];
  replacedText: string;
  testMatchCounts: number[];
  /** The deadline or a native engine resource limit was reached. */
  timedOut: boolean;
  validation?: { valid: boolean; error?: string; offset?: number };
  executionError?: string;
  replacementError?: string;
}

/**
 * How long a pattern may run before we give up on it and kill the worker.
 * Long enough that a big document still matches, short enough that a runaway
 * pattern does not look like a hang.
 */
export const MATCH_TIMEOUT_MS = 2000;
export const ENGINE_LOAD_TIMEOUT_MS = 15_000;

/** Distinct results kept around so repeated state churn does not re-run work. */
const CACHE_LIMIT = 50;

export function matchInputKey(input: MatchInput): string {
  return JSON.stringify([
    input.engine ?? 'javascript',
    input.trace ?? false,
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
  if (input.engine === 'pcre2') {
    return failedOutcome(input, 'PCRE2 requires a browser Worker');
  }
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

function failedOutcome(input: MatchInput, executionError: string): MatchOutcome {
  return { ...timedOutOutcome(input), timedOut: false, testMatchCounts: [], executionError };
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

let nextId = 1;
const inFlight = new Map<string, Promise<MatchOutcome>>();

function workerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

/** Separate queues let JavaScript keep working while PCRE2 initializes or runs. */
class EngineQueue {
  private worker: Worker | null = null;
  private ready = false;
  private running: InFlight | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: InFlight[] = [];

  constructor(private engine: 'javascript' | 'pcre2') {}

  enqueue(entry: InFlight) {
    this.queue.push(entry);
    this.startNext();
  }

  private discard(message?: string) {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    if (this.running)
      this.finish(
        message ? failedOutcome(this.running.input, message) : timedOutOutcome(this.running.input),
      );
  }

  private finish(outcome: MatchOutcome) {
    const entry = this.running;
    if (!entry) return;
    clearTimeout(this.timer);
    this.running = null;
    inFlight.delete(entry.key);
    if (!entry.input.trace && !outcome.timedOut && !outcome.executionError)
      remember(entry.key, outcome);
    entry.resolve(outcome);
    this.startNext();
  }

  private dispatch() {
    if (!this.running || !this.worker || !this.ready) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.discard(), MATCH_TIMEOUT_MS);
    try {
      this.worker.postMessage({
        id: this.running.id,
        ...this.running.input,
      } satisfies MatchRequest);
    } catch {
      this.discard('Unable to send input to the regex engine');
    }
  }

  private startNext() {
    if (this.running) return;
    const entry = this.queue.shift();
    if (!entry) return;
    this.running = entry;
    if (!workerAvailable()) {
      this.finish(runMatchInline(entry.input));
      return;
    }
    if (!this.worker) {
      try {
        const created =
          this.engine === 'pcre2'
            ? new Worker(new URL('../workers/pcre2Worker.ts', import.meta.url), { type: 'module' })
            : new Worker(new URL('../workers/matchWorker.ts', import.meta.url), { type: 'module' });
        this.worker = created;
        this.ready = this.engine === 'javascript';
        created.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (this.worker !== created) return;
          const response = event.data;
          if ('type' in response) {
            if (response.type === 'load-error') this.discard(response.message);
            else if (!this.ready) {
              this.ready = true;
              this.dispatch();
            }
            return;
          }
          if (response.id !== this.running?.id) return;
          const { id: _id, ...outcome } = response;
          // A WASM allocation/trap failure can leave its instance unusable.
          // Start a fresh engine for the next request, including explicit retries.
          if (outcome.executionError) {
            this.discard(outcome.executionError);
            return;
          }
          this.finish({ ...outcome, timedOut: outcome.timedOut ?? false });
        };
        created.onerror = () => {
          if (this.worker === created) this.discard('Unable to load or run the regex engine');
        };
      } catch {
        this.discard('Unable to start the regex engine');
        return;
      }
    }
    if (this.ready) this.dispatch();
    else
      this.timer = setTimeout(
        () => this.discard('PCRE2 engine loading timed out'),
        ENGINE_LOAD_TIMEOUT_MS,
      );
  }
}

const queues = { javascript: new EngineQueue('javascript'), pcre2: new EngineQueue('pcre2') };
// Debugging has its own Worker so a trace cannot delay live matching or grading.
const traceQueue = new EngineQueue('pcre2');

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
  let resolve!: (outcome: MatchOutcome) => void;
  const promise = new Promise<MatchOutcome>((done) => {
    resolve = done;
  });
  inFlight.set(key, promise);
  (input.engine === 'pcre2' && input.trace
    ? traceQueue
    : queues[input.engine ?? 'javascript']
  ).enqueue({ id: nextId++, key, input, resolve });
  return promise;
}

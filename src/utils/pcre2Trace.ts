import type { Pcre2Module } from '../vendor/pcre2/pcre2';

export interface Pcre2TraceStep {
  patternStart: number;
  patternEnd: number;
  stringPos: number;
  matchStart: number;
  flags: number;
  calloutNumber: number;
  captures: Array<{ index: number; start: number; end: number }>;
}

export interface Pcre2Trace {
  steps: Pcre2TraceStep[];
  truncated: boolean;
}

export const MAX_TRACE_STEPS = 2000;
const MAX_CAPTURE_SLOTS = 50_000;

/** Only positions are copied; large subject substrings are not repeated per step. */
export function createTraceCollector(m: Pcre2Module) {
  const trace: Pcre2Trace = { steps: [], truncated: false };
  let slots = 0;
  return {
    trace,
    record(
      patternStart: number,
      length: number,
      stringPos: number,
      matchStart: number,
      flags: number,
      top: number,
      vector: number,
      calloutNumber: number,
    ) {
      if (trace.truncated) return;
      slots += top;
      if (trace.steps.length >= MAX_TRACE_STEPS || slots > MAX_CAPTURE_SLOTS) {
        trace.truncated = true;
        return;
      }
      const captures: Pcre2TraceStep['captures'] = [];
      for (let i = 1; i < top; i++) {
        const start = m.HEAPU32[(vector >> 2) + i * 2];
        const end = m.HEAPU32[(vector >> 2) + i * 2 + 1];
        if (start !== 0xffff_ffff && end !== 0xffff_ffff) captures.push({ index: i, start, end });
      }
      trace.steps.push({
        patternStart,
        patternEnd: patternStart + length,
        stringPos,
        matchStart,
        flags,
        captures,
        calloutNumber,
      });
    },
  };
}

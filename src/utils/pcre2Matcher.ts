import { retainReplacement, TEST_REPLACEMENT_BUDGET } from './testResultBudget';
import createModule, { type Pcre2Module } from '../vendor/pcre2/pcre2.js';
import wasmUrl from '../vendor/pcre2/pcre2.wasm?url';
import type { MatchInfo } from '../types/regex';
import type { MatchInput, MatchOutcome } from './matchEngine';
import {
  MAX_MATCHES,
  TEST_DETAIL_LIMIT,
  TEST_DETAIL_BUDGET,
  retainMatch,
  type MatchDetailBudget,
} from './regexMatcher';
import { createTraceCollector } from './pcre2Trace';

const UNSET = 0xffff_ffff;
const MAX_OUTPUT_LENGTH = 2_000_000;
const FLAG_BITS: Record<string, number> = {
  g: 0,
  i: 0x8,
  m: 0x400,
  s: 0x20,
  u: 0x80000 | 0x20000,
  x: 0x80,
  U: 0x40000,
  J: 0x40,
};

/** No module initialization occurs on the UI thread. Tests supply the same binary. */
export async function createPcre2Matcher(wasmBinary?: Uint8Array) {
  let active: ReturnType<typeof createTraceCollector> | undefined;
  const m = await createModule({
    wasmBinary,
    locateFile: () => wasmUrl,
    onTrace: (...args) => active?.record(...(args as Parameters<typeof active.record>)),
  });
  return (input: MatchInput): MatchOutcome => {
    active = input.trace ? createTraceCollector(m) : undefined;
    try {
      return { ...execute(m, input), ...(active ? { trace: active.trace } : {}) };
    } finally {
      active = undefined;
    }
  };
}

function execute(m: Pcre2Module, input: MatchInput): MatchOutcome {
  const outcome: MatchOutcome = {
    matches: [],
    replacedText: input.text,
    testMatchCounts: [],
    timedOut: false,
    validation: { valid: true },
  };
  const allocations = new Set<number>();
  const allocate = (bytes: number) => {
    const pointer = m._malloc(Math.max(4, bytes));
    if (!pointer) throw new Error('PCRE2: memory limit exceeded');
    allocations.add(pointer);
    return pointer;
  };
  const free = (pointer: number) => {
    m._free(pointer);
    allocations.delete(pointer);
  };
  const encode = (value: string) => {
    const pointer = allocate((value.length + 1) * 2);
    for (let i = 0; i < value.length; i++) m.HEAPU16[(pointer >> 1) + i] = value.charCodeAt(i);
    m.HEAPU16[(pointer >> 1) + value.length] = 0;
    return pointer;
  };
  const decode = (pointer: number, length: number) => {
    let value = '';
    for (let i = 0; i < length; i += 8192) {
      value += String.fromCharCode(
        ...m.HEAPU16.subarray((pointer >> 1) + i, (pointer >> 1) + Math.min(i + 8192, length)),
      );
    }
    return value;
  };
  const errorMessage = (code: number) => {
    const pointer = allocate(512);
    const length = m._pcre2_get_error_message_16(code, pointer, 256);
    const message = length < 0 ? `PCRE2 error ${code}` : decode(pointer, length);
    free(pointer);
    return message;
  };
  let compiled = 0;
  let data = 0;
  let context = 0;
  try {
    // Keep normal optimizations: callouts describe actual native execution.
    let flags = input.trace ? 0x4 : 0;
    for (const flag of input.flags) {
      if (!(flag in FLAG_BITS)) {
        outcome.validation = { valid: false, error: `Unsupported PCRE2 flag: ${flag}` };
        return outcome;
      }
      flags |= FLAG_BITS[flag];
    }
    const scratch = allocate(16);
    const pattern = encode(input.pattern);
    compiled = m._pcre2_compile_16(pattern, input.pattern.length, flags, scratch, scratch + 4, 0);
    if (!compiled) {
      const code = m.HEAPU32[scratch >> 2];
      const offset = m.HEAPU32[(scratch + 4) >> 2];
      outcome.validation = {
        valid: false,
        error: `${errorMessage(code)} (offset ${offset})`,
        offset,
      };
      return outcome;
    }
    if (input.validateOnly) return outcome;
    // An empty editor is intentionally idle, matching the JavaScript mode.
    if (!input.pattern) {
      const replacementBudget = { remaining: TEST_REPLACEMENT_BUDGET };
      outcome.testMatchCounts = input.testInputs.map(() => 0);
      outcome.testExecutions = input.testInputs.map((text, i) => ({
        matchCount: 0,
        matches: [],
        truncated: false,
        detailsTruncated: false,
        ...(input.testReplacements?.[i]
          ? retainReplacement({ replacedText: text }, replacementBudget)
          : {}),
      }));
      return outcome;
    }
    data = m._pcre2_match_data_create_from_pattern_16(compiled, 0);
    context = m._pcre2_match_context_create_16(0);
    if (!data || !context) throw new Error('PCRE2: unable to allocate match context');
    m._pcre2_set_match_limit_16(context, 1_000_000);
    m._pcre2_set_depth_limit_16(context, 10_000);
    m._pcre2_set_heap_limit_16(context, 16_384);
    if (input.trace) m._rs_set_trace(context);
    const info = (what: number) => {
      const rc = m._pcre2_pattern_info_16(compiled, what, scratch);
      if (rc < 0) throw new Error(errorMessage(rc));
      return m.HEAPU32[scratch >> 2];
    };
    const captureCount = info(4);
    const nameCount = info(17);
    const nameSize = info(18);
    const nameTable = info(19);
    const names = new Map<number, string>();
    for (let i = 0; i < nameCount; i++) {
      const pointer = nameTable + i * nameSize * 2;
      const group = m.HEAPU16[pointer >> 1];
      let length = 0;
      while (length < nameSize - 1 && m.HEAPU16[(pointer >> 1) + 1 + length]) length++;
      names.set(group, decode(pointer + 2, length));
    }
    const global = !input.trace && input.flags.includes('g');
    const find = (text: string, detailLimit = MAX_MATCHES, budget?: MatchDetailBudget) => {
      const subject = encode(text);
      const matches: MatchInfo[] = [];
      let count = 0;
      let truncated = false;
      let retain = true;
      let start = 0;
      let options = 0;
      try {
        for (;;) {
          const rc = m._pcre2_match_16(
            compiled,
            subject,
            text.length,
            start,
            options,
            data,
            context,
          );
          if (rc < -1) throw Object.assign(new Error(errorMessage(rc)), { code: rc });
          if (rc >= 0) {
            if (count === MAX_MATCHES) {
              truncated = true;
              break;
            }
            count++;
            if (retain && matches.length < detailLimit) {
              const vector = m._pcre2_get_ovector_pointer_16(data) >> 2;
              const from = m.HEAPU32[vector];
              const to = m.HEAPU32[vector + 1];
              const groups = Array.from({ length: captureCount }, (_, i) => {
                const a = m.HEAPU32[vector + (i + 1) * 2];
                const b = m.HEAPU32[vector + (i + 1) * 2 + 1];
                return {
                  index: i + 1,
                  name: names.get(i + 1) ?? null,
                  start: a === UNSET ? -1 : a,
                  end: b === UNSET ? -1 : b,
                  value: a === UNSET ? undefined : text.slice(a, b),
                };
              });
              const match: MatchInfo = {
                index: from,
                start: from,
                end: to,
                match: text.slice(from, to),
                groups,
              };
              retain = retainMatch(match, budget);
              if (retain) matches.push(match);
            }
          }
          if (!global) break;
          // PCRE2 owns empty-match retries, UTF-16 advancement and CRLF handling.
          if (!m._pcre2_next_match_16(data, scratch, scratch + 4)) break;
          start = m.HEAPU32[scratch >> 2];
          options = m.HEAPU32[(scratch + 4) >> 2];
        }
        return { matches, matchCount: count, truncated, detailsTruncated: matches.length < count };
      } finally {
        free(subject);
      }
    };
    const main = find(input.text);
    outcome.matches = main.matches;
    outcome.matchesTruncated = main.truncated;
    if (input.trace) return outcome;
    const substitute = (text: string) => {
      const result: { replacedText: string; replacementError?: string } = { replacedText: text };
      const subject = encode(text);
      const replacement = encode(input.replacement);
      let size = Math.min(MAX_OUTPUT_LENGTH, Math.max(1024, text.length + 1));
      let output = allocate(size * 2);
      try {
        for (;;) {
          m.HEAPU32[scratch >> 2] = size;
          const rc = m._pcre2_substitute_16(
            compiled,
            subject,
            text.length,
            0,
            0x1000 | 0x400 | (global ? 0x100 : 0),
            0,
            context,
            replacement,
            input.replacement.length,
            output,
            scratch,
          );
          const length = m.HEAPU32[scratch >> 2];
          if (rc >= 0) {
            result.replacedText = decode(output, length);
            break;
          }
          if (rc === -48 && length > size && length <= MAX_OUTPUT_LENGTH) {
            free(output);
            output = 0;
            size = length;
            output = allocate(size * 2);
            continue;
          }
          result.replacementError =
            rc === -48 ? 'PCRE2: replacement output exceeds the size limit' : errorMessage(rc);
          break;
        }
      } finally {
        if (output) free(output);
        free(subject);
        free(replacement);
      }
      return result;
    };
    Object.assign(outcome, substitute(input.text));
    const budget = { remaining: TEST_DETAIL_BUDGET };
    const replacementBudget = { remaining: TEST_REPLACEMENT_BUDGET };
    outcome.testExecutions = input.testInputs.map((text, i) => ({
      ...find(text, TEST_DETAIL_LIMIT, budget),
      ...(input.testReplacements?.[i]
        ? retainReplacement(substitute(text), replacementBudget)
        : {}),
    }));
    outcome.testMatchCounts = outcome.testExecutions.map((result) => result.matchCount);
    return outcome;
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === -47 || code === -53 || code === -63) {
      return {
        ...outcome,
        matches: [],
        matchesTruncated: false,
        testMatchCounts: [],
        timedOut: true,
      };
    }
    return {
      ...outcome,
      matches: [],
      matchesTruncated: false,
      testMatchCounts: [],
      executionError: error instanceof Error ? error.message : 'PCRE2 execution failed',
    };
  } finally {
    if (data) m._pcre2_match_data_free_16(data);
    if (context) m._pcre2_match_context_free_16(context);
    if (compiled) m._pcre2_code_free_16(compiled);
    for (const pointer of allocations) m._free(pointer);
  }
}

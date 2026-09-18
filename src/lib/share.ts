import type { TestCase } from '../types/regex';
import { validTestCases } from './testCases';
import {
  ENGINE_LIST,
  ENGINE_FLAVORS,
  EXECUTION_ENGINES,
  COMPATIBILITY_TARGETS,
  toJsFlagString,
  type ExecutionEngine,
  type CompatibilityTarget,
  type RegexEngine,
} from '../types/engineTypes';

const VALID_ENGINES = new Set<string>(ENGINE_LIST);

/**
 * Versioned, URL-safe payload for sharing the editor state.
 *
 * The encoder produces a base64url-encoded JSON blob so the result can be
 * dropped into a URL hash (`#s=...`) without further escaping. The hash
 * fragment is never sent to the server — keeps SSR rendering clean and
 * means anything we encode stays client-side.
 *
 * Field names are intentionally short to keep typical share URLs compact.
 */
export interface SharePayload {
  v: 3;
  /** pattern */
  p: string;
  /** flag string (display flags, not just JS-safe subset) */
  f: string;
  /** Actual execution engine, independent of compatibility checks. */
  e: ExecutionEngine;
  c?: CompatibilityTarget;
  /** Display-only options recovered from a v1 share. */
  lf?: string;
  /** test text */
  t?: string;
  /** replacement string */
  r?: string;
  /** show replace panel */
  sr?: boolean;
  /** test cases */
  tc?: TestCase[];
}

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  // Avoid the 64k argument limit by chunking.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(s: string): string {
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShare(payload: SharePayload): string {
  return utf8ToBase64Url(JSON.stringify(payload));
}

export function decodeShare(s: string): SharePayload | null {
  try {
    const json = base64UrlToUtf8(s);
    const data = JSON.parse(json);
    if (!data || (data.v !== 1 && data.v !== 2 && data.v !== 3) || typeof data.p !== 'string')
      return null;
    // Engine must be a known target; otherwise downstream code (e.g.
    // ENGINE_FLAVORS[engine].name) would crash on an unknown id.
    if (typeof data.e !== 'string' || !VALID_ENGINES.has(data.e)) return null;
    if (typeof data.f !== 'string') return null;
    if (data.t !== undefined && typeof data.t !== 'string') return null;
    if (data.r !== undefined && typeof data.r !== 'string') return null;
    if (data.sr !== undefined && typeof data.sr !== 'boolean') return null;
    if (data.tc !== undefined && !validTestCases(data.tc)) return null;
    const common = { p: data.p, t: data.t, r: data.r, sr: data.sr, tc: data.tc };
    if (data.v >= 2) {
      if (!EXECUTION_ENGINES.includes(data.e)) return null;
      if (data.c !== undefined && !COMPATIBILITY_TARGETS.includes(data.c)) return null;
      if (
        data.lf !== undefined &&
        (typeof data.lf !== 'string' ||
          !data.c ||
          [...data.lf].some(
            (key) =>
              !ENGINE_FLAVORS[data.c as CompatibilityTarget].flags.some(
                (f) => f.key === key && !f.jsFlag,
              ),
          ))
      )
        return null;
      if (
        [...data.f].some(
          (key) => !ENGINE_FLAVORS[data.e as ExecutionEngine].flags.some((f) => f.key === key),
        )
      )
        return null;
      return { v: 3, ...common, e: data.e, f: data.f, c: data.c, lf: data.lf };
    }
    const legacy = data.e as RegexEngine;
    const enabled = ENGINE_FLAVORS[legacy].flags.map((f) => ({
      ...f,
      enabled: data.f.includes(f.key),
    }));
    if (legacy === 'javascript' || legacy === 'pcre2') {
      return {
        v: 3,
        ...common,
        e: legacy,
        f: enabled
          .filter((f) => f.enabled)
          .map((f) => f.key)
          .join(''),
      };
    }
    // Preserve the actual old JS execution flags, including the absence of g.
    // Python's informational u, Go's U and other display-only flags never ran.
    return {
      v: 3,
      ...common,
      e: 'javascript',
      c: legacy,
      f: toJsFlagString(enabled),
      lf:
        enabled
          .filter((f) => f.enabled && !f.jsFlag)
          .map((f) => f.key)
          .join('') || undefined,
    };
  } catch {
    return null;
  }
}

const HASH_PREFIX = '#s=';

export function readShareFromLocation(): SharePayload | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  return decodeShare(hash.slice(HASH_PREFIX.length));
}

export function writeShareToLocation(payload: SharePayload): void {
  if (typeof window === 'undefined') return;
  const encoded = encodeShare(payload);
  const next = `${workspacePath()}${HASH_PREFIX}${encoded}`;
  // Use replaceState so we don't pollute browser history on every keystroke.
  window.history.replaceState(null, '', next);
}

export function buildShareUrl(payload: SharePayload): string {
  if (typeof window === 'undefined') return '';
  const encoded = encodeShare(payload);
  return `${window.location.origin}${workspacePath()}${HASH_PREFIX}${encoded}`;
}

/** Entry links launch a lesson/challenge once; a workspace URL saves the editor. */
function workspacePath(): string {
  const params = new URLSearchParams(window.location.search);
  for (const key of ['lesson', 'step', 'challenge']) params.delete(key);
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

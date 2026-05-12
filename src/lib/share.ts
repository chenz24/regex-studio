import type { TestCase } from '../types/regex';
import { ENGINE_LIST } from '../types/engineTypes';

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
  v: 1;
  /** pattern */
  p: string;
  /** flag string (display flags, not just JS-safe subset) */
  f: string;
  /** target engine id */
  e: string;
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
    if (!data || data.v !== 1 || typeof data.p !== 'string') return null;
    // Engine must be a known target; otherwise downstream code (e.g.
    // ENGINE_FLAVORS[engine].name) would crash on an unknown id.
    if (typeof data.e !== 'string' || !VALID_ENGINES.has(data.e)) return null;
    if (typeof data.f !== 'string') return null;
    return data as SharePayload;
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
  const next = `${window.location.pathname}${window.location.search}${HASH_PREFIX}${encoded}`;
  // Use replaceState so we don't pollute browser history on every keystroke.
  window.history.replaceState(null, '', next);
}

export function buildShareUrl(payload: SharePayload): string {
  if (typeof window === 'undefined') return '';
  const encoded = encodeShare(payload);
  return `${window.location.origin}${window.location.pathname}${window.location.search}${HASH_PREFIX}${encoded}`;
}

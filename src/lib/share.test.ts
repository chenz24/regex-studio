import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildShareUrl,
  writeShareToLocation,
  decodeShare,
  encodeShare,
  type SharePayload,
} from './share';
import { ENGINE_FLAVORS, type RegexEngine, toJsFlagString } from '../types/engineTypes';
import { findMatches, replaceMatches } from '../utils/regexMatcher';

const raw = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
afterEach(() => vi.unstubAllGlobals());

describe('workspace URLs', () => {
  it('survives rejected history writes and removes a stale share before recovering', () => {
    const replaceState = vi.fn().mockImplementationOnce(() => {
      throw new DOMException('URL is too long', 'SecurityError');
    });
    vi.stubGlobal('window', {
      location: {
        origin: 'https://regexstudio.com',
        pathname: '/ja',
        search: '?challenge=email-find&source=test',
      },
      history: { replaceState },
    });
    const payload: SharePayload = { v: 3, e: 'javascript', p: 'a', f: 'g', t: 'a' };
    expect(() => writeShareToLocation(payload)).not.toThrow();
    expect(replaceState).toHaveBeenNthCalledWith(2, null, '', '/ja?source=test');
    writeShareToLocation(payload);
    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      '',
      `/ja?source=test#s=${encodeShare(payload)}`,
    );
    replaceState.mockImplementation(() => {
      throw new DOMException('History is unavailable', 'SecurityError');
    });
    expect(() => writeShareToLocation(payload)).not.toThrow();
  });
  it.each([
    '?challenge=email-find&source=test',
    '?lesson=basics-literals&step=2&source=test',
  ])('removes launch parameters from copied and autosaved workspaces: %s', (search) => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: { origin: 'https://regexstudio.com', pathname: '/zh', search },
      history: { replaceState },
    });
    const payload: SharePayload = { v: 3, e: 'javascript', p: 'saved', f: 'g' };
    const link = new URL(buildShareUrl(payload));
    expect(link.pathname).toBe('/zh');
    expect(link.search).toBe('?source=test');
    expect(decodeShare(link.hash.slice(3))?.p).toBe('saved');
    writeShareToLocation(payload);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      `${link.pathname}${link.search}${link.hash}`,
    );
  });
});

describe('versioned share migration', () => {
  it.each([
    ['python', 'imsux', 'ims', 'ux'],
    ['java', 'imsux', 'imsu', 'x'],
    ['go', 'imsU', 'ims', 'U'],
    ['dotnet', 'imsxn', 'ims', 'xn'],
    ['rust', 'imsx', 'ims', 'x'],
  ])('migrates %s without enabling global matching or informational flags', (target, flags, executed, informational) => {
    const result = decodeShare(raw({ v: 1, e: target, p: '.', f: flags, t: '中文 aa', r: 'X' }));
    expect(result).toMatchObject({
      v: 3,
      e: 'javascript',
      c: target,
      f: executed,
      lf: informational,
    });
    expect(decodeShare(encodeShare(result!))).toEqual(result);
  });

  it.each(['javascript', 'pcre2'] as const)('preserves %s execution options', (e) => {
    const f = e === 'pcre2' ? 'gimsuxUJ' : 'gimsudv';
    expect(decodeShare(raw({ v: 1, e, f, p: '(a)\\Kb' }))).toMatchObject({
      v: 3,
      e,
      f: expect.any(String),
    });
    expect(new Set(decodeShare(raw({ v: 1, e, f, p: '' }))!.f)).toEqual(new Set(f));
  });

  it('preserves execution for every legacy compatibility flag combination', () => {
    for (const target of ['python', 'java', 'go', 'dotnet', 'rust'] as RegexEngine[]) {
      const table = ENGINE_FLAVORS[target].flags;
      for (let mask = 0; mask < 2 ** table.length; mask++) {
        const flags = table.map((f, i) => ({ ...f, enabled: !!(mask & (1 << i)) }));
        const display = flags
          .filter((f) => f.enabled)
          .map((f) => f.key)
          .join('');
        const oldExecution = toJsFlagString(flags);
        const migrated = decodeShare(
          raw({ v: 1, e: target, f: display, p: '[a-z]+|.', t: 'Aa\n中文 😀' }),
        )!;
        expect(findMatches(migrated.p, migrated.f, migrated.t!)).toEqual(
          findMatches(migrated.p, oldExecution, migrated.t!),
        );
        expect(replaceMatches(migrated.p, migrated.f, migrated.t!, 'X')).toBe(
          replaceMatches(migrated.p, oldExecution, migrated.t!, 'X'),
        );
      }
    }
  });

  it('round trips a complete v3 workspace, including empty replacement and test cases', () => {
    const payload: SharePayload = {
      v: 3,
      e: 'pcre2',
      c: 'go',
      p: '(a)\\Kb',
      f: 'g',
      t: 'ab',
      r: '',
      sr: true,
      tc: [{ id: '1', label: '中文 😀', input: 'ab', expect: 'match' }],
    };
    expect(decodeShare(encodeShare(payload))).toEqual(payload);
  });

  it.each([
    { v: 4 },
    { e: 'unknown' },
    { v: 3, e: 'python' },
    { v: 3, c: 'unknown' },
    { v: 3, f: 'x' },
    { v: 3, lf: 'x' },
    { v: 3, c: 'python', lf: 'i' },
    { p: 7 },
    { t: {} },
    { r: [] },
    { sr: 'true' },
    { tc: {} },
    { tc: [{ id: 'x', label: '', input: 1, expect: 'match' }] },
  ])('rejects malformed workspace fields: %j', (patch) => {
    expect(decodeShare(raw({ v: 1, e: 'javascript', f: 'g', p: '.', ...patch }))).toBeNull();
  });
});

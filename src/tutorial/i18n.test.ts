// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickLocale } from './i18n';

vi.mock('@/paraglide/runtime', () => ({
  baseLocale: 'en',
  locales: ['en', 'zh', 'ja'],
  getLocale: () => 'en',
}));

describe('lesson language for search entry links', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('uses the Chinese URL even when the runtime preference is English', () => {
    window.history.replaceState(null, '', '/zh?lesson=groups-capturing');
    expect(pickLocale({ en: 'English lesson', zh: '中文课程', ja: '日本語のレッスン' })).toBe(
      '中文课程',
    );
  });

  it('uses Japanese for direct entry and honors an explicit server locale', () => {
    window.history.replaceState(null, '', '/ja/learn/groups-capturing');
    const bundles = { en: 'English lesson', zh: '中文课程', ja: '日本語のレッスン' };
    expect(pickLocale(bundles)).toBe('日本語のレッスン');
    expect(pickLocale(bundles, 'zh')).toBe('中文课程');
    expect(pickLocale(bundles, 'en')).toBe('English lesson');
    window.history.replaceState(null, '', '/japanese');
    expect(pickLocale(bundles)).toBe('English lesson');
  });

  it('does not treat a pathname starting with zh as a Chinese locale', () => {
    window.history.replaceState(null, '', '/zh-other');
    expect(pickLocale({ en: 'English lesson', zh: '中文课程', ja: '日本語のレッスン' })).toBe(
      'English lesson',
    );
  });
});

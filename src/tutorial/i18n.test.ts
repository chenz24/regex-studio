// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickLocale } from './i18n';

vi.mock('@/paraglide/runtime', () => ({
  baseLocale: 'en',
  locales: ['en', 'zh'],
  getLocale: () => 'en',
}));

describe('lesson language for search entry links', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('uses the Chinese URL even when the runtime preference is English', () => {
    window.history.replaceState(null, '', '/zh?lesson=groups-capturing');
    expect(pickLocale({ en: 'English lesson', zh: '中文课程' })).toBe('中文课程');
  });

  it('does not treat a pathname starting with zh as a Chinese locale', () => {
    window.history.replaceState(null, '', '/zh-other');
    expect(pickLocale({ en: 'English lesson', zh: '中文课程' })).toBe('English lesson');
  });
});

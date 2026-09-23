// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { getAnalyticsScripts, trackPageView } from './analytics';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('strips query and share payloads from manual page views', () => {
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST');
  const gtag = vi.fn();
  vi.stubGlobal('window', { gtag });
  vi.stubGlobal('location', {
    origin: 'https://regexstudio.com',
    pathname: '/zh',
    href: 'https://regexstudio.com/zh?secret=123#encoded-input',
  });
  vi.stubGlobal('document', {
    title: 'RegexStudio',
    referrer: 'https://example.com/path?secret=456#private',
  });
  trackPageView('/zh?secret=123#encoded-input');
  expect(gtag).toHaveBeenLastCalledWith('event', 'page_view', {
    page_path: '/zh',
    page_location: 'https://regexstudio.com/zh',
    page_title: 'RegexStudio',
    page_referrer: 'https://example.com/path',
  });
  expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/secret|encoded-input|private/);
});

it('configures both providers to exclude query and hash data from page URLs', () => {
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST');
  vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'test-site');
  const scripts = getAnalyticsScripts();
  expect(scripts[0]).toMatchObject({ 'data-exclude-search': 'true', 'data-exclude-hash': 'true' });
  const initialize = new Function(
    'window',
    'location',
    'document',
    'dataLayer',
    String(scripts[scripts.length - 1].children),
  );
  const dataLayer: unknown[][] = [];
  initialize(
    {},
    {
      origin: 'https://regexstudio.com',
      pathname: '/ja',
      href: 'https://regexstudio.com/ja#payload',
    },
    { referrer: 'https://example.com?private=1' },
    dataLayer,
  );
  expect(Array.from(dataLayer[1])).toEqual([
    'config',
    'G-TEST',
    {
      send_page_view: false,
      page_location: 'https://regexstudio.com/ja',
      page_referrer: 'https://example.com',
    },
  ]);
});

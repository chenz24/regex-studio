import { getLocale, type Locale } from '@/paraglide/runtime';

/**
 * Pick the texts bundle for the current locale.
 * Falls back to the base locale (en) for any unknown value.
 */
export function pickLocale<T extends { en: unknown; zh: unknown }>(
  bundles: T,
  requestedLocale?: Locale,
): T['en'] | T['zh'] {
  // Search visits and ordinary language links may arrive without a matching
  // locale cookie. Client-loaded lessons must follow the page's URL, just as
  // the server-rendered UI does. Keep the runtime fallback for server scripts.
  const locale =
    typeof window === 'undefined'
      ? getLocale()
      : /^\/zh(?:\/|$)/.test(window.location.pathname)
        ? 'zh'
        : 'en';
  return (requestedLocale ?? locale) === 'zh' ? bundles.zh : bundles.en;
}

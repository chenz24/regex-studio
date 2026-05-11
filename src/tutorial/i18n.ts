import { getLocale } from '@/paraglide/runtime';

/**
 * Pick the texts bundle for the current locale.
 * Falls back to the base locale (en) for any unknown value.
 */
export function pickLocale<T extends { en: unknown; zh: unknown }>(bundles: T): T['en'] | T['zh'] {
  return getLocale() === 'zh' ? bundles.zh : bundles.en;
}

import { baseLocale, getLocale, locales, type Locale } from '@/paraglide/runtime';

/** Explicit server locale, or the language of the current page for client-loaded content. */
export function pickLocale<T extends Record<Locale, unknown>>(
  bundles: T,
  requestedLocale?: Locale,
): T[Locale] {
  // Direct search visits must follow the URL even when a saved preference differs.
  const segment =
    typeof window === 'undefined' ? undefined : window.location.pathname.split('/')[1];
  const locale =
    requestedLocale ??
    (typeof window === 'undefined'
      ? getLocale()
      : (locales.find((value) => value === segment) ?? baseLocale));
  return bundles[locale];
}

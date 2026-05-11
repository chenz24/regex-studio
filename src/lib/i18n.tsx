import * as React from 'react';
import { m } from '@/paraglide/messages';
import { baseLocale, type Locale, locales } from '@/paraglide/runtime';

const COOKIE_NAME = 'PARAGLIDE_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const LocaleContext = React.createContext<Locale>(baseLocale as Locale);

export function LocaleProvider({ value, children }: { value: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

export type Messages = typeof m;

/**
 * Returns a Proxy over the compiled `m` namespace that auto-binds the active
 * locale from React context to every message call.
 *
 * Usage: `const t = useT(); t.site_title();`
 */
export function useT(): Messages {
  const locale = useLocale();
  return React.useMemo(() => {
    return new Proxy({} as Messages, {
      get(_target, key: string | symbol) {
        const fn = (m as Record<string | symbol, unknown>)[key];
        if (typeof fn !== 'function') return fn;
        return (params: Record<string, unknown> = {}) =>
          (fn as (p: Record<string, unknown>, o: { locale: Locale }) => string)(params, { locale });
      },
    });
  }, [locale]);
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/**
 * URL prefix for a locale. Empty string for the base locale, `/{locale}`
 * otherwise. The base locale is canonical-without-prefix.
 */
export function localePrefix(locale: Locale): string {
  return locale === (baseLocale as Locale) ? '' : `/${locale}`;
}

/**
 * Strips a leading `/{locale}` segment from a pathname for non-base locales.
 * Returns the un-prefixed pathname plus the detected locale (or null if none).
 */
export function splitLocalePath(pathname: string): {
  locale: Locale | null;
  rest: string;
} {
  const match = pathname.match(/^\/([^/]+)(.*)$/);
  if (!match) return { locale: null, rest: pathname || '/' };
  const seg = match[1];
  if (seg === (baseLocale as string)) {
    // /en/... is non-canonical; signal it by returning the original path
    // so the caller can redirect to the un-prefixed equivalent.
    return { locale: null, rest: pathname };
  }
  if (isLocale(seg)) {
    return { locale: seg as Locale, rest: match[2] || '/' };
  }
  return { locale: null, rest: pathname };
}

/**
 * Build a path with the given locale prefix applied.
 * Example: localizedPath("/about", "zh") => "/zh/about".
 */
export function localizedPath(path: string, locale: Locale): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const prefix = localePrefix(locale);
  if (!prefix) return normalized;
  if (normalized === '/') return prefix;
  return `${prefix}${normalized}`;
}

/**
 * Persist a cookie hint and navigate to the URL of the chosen locale.
 * Uses a full-page navigation so the SSR response re-renders with the new
 * locale.
 */
export function setLocaleAndNavigate(locale: Locale) {
  if (typeof window === 'undefined') return;
  // Best-effort cookie set; fall back to document.cookie for broad support.
  try {
    const expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toUTCString();
    document.cookie = `${COOKIE_NAME}=${locale}; path=/; expires=${expires}; samesite=lax`;
  } catch {
    // ignore
  }
  const { pathname, search, hash } = window.location;
  const { rest } = splitLocalePath(pathname);
  const target = `${localizedPath(rest, locale)}${search}${hash}`;
  window.location.assign(target);
}

import { useEffect, type ReactNode } from 'react';
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  redirect,
  Scripts,
  useRouter,
} from '@tanstack/react-router';
import { getAnalyticsScripts, trackPageView } from '@/lib/analytics';
import { isLocale, LocaleProvider, localizedPath, splitLocalePath, useT } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { baseLocale, type Locale, locales } from '@/paraglide/runtime';
import appCss from '../index.css?url';

const SITE_URL =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_SITE_URL as string | undefined) ?? 'https://regexstudio.com';
const SITE_NAME = 'RegexStudio';

const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  zh: 'zh-CN',
};

const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  zh: 'zh_CN',
};

export const Route = createRootRoute({
  beforeLoad: ({ location }): { locale: Locale } => {
    const seg = location.pathname.split('/').filter(Boolean)[0];
    // /en/... is not canonical — base locale has no prefix. Redirect to the
    // un-prefixed equivalent, preserving search + hash.
    if (seg === (baseLocale as string)) {
      const prefix = `/${seg}`;
      const rest = location.href.startsWith(prefix)
        ? location.href.slice(prefix.length) || '/'
        : '/';
      throw redirect({ href: rest, replace: true });
    }
    const locale: Locale =
      seg && isLocale(seg) && seg !== (baseLocale as string)
        ? (seg as Locale)
        : (baseLocale as Locale);
    return { locale };
  },
  head: ({ match }) => {
    const locale =
      (match.context as { locale?: Locale } | undefined)?.locale ?? (baseLocale as Locale);
    const pathname = (match as { pathname?: string }).pathname ?? '/';
    const { rest: basePath } = splitLocalePath(pathname);
    const pageType: 'home' | 'unknown' = basePath === '/' ? 'home' : 'unknown';
    const isKnown = pageType !== 'unknown';

    const title = m.site_title({}, { locale });
    const description = m.site_description({}, { locale });
    const canonicalHref = `${SITE_URL}${localizedPath(basePath, locale)}`;
    const ogImage = `${SITE_URL}/og.png`;

    const meta: Array<Record<string, string>> = [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title },
      { name: 'description', content: description },
      { name: 'author', content: SITE_NAME },
      { name: 'application-name', content: SITE_NAME },
      { name: 'theme-color', content: '#ffffff' },
    ];
    if (!isKnown) {
      meta.push({ name: 'robots', content: 'noindex,follow' });
    }
    meta.push(
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonicalHref },
      { property: 'og:locale', content: OG_LOCALE[locale] },
      ...(locales as readonly Locale[])
        .filter((l) => l !== locale)
        .map((l) => ({ property: 'og:locale:alternate', content: OG_LOCALE[l] })),
      { property: 'og:image', content: ogImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
      { name: 'twitter:image:alt', content: title },
    );

    const links: Array<Record<string, string>> = [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/favicon.svg' },
    ];
    if (isKnown) {
      links.push(
        { rel: 'canonical', href: canonicalHref },
        ...(locales as readonly Locale[]).map((loc) => ({
          rel: 'alternate',
          hrefLang: HTML_LANG[loc],
          href: `${SITE_URL}${localizedPath(basePath, loc)}`,
        })),
        {
          rel: 'alternate',
          hrefLang: 'x-default',
          href: `${SITE_URL}${localizedPath(basePath, baseLocale as Locale)}`,
        },
      );
    }

    const scripts = getAnalyticsScripts();

    return { meta, links, scripts };
  },
  shellComponent: RootDocument,
  component: RouteComponent,
  notFoundComponent: RootNotFound,
});

function RouteComponent() {
  const { locale } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // Fire an initial page_view on mount, then on every successful navigation.
    trackPageView(router.state.location.pathname + router.state.location.searchStr);
    const unsub = router.subscribe('onResolved', ({ toLocation }) => {
      trackPageView(toLocation.pathname + toLocation.searchStr);
    });
    return () => {
      unsub();
    };
  }, [router]);

  return (
    <LocaleProvider value={locale}>
      <Outlet />
    </LocaleProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = Route.useRouteContext();
  return (
    <html lang={HTML_LANG[locale] ?? 'en'} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootNotFound() {
  const { locale } = Route.useRouteContext();
  const t = useT();
  return (
    <LocaleProvider value={locale}>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-600 dark:text-teal-400">
            {t.not_found_eyebrow()}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t.not_found_title()}
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {t.not_found_description()}
          </p>
          <div className="mt-6">
            <Link
              to={localizedPath('/', locale)}
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
            >
              {t.not_found_back_home()}
            </Link>
          </div>
        </div>
      </div>
    </LocaleProvider>
  );
}

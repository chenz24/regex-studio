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
import {
  isLocale,
  LocaleProvider,
  localizedPath,
  splitLocalePath,
  useLocale,
  useT,
} from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { HTML_LANG, OG_LOCALE } from '@/lib/localeMetadata';
import { baseLocale, type Locale, locales } from '@/paraglide/runtime';
import type { PublicPageMeta } from '@/content/publicCatalog';
import appCss from '../index.css?url';

const SITE_URL =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SITE_URL as
    | string
    | undefined) ?? 'https://regexstudio.com';
const SITE_NAME = 'RegexStudio';

export const Route = createRootRoute({
  beforeLoad: async ({
    location,
  }): Promise<{ locale: Locale; seoPath: string; publicPage?: PublicPageMeta }> => {
    const seg = location.pathname.split('/').filter(Boolean)[0];
    // /en/... is not canonical — base locale has no prefix. Redirect to the
    // un-prefixed equivalent, preserving search + hash.
    if (seg === (baseLocale as string)) {
      const prefix = `/${seg}`;
      const rest = `/${location.pathname.slice(prefix.length).replace(/^\/+/, '')}`;
      const suffix = location.searchStr + (location.hash ? `#${location.hash}` : '');
      throw redirect({ href: rest + suffix, replace: true, statusCode: 308 });
    }
    const locale: Locale =
      seg && isLocale(seg) && seg !== (baseLocale as string)
        ? (seg as Locale)
        : (baseLocale as Locale);
    const seoPath = location.pathname.replace(/\/+$/, '') || '/';
    const { rest } = splitLocalePath(seoPath);
    // Keep the lesson/challenge content out of the tool's initial bundle.
    const publicPage = /^\/(learn|challenges)\/[^/]+$/.test(rest)
      ? (await import('@/content/publicCatalog')).getPublicPage(rest, locale)
      : undefined;
    return { locale, seoPath, publicPage };
  },
  head: ({ match }) => {
    const locale =
      (match.context as { locale?: Locale } | undefined)?.locale ?? (baseLocale as Locale);
    // A root match always has pathname "/", even on an unknown URL. Use the
    // request location captured in beforeLoad for page-specific metadata.
    const pathname = (match.context as { seoPath?: string }).seoPath ?? '/';
    const { rest: basePath } = splitLocalePath(pathname);
    const page = (match.context as { publicPage?: PublicPageMeta }).publicPage;
    const isKnown = ['/', '/learn', '/challenges'].includes(basePath) || !!page;

    const title = page
      ? `${page.title} | ${SITE_NAME}`
      : basePath === '/learn'
        ? `${m.learn_title({}, { locale })} | ${SITE_NAME}`
        : basePath === '/challenges'
          ? `${m.content_challenges_title({}, { locale })} | ${SITE_NAME}`
          : isKnown
            ? m.site_title({}, { locale })
            : `${m.not_found_title({}, { locale })} | ${SITE_NAME}`;
    const description = page
      ? page.description
      : basePath === '/learn'
        ? m.learn_description({}, { locale })
        : basePath === '/challenges'
          ? m.content_challenges_description({}, { locale })
          : isKnown
            ? m.site_description({}, { locale })
            : m.not_found_description({}, { locale });
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
      { property: 'og:type', content: page ? 'article' : 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      ...(isKnown ? [{ property: 'og:url', content: canonicalHref }] : []),
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
  return (
    <LocaleProvider value={locale}>
      <NotFoundContent />
    </LocaleProvider>
  );
}

function NotFoundContent() {
  const locale = useLocale();
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-600 dark:text-teal-400">
          {t.not_found_eyebrow()}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t.not_found_title()}
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{t.not_found_description()}</p>
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
  );
}

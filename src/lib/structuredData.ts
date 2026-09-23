import type { PublicPageMeta } from '@/content/publicCatalog';
import { localizedPath } from '@/lib/i18n';
import { HTML_LANG } from '@/lib/localeMetadata';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

export function getStructuredData({
  origin,
  locale,
  basePath,
  description,
  page,
}: {
  origin: string;
  locale: Locale;
  basePath: string;
  description: string;
  page?: PublicPageMeta;
}): Record<string, unknown> | undefined {
  const url = (path: string) => `${origin}${localizedPath(path, locale)}`;
  if (basePath === '/') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${url('/')}#website`,
          name: 'RegexStudio',
          url: url('/'),
          inLanguage: HTML_LANG[locale],
        },
        {
          '@type': 'WebApplication',
          '@id': `${url('/')}#application`,
          name: 'RegexStudio',
          url: url('/'),
          description,
          inLanguage: HTML_LANG[locale],
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Any',
          isAccessibleForFree: true,
        },
      ],
    };
  }
  const directory = page ? (page.kind === 'lesson' ? '/learn' : '/challenges') : basePath;
  if (directory !== '/learn' && directory !== '/challenges') return;
  const items = [
    { name: 'RegexStudio', item: url('/') },
    {
      name:
        directory === '/learn'
          ? m.content_tutorials({}, { locale })
          : m.content_challenges({}, { locale }),
      item: url(directory),
    },
    ...(page ? [{ name: page.title, item: url(basePath) }] : []),
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...item,
    })),
  };
}

// Inline script content must never be able to terminate its HTML script element.
export function serializeStructuredData(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

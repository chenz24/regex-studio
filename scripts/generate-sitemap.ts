import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { getPublicPaths } from '../src/content/publicCatalog';
import { baseLocale, locales } from '../src/paraglide/runtime';
import { HTML_LANG } from '../src/lib/localeMetadata';

const mode = process.argv[2] ?? 'production';
const env = loadEnv(mode, process.cwd(), 'VITE_SITE_URL');
const origin = (
  process.env.VITE_SITE_URL ??
  env.VITE_SITE_URL ??
  'https://regexstudio.com'
).replace(/\/$/, '');
const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const entries = getPublicPaths().flatMap((path) => {
  const urls = locales.map((locale) => ({
    locale,
    url: escapeXml(
      origin + (locale === baseLocale ? path : `/${locale}${path === '/' ? '' : path}`),
    ),
  }));
  const alternates = urls.map(
    ({ locale, url }) =>
      `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[locale]}" href="${url}"/>`,
  );
  alternates.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${urls.find(({ locale }) => locale === baseLocale)!.url}"/>`,
  );
  return urls.map(
    ({ url }) => `  <url>\n    <loc>${url}</loc>\n${alternates.join('\n')}\n  </url>`,
  );
});
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
for (const path of ['public/sitemap.xml', 'dist/client/sitemap.xml'])
  writeFileSync(resolve(path), xml);
console.log(
  `Sitemap: ${entries.length} localized pages from the tutorial and challenge catalogues.`,
);

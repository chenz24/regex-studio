import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { getPublicPaths } from '../src/content/publicCatalog';

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
  const en = escapeXml(origin + path);
  const zh = escapeXml(`${origin}/zh${path === '/' ? '' : path}`);
  return [en, zh].map(
    (url) =>
      `  <url>\n    <loc>${url}</loc>\n    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>\n    <xhtml:link rel="alternate" hreflang="zh-CN" href="${zh}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>\n  </url>`,
  );
});
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
for (const path of ['public/sitemap.xml', 'dist/client/sitemap.xml'])
  writeFileSync(resolve(path), xml);
console.log(
  `Sitemap: ${entries.length} localized pages from the tutorial and challenge catalogues.`,
);

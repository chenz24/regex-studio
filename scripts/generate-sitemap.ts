import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { getPublicPage, getPublicPaths } from '../src/content/publicCatalog';
import { challengeLessons, relatedChallengeIds } from '../src/content/relatedLearning';
import { baseLocale, locales } from '../src/paraglide/runtime';
import { HTML_LANG } from '../src/lib/localeMetadata';
import { getTracks } from '../src/tutorial/registry';
import { getChallenges } from '../src/challenges/data';
import { m } from '../src/paraglide/messages';
import { updateRevisions, type Revisions } from './sitemap-revisions';

const revisionPath = resolve('scripts/sitemap-revisions.json');
const previous: Revisions = existsSync(revisionPath)
  ? JSON.parse(readFileSync(revisionPath, 'utf8'))
  : {};
const snapshots: Record<string, unknown> = {};
const localPath = (path: string, locale: string) =>
  locale === baseLocale ? path : `/${locale}${path === '/' ? '' : path}`;
for (const locale of locales) {
  const tracks = getTracks(locale);
  const challenges = getChallenges(locale);
  snapshots[localPath('/', locale)] = {
    title: m.site_title({}, { locale }),
    description: m.site_description({}, { locale }),
  };
  snapshots[localPath('/learn', locale)] = {
    title: m.learn_title({}, { locale }),
    description: m.learn_description({}, { locale }),
    tracks: tracks.map(({ id, title, description, lessons }) => ({
      id,
      title,
      description,
      lessons: lessons.map(({ id, title, summary, difficulty, estimatedMinutes }) => ({
        id,
        title,
        summary,
        difficulty,
        estimatedMinutes,
      })),
    })),
  };
  snapshots[localPath('/challenges', locale)] = {
    title: m.content_challenges_title({}, { locale }),
    description: m.content_challenges_description({}, { locale }),
    challenges: challenges.map(({ id, title, summary, difficulty }) => ({
      id,
      title,
      summary,
      difficulty,
    })),
  };
  for (const track of tracks)
    for (const lesson of track.lessons)
      snapshots[localPath(`/learn/${lesson.id}`, locale)] = {
        lesson,
        metadata: getPublicPage(`/learn/${lesson.id}`, locale),
        related: relatedChallengeIds(lesson.id),
      };
  for (const challenge of challenges)
    snapshots[localPath(`/challenges/${challenge.id}`, locale)] = {
      challenge,
      metadata: getPublicPage(`/challenges/${challenge.id}`, locale),
      related: challengeLessons[challenge.id],
    };
}
const revisions = updateRevisions(previous, snapshots, new Date().toISOString().slice(0, 10));

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
    url: escapeXml(origin + localPath(path, locale)),
  }));
  const alternates = urls.map(
    ({ locale, url }) =>
      `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[locale]}" href="${url}"/>`,
  );
  alternates.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${urls.find(({ locale }) => locale === baseLocale)!.url}"/>`,
  );
  return urls.map(
    ({ locale, url }) =>
      `  <url>\n    <loc>${url}</loc>\n    <lastmod>${revisions[localPath(path, locale)].lastmod}</lastmod>\n${alternates.join('\n')}\n  </url>`,
  );
});
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
for (const path of ['public/sitemap.xml', 'dist/client/sitemap.xml'])
  writeFileSync(resolve(path), xml);
writeFileSync(revisionPath, `${JSON.stringify(revisions, null, 2)}\n`);
console.log(
  `Sitemap: ${entries.length} localized pages from the tutorial and challenge catalogues.`,
);

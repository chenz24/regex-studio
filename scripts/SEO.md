# SEO publishing notes

`pnpm build` regenerates all localized sitemap URLs from the content catalog.
`sitemap-revisions.json` records the fingerprint and last significant content
change date for each localized page. Commit it with `public/sitemap.xml` after
content edits. Unchanged builds preserve dates; changes to one translation do not
refresh dates for every language. Initial fingerprints were recorded on
2026-09-23, when the current three-language content was released.

Fingerprints cover home metadata, directory listings, and full lesson/challenge
definitions (including reading examples), search metadata and related topic links. They exclude styling and executable
validator functions. If a significant visible change is made outside these data
sources, update the affected page's `lastmod` in the revision file explicitly.
Do not replace dates with the build timestamp on every release.

Structured data lives in `src/lib/structuredData.ts`. It uses the same localized
titles and canonical URLs as the pages. Unknown pages must remain noindex, return
404, and emit neither canonical URLs nor structured data.

`public/_headers` applies immutable caching only to Vite's content-hashed assets.
Verify these headers with Wrangler or Cloudflare; Vite preview does not interpret
Cloudflare's `_headers` file. HTML and the sitemap must not use immutable caching.
The workers.dev entry is disabled; the production custom domain remains enabled.

Reference: [Cloudflare asset headers](https://developers.cloudflare.com/workers/static-assets/headers/),
[Google sitemap dates](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[Google breadcrumbs](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb).

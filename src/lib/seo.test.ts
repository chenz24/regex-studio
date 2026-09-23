import { describe, expect, it } from 'vitest';
import { getCanonicalRedirect } from './canonicalRedirect';
import { getStructuredData, serializeStructuredData } from './structuredData';

describe('public page structured data', () => {
  it.each([
    'en',
    'zh',
    'ja',
  ] as const)('uses %s canonical URLs throughout breadcrumbs', (locale) => {
    const prefix = locale === 'en' ? '' : `/${locale}`;
    for (const [kind, directory] of [
      ['lesson', 'learn'],
      ['challenge', 'challenges'],
    ] as const) {
      const data = getStructuredData({
        origin: 'https://regexstudio.com',
        locale,
        basePath: `/${directory}/example`,
        description: 'Example',
        page: { kind, title: 'Example title', description: 'Example' },
      });
      expect(data).toMatchObject({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { position: 1, item: `https://regexstudio.com${prefix || '/'}` },
          { position: 2, item: `https://regexstudio.com${prefix}/${directory}` },
          {
            position: 3,
            name: 'Example title',
            item: `https://regexstudio.com${prefix}/${directory}/example`,
          },
        ],
      });
    }
  });

  it('does not emit metadata for unknown URLs or allow script injection', () => {
    expect(
      getStructuredData({
        origin: 'https://regexstudio.com',
        locale: 'en',
        basePath: '/missing',
        description: '',
      }),
    ).toBeUndefined();
    const maliciousTitle = '</script><script>alert(1)</script>';
    const serialized = serializeStructuredData({ name: maliciousTitle });
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized).name).toBe(maliciousTitle);
  });
});

describe('permanent URL normalization', () => {
  it.each([
    '/learn/',
    '/ja/',
    '/zh/learn/',
    '/ja/challenges/email-find/',
  ])('normalizes %s without losing query parameters', (path) => {
    const response = getCanonicalRedirect(
      new Request(`https://regexstudio.com${path}?source=guide`),
    );
    expect(response?.status).toBe(308);
    expect(response?.headers.get('location')).toBe(
      `https://regexstudio.com${path.slice(0, -1)}?source=guide`,
    );
  });

  it('leaves canonical paths, endpoints and non-GET requests alone', () => {
    for (const path of ['/', '/ja', '/learn/example', '/api/example/', '/_server/'])
      expect(getCanonicalRedirect(new Request(`https://regexstudio.com${path}`))).toBeUndefined();
    expect(
      getCanonicalRedirect(new Request('https://regexstudio.com/learn/', { method: 'POST' })),
    ).toBeUndefined();
  });
});

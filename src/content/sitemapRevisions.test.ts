import { describe, expect, it } from 'vitest';
import { updateRevisions } from '../../scripts/sitemap-revisions';

describe('sitemap content revisions', () => {
  it('keeps dates on rebuilds and changes only edited language/page entries', () => {
    const pages = {
      '/learn/example': { title: 'Example', body: 'One' },
      '/ja/learn/example': { title: '例', body: '一' },
    };
    const first = updateRevisions({}, pages, '2026-09-23');
    expect(updateRevisions(first, pages, '2026-10-01')).toEqual(first);
    const changed = updateRevisions(
      first,
      {
        ...pages,
        '/ja/learn/example': { ...pages['/ja/learn/example'], body: '二' },
        '/learn/new': { title: 'New' },
      },
      '2026-10-02',
    );
    expect(changed['/learn/example']).toEqual(first['/learn/example']);
    expect(changed['/ja/learn/example'].lastmod).toBe('2026-10-02');
    expect(changed['/learn/new'].lastmod).toBe('2026-10-02');
    expect(updateRevisions(changed, pages, '2026-10-03')).not.toHaveProperty('/learn/new');
  });
});

import { test, expect } from '@playwright/test';

const localized = (path: string, locale: 'en' | 'zh' | 'ja') =>
  locale === 'en' ? path : `/${locale}${path === '/' ? '' : path}`;

for (const locale of ['en', 'zh', 'ja'] as const) {
  test(`${locale}: all tutorials and challenges are readable and discoverable without JavaScript`, async ({
    browser,
    baseURL,
    request,
  }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    await context.route('https://**/*', (route) => route.abort());
    const page = await context.newPage();
    const entries: { path: string; heading: string }[] = [
      { path: '/', heading: 'RegexStudio' },
      {
        path: '/learn',
        heading: { en: 'Regex tutorials', zh: '正则表达式教程', ja: '正規表現チュートリアル' }[
          locale
        ],
      },
      {
        path: '/challenges',
        heading: { en: 'Regex challenges', zh: '正则表达式挑战', ja: '正規表現チャレンジ' }[locale],
      },
    ];
    for (const [directory, count] of [
      ['/learn', 21],
      ['/challenges', 11],
    ] as const) {
      await page.goto(localized(directory, locale), { waitUntil: 'domcontentloaded' });
      const links = page.locator(`main li a[href^="${localized(directory, locale)}/"]`);
      await expect(links).toHaveCount(count);
      for (const link of await links.all()) {
        const href = (await link.getAttribute('href'))!;
        entries.push({
          path: locale === 'en' ? href : href.slice(locale.length + 1),
          heading: (await link.locator('h3, h2').textContent())!,
        });
      }
    }
    const titles = new Set<string>();
    for (const entry of entries) {
      const path = localized(entry.path, locale);
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('html')).toHaveAttribute(
        'lang',
        locale === 'zh' ? 'zh-CN' : locale,
      );
      await expect(page.locator('h1')).toHaveText(entry.heading);
      const title = await page.title();
      expect(titles.has(title), title).toBe(false);
      titles.add(title);
      await expect(page.locator('link[rel=canonical]')).toHaveCount(1);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        `https://regexstudio.com${path}`,
      );
      await expect(page.locator('link[hreflang=en]')).toHaveAttribute(
        'href',
        `https://regexstudio.com${entry.path}`,
      );
      await expect(page.locator('link[hreflang="zh-CN"]')).toHaveAttribute(
        'href',
        `https://regexstudio.com${localized(entry.path, 'zh')}`,
      );
      await expect(page.locator('link[hreflang=ja]')).toHaveAttribute(
        'href',
        `https://regexstudio.com${localized(entry.path, 'ja')}`,
      );
      await expect(page.locator('link[hreflang=x-default]')).toHaveAttribute(
        'href',
        `https://regexstudio.com${entry.path}`,
      );
      await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[name=robots]')).toHaveCount(0);
      const structuredScripts = page.locator('script[type="application/ld+json"]');
      await expect(structuredScripts).toHaveCount(1);
      const structured = JSON.parse((await structuredScripts.textContent())!);
      expect(structured['@context']).toBe('https://schema.org');
      if (entry.path === '/') {
        expect(structured['@graph'].map((item: { '@type': string }) => item['@type'])).toEqual([
          'WebSite',
          'WebApplication',
        ]);
        expect(structured['@graph'][1].url).toBe(`https://regexstudio.com${path}`);
      } else {
        expect(structured['@type']).toBe('BreadcrumbList');
        const crumbs = structured.itemListElement;
        expect(crumbs).toHaveLength(entry.path.split('/').length);
        expect(crumbs.at(-1).item).toBe(`https://regexstudio.com${path}`);
        expect(crumbs.map((item: { position: number }) => item.position)).toEqual(
          crumbs.map((_: unknown, index: number) => index + 1),
        );
      }
      if (entry.path.startsWith('/learn/')) {
        expect(await page.getByTestId('reading-example').count()).toBeGreaterThan(0);
        const steps = page.locator('article > section');
        expect(await steps.count()).toBeGreaterThan(0);
        for (const step of await steps.all()) {
          await expect(step.locator('h2')).toBeVisible();
          expect((await step.textContent())!.length).toBeGreaterThan(30);
        }
      }
      if (entry.path.startsWith('/challenges/')) {
        expect(
          await page.locator(`article aside a[href^="${localized('/learn', locale)}/"]`).count(),
        ).toBeGreaterThan(0);
        await expect(
          page.getByRole('heading', {
            name: { en: 'Test cases', zh: '测试用例', ja: 'テストケース' }[locale],
            exact: true,
          }),
        ).toBeVisible();
        expect(await page.locator('article section li').count()).toBeGreaterThan(0);
      }
    }
    const response = await request.get('/sitemap.xml');
    const xml = await response.text();
    const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
    const urls = blocks.map((block) => block.match(/<loc>(.*?)<\/loc>/)?.[1]);
    expect(urls.sort()).toEqual(
      entries
        .flatMap(({ path }) =>
          ['en', 'zh', 'ja'].map(
            (language) =>
              `https://regexstudio.com${localized(path, language as 'en' | 'zh' | 'ja')}`,
          ),
        )
        .sort(),
    );
    for (const block of blocks) {
      const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(lastmod!)).toBeLessThanOrEqual(Date.now());
      for (const language of ['en', 'zh-CN', 'ja', 'x-default'])
        expect(block).toContain(`hreflang="${language}"`);
    }
    await context.close();
  });
}

test('unknown paths are real 404s without canonical metadata', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  await context.route('https://**/*', (route) => route.abort());
  const page = await context.newPage();
  for (const path of [
    '/missing',
    '/zh/missing',
    '/learn/missing',
    '/zh/learn/missing',
    '/challenges/missing',
    '/zh/challenges/missing',
    '/ja/missing',
    '/ja/learn/missing',
    '/ja/challenges/missing',
    '/de/learn',
    '/de/challenges/email-find',
  ]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), path).toBe(404);
    if (path.startsWith('/ja/'))
      await expect(page.locator('h1')).toHaveText('ページが見つかりません');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex,follow');
    await expect(page.locator('link[rel=canonical], link[rel=alternate]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  }
  await context.close();
});

test('aliases redirect permanently to the shared content', async ({ request }) => {
  for (const [from, to] of [
    ['/ja/?source=guide', '/ja?source=guide'],
    ['/learn/', '/learn'],
    ['/zh/learn/', '/zh/learn'],
    ['/ja/challenges/email-find/', '/ja/challenges/email-find'],
    ['/en?lesson=groups-capturing', '/?lesson=groups-capturing'],
    ['/en/learn/quantifiers-greedy?source=guide', '/learn/quantifiers-greedy?source=guide'],
    ['/learn/greedy-vs-lazy', '/learn/quantifiers-greedy'],
    ['/zh/learn/capture-groups', '/zh/learn/groups-capturing'],
    ['/patterns/email', '/learn/practical-email'],
    ['/ja/patterns/email', '/ja/learn/practical-email'],
    ['/ja/learn/greedy-vs-lazy', '/ja/learn/quantifiers-greedy'],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const target = new URL(response.headers().location, response.url());
    expect(target.pathname + target.search).toBe(to);
  }
});

test('reading and practice pages render without remote font downloads', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font' || /fonts\.(googleapis|gstatic)\.com/.test(request.url()))
      fontRequests.push(request.url());
  });
  for (const path of ['/ja', '/zh/learn/groups-capturing', '/learn/groups-capturing']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(fontRequests).toEqual([]);
});

test('top-right launchers offer both catalogue display modes', async ({ page }) => {
  for (const [launcher, dialogName, directory] of [
    ['Interactive tutorial', 'Interactive tutorial', '/learn'],
    ['Regex challenges', 'Regex challenges', '/challenges'],
  ]) {
    await page.goto('/');
    await page.getByTitle(launcher, { exact: true }).click();
    const dialog = page.getByRole('dialog', { name: dialogName, exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Read on a separate page', exact: false }).click();
    await expect(page).toHaveURL(new RegExp(`${directory}$`));
    await page.getByRole('link', { name: 'Practice mode', exact: false }).click();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Read on a separate page', exact: false }),
    ).toHaveAttribute('href', directory);
  }
});

test('lesson display modes retain the selected step and language', async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|#418|#425/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  await page.goto('/zh/learn/quantifiers-greedy');
  await page.getByRole('button', { name: '切换语言', exact: true }).click();
  await page.getByRole('menuitem', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/quantifiers-greedy$/);
  await expect(page.locator('h1')).toHaveText('Greedy: the default behavior');
  await page.getByRole('link', { name: 'Practice this step', exact: false }).nth(1).click();
  const dialog = page.getByRole('dialog', { name: 'Interactive tutorial', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('It overshot');
  await expect(
    page.getByRole('group', { name: 'Test String', exact: true }).locator('[contenteditable=true]'),
  ).toHaveText('<b>bold</b> and <i>italic</i> text');
  await dialog.getByRole('link', { name: 'Read on a separate page', exact: false }).click();
  await expect(page).toHaveURL(/\/learn\/quantifiers-greedy#s2$/);
  await expect(page.locator('#s2')).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Practice mode', exact: false })).toHaveAttribute(
    'href',
    '/?lesson=quantifiers-greedy&step=2',
  );
  await page.getByRole('link', { name: 'Practice mode', exact: false }).click();
  await expect(dialog).toContainText('It overshot');
  expect(hydrationErrors).toEqual([]);
});

test('challenge reading exposes original cases and optional answers, then opens the same challenge', async ({
  page,
}) => {
  await page.goto('/challenges/email-find');
  await expect(page.locator('h1')).toHaveText('Find emails in text');
  const solution = page.locator('details').filter({ hasText: 'Show reference solution' });
  await expect(solution).not.toHaveAttribute('open');
  await solution.locator('summary').click();
  await expect(solution.locator('pre')).toBeVisible();
  await page.getByRole('link', { name: 'Start this challenge', exact: false }).click();
  const dialog = page.getByRole('dialog', { name: 'Regex challenges', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Find emails in text');
  await dialog.getByRole('link', { name: 'Read on a separate page', exact: false }).click();
  await expect(page).toHaveURL(/\/challenges\/email-find$/);
});

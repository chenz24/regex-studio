import { test, expect } from '@playwright/test';

const localized = (path: string, locale: 'en' | 'zh') =>
  locale === 'en' ? path : `/zh${path === '/' ? '' : path}`;

for (const locale of ['en', 'zh'] as const) {
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
      { path: '/learn', heading: locale === 'en' ? 'Regex tutorials' : '正则表达式教程' },
      { path: '/challenges', heading: locale === 'en' ? 'Regex challenges' : '正则表达式挑战' },
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
          path: locale === 'zh' ? href.slice(3) : href,
          heading: (await link.locator('h3, h2').textContent())!,
        });
      }
    }
    const titles = new Set<string>();
    for (const entry of entries) {
      const path = localized(entry.path, locale);
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale === 'en' ? 'en' : 'zh-CN');
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
      await expect(page.locator('link[hreflang=x-default]')).toHaveAttribute(
        'href',
        `https://regexstudio.com${entry.path}`,
      );
      await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[name=robots]')).toHaveCount(0);
      if (entry.path.startsWith('/learn/')) {
        const steps = page.locator('article > section');
        expect(await steps.count()).toBeGreaterThan(0);
        for (const step of await steps.all()) {
          await expect(step.locator('h2')).toBeVisible();
          expect((await step.textContent())!.length).toBeGreaterThan(30);
        }
      }
      if (entry.path.startsWith('/challenges/')) {
        await expect(
          page.getByRole('heading', {
            name: locale === 'en' ? 'Test cases' : '测试用例',
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
          ['en', 'zh'].map(
            (language) => `https://regexstudio.com${localized(path, language as 'en' | 'zh')}`,
          ),
        )
        .sort(),
    );
    for (const block of blocks) {
      for (const language of ['en', 'zh-CN', 'x-default'])
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
    '/de/learn',
    '/de/challenges/email-find',
  ]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), path).toBe(404);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex,follow');
    await expect(page.locator('link[rel=canonical], link[rel=alternate]')).toHaveCount(0);
  }
  await context.close();
});

test('aliases redirect permanently to the shared content', async ({ request }) => {
  for (const [from, to] of [
    ['/en?lesson=groups-capturing', '/?lesson=groups-capturing'],
    ['/en/learn/quantifiers-greedy?source=guide', '/learn/quantifiers-greedy?source=guide'],
    ['/learn/greedy-vs-lazy', '/learn/quantifiers-greedy'],
    ['/zh/learn/capture-groups', '/zh/learn/groups-capturing'],
    ['/patterns/email', '/learn/practical-email'],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    const target = new URL(response.headers().location, response.url());
    expect(target.pathname + target.search).toBe(to);
  }
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

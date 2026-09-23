import { expect, test } from '@playwright/test';

test('search visits open lessons in the URL language even with an opposite saved preference', async ({
  page,
  context,
  baseURL,
}) => {
  for (const locale of ['zh', 'en', 'ja'] as const) {
    await context.addCookies([
      {
        name: 'PARAGLIDE_LOCALE',
        value: locale === 'zh' ? 'ja' : 'zh',
        url: baseURL!,
      },
    ]);
    await page.goto(`${locale === 'en' ? '' : `/${locale}`}/learn/quantifiers-greedy`);
    await page
      .getByRole('link', {
        name: { en: 'Practice mode', zh: '练习模式', ja: '練習モード' }[locale],
      })
      .click();
    const dialog = page.getByRole('dialog', {
      name: { en: 'Interactive tutorial', zh: '交互式教程', ja: '対話式チュートリアル' }[locale],
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      { en: 'See what', zh: '看看', ja: 'の一致を確認する' }[locale],
    );
    if (locale === 'ja') await expect(dialog).toContainText('1 件以上一致');
  }
});

test('Japanese language switching preserves the lesson, step and anchor across reading and practice', async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|#418|#425/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  await page.goto('/learn/quantifiers-greedy?source=guide#s2');
  await page.getByRole('button', { name: 'Switch language', exact: true }).click();
  await page.getByRole('menuitem', { name: '日本語', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/learn\/quantifiers-greedy\?source=guide#s2$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('h1')).toHaveText('貪欲一致: 量指定子の標準動作');
  await page.getByRole('link', { name: '練習モード', exact: false }).click();
  const dialog = page.getByRole('dialog', { name: '対話式チュートリアル', exact: true });
  await expect(dialog).toContainText('取りすぎてしまった');
  await dialog.getByRole('link', { name: '独立したページで読む', exact: false }).click();
  await expect(page).toHaveURL(/\/ja\/learn\/quantifiers-greedy#s2$/);
  await page.getByRole('button', { name: '言語を切り替え', exact: true }).click();
  await page.getByRole('menuitem', { name: '简体中文', exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/learn\/quantifiers-greedy#s2$/);
  expect(hydrationErrors).toEqual([]);
});

test('Japanese challenge and worked replacement open their matching practice content', async ({
  page,
}) => {
  await page.goto('/ja/challenges/email-find');
  await expect(page.locator('h1')).toHaveText('テキスト内のメールアドレスを探す');
  await page.getByRole('link', { name: 'このチャレンジを開始', exact: false }).click();
  const dialog = page.getByRole('dialog', { name: '正規表現チャレンジ', exact: true });
  await expect(dialog).toContainText('テキスト内のメールアドレスを探す');
  await expect(dialog).toContainText('段落内に 2 つのアドレス');
  await dialog.getByRole('link', { name: '独立したページで読む', exact: false }).click();
  await expect(page).toHaveURL(/\/ja\/challenges\/email-find$/);
  await page.goto('/ja/learn/groups-capturing#s3');
  const example = page.locator('#s3').getByTestId('reading-example');
  const expected = await example.getByTestId('reading-replacement').textContent();
  await example.getByRole('link', { name: 'この例を実行', exact: false }).click();
  await expect(
    page.getByRole('group', { name: '正規表現', exact: true }).locator('[contenteditable=true]'),
  ).toHaveText('(\\w+) (\\w+)');
  await page.getByRole('tab', { name: '置換', exact: true }).click();
  await expect(page.getByTestId('replacement-result')).toHaveText(expected!);
});

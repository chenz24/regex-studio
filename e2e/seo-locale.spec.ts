import { expect, test } from '@playwright/test';

test('search visits open lessons in the URL language even with an opposite saved preference', async ({
  page,
  context,
  baseURL,
}) => {
  for (const locale of ['zh', 'en'] as const) {
    await context.addCookies([
      {
        name: 'PARAGLIDE_LOCALE',
        value: locale === 'zh' ? 'en' : 'zh',
        url: baseURL!,
      },
    ]);
    await page.goto(`${locale === 'zh' ? '/zh' : ''}/learn/quantifiers-greedy`);
    await page.getByRole('link', { name: locale === 'zh' ? '练习模式' : 'Practice mode' }).click();
    const dialog = page.getByRole('dialog', {
      name: locale === 'zh' ? '交互式教程' : 'Interactive tutorial',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(locale === 'zh' ? '看看' : 'See what');
    await expect(dialog).not.toContainText(locale === 'zh' ? 'See what' : '看看');
  }
});

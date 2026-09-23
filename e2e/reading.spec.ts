import { expect, test } from '@playwright/test';

const lessons = [
  ['quantifiers-greedy', 2],
  ['quantifiers-lazy', 4],
  ['groups-capturing', 3],
  ['practical-email', 6],
] as const;

test('the four polished lessons contain complete worked examples without JavaScript in all languages', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  await context.route('https://**/*', (route) => route.abort());
  const page = await context.newPage();
  for (const prefix of ['', '/zh', '/ja']) {
    for (const [id, count] of lessons) {
      const response = await page.goto(`${prefix}/learn/${id}`, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      await expect(page.getByTestId('reading-example')).toHaveCount(count);
      await expect(page.locator('article')).not.toContainText(
        /Click "Next"|Type it into the pattern|Change the pattern to|点击"下一步"|把 pattern 改成|把它写进 pattern|下方"匹配结果"/,
      );
      await expect(
        page.getByRole('heading', {
          name:
            prefix === '/ja'
              ? '出典と参考資料'
              : prefix
                ? '参考资料与延伸阅读'
                : 'Sources and further reading',
        }),
      ).toBeVisible();
      expect(
        await page.locator('article aside a[href^="https://developer.mozilla.org/"]').count(),
      ).toBeGreaterThan(0);
      if (id === 'groups-capturing') {
        await expect(page.getByTestId('reading-replacement')).toHaveText(
          'Smith, John, Doe, Jane, Wilson, Bob',
        );
        await expect(page.locator('#s2 table tbody tr')).toHaveCount(3);
      }
      if (id === 'practical-email') {
        await expect(page.locator('#s5 figure').first().locator('ol')).toContainText(
          'alice+filter@mail.sub.example.io',
        );
        await expect(page.locator('#s2 figure ol')).toContainText('alice+filter@mail.sub');
      }
    }
  }
  await context.close();
});

test('the reading replacement opens the editor with the documented pattern, input and replacement', async ({
  page,
}) => {
  await page.goto('/zh/learn/groups-capturing#s3');
  const example = page.locator('#s3').getByTestId('reading-example');
  const expected = await example.getByTestId('reading-replacement').textContent();
  await example.getByRole('link', { name: '运行这个示例', exact: false }).click();
  await expect(
    page.getByRole('group', { name: '正则表达式', exact: true }).locator('[contenteditable=true]'),
  ).toHaveText('(\\w+) (\\w+)');
  await page.getByRole('tab', { name: '替换', exact: true }).click();
  await expect(page.getByTestId('replacement-result')).toHaveText(expected!);
});

test('the improved email example runs independently from the original step exercise', async ({
  page,
}) => {
  await page.goto('/learn/practical-email#s5');
  await page
    .locator('#s5 figure')
    .first()
    .getByRole('link', { name: 'Run this example', exact: false })
    .click();
  await expect(
    page
      .getByRole('group', { name: 'Regular expression', exact: true })
      .locator('[contenteditable=true]'),
  ).toHaveText('[\\w.+-]+@(?:[\\w-]+\\.)+[a-zA-Z]{2,}');
  await expect(page.getByTestId('match-status')).toHaveText('3 matches');
  await expect(
    page.getByRole('dialog', { name: 'Interactive tutorial', exact: true }),
  ).not.toBeVisible();
});

import { expect, test } from '@playwright/test';

test('CSV practice accepts its documented six-match example', async ({ page }) => {
  await page.goto('/?lesson=practical-csv&step=1');
  const dialog = page.getByRole('dialog', { name: 'Interactive tutorial', exact: true });
  await expect(dialog).toBeVisible();
  const editor = page
    .getByRole('group', { name: 'Regular expression', exact: true })
    .locator('[contenteditable=true]');
  // Exercise the live worker while the drawer remains mounted on narrow screens.
  await editor.fill('[^,]+', { force: true });
  await expect(page.getByTestId('match-status')).toHaveText('6 matches');
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toHaveClass(
    /bg-teal-500/,
  );
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog).toContainText('You should see 6 matches');
});

test('email challenge rejects partial subdomains and accepts complete matches', async ({
  page,
}) => {
  await page.goto('/?challenge=email-find');
  const dialog = page.getByRole('dialog', { name: 'Regex challenges', exact: true });
  await expect(dialog).toBeVisible();
  const editor = page
    .getByRole('group', { name: 'Regular expression', exact: true })
    .locator('[contenteditable=true]');
  await editor.fill('\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b', { force: true });
  await expect(dialog).toContainText('4 / 5');
  await expect(dialog).toContainText('alice+filter@mail.sub.example.io');
  await editor.fill('\\b[\\w.+-]+@(?:[\\w-]+\\.)+[a-zA-Z]{2,}\\b', { force: true });
  await expect(dialog).toContainText('All passed');
  await expect(dialog).toContainText('Solved! Your pattern:');
});

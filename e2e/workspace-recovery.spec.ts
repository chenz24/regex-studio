import { test, expect, type Page } from '@playwright/test';

const share = (state: Record<string, unknown>) =>
  `/#s=${Buffer.from(JSON.stringify({ v: 3, e: 'javascript', f: 'g', ...state })).toString('base64url')}`;
const editor = (page: Page, name = 'Regular expression') =>
  page.getByRole('group', { name, exact: true }).locator('[contenteditable=true]');
const saved = (page: Page) => {
  try {
    return JSON.parse(Buffer.from(page.url().split('#s=')[1], 'base64url').toString());
  } catch {
    // An invalid incoming hash remains until the next debounced save.
    return {};
  }
};

for (const failure of ['access', 'read', 'write'] as const) {
  test(`workspace and theme switching survive storage ${failure} failures`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript((failure) => {
      const unavailable = () => {
        throw new DOMException('Storage is unavailable', 'SecurityError');
      };
      if (failure === 'access') {
        Object.defineProperty(window, 'localStorage', { get: unavailable });
      } else {
        Storage.prototype[failure === 'read' ? 'getItem' : 'setItem'] = unavailable;
      }
    }, failure);
    await page.goto(share({ p: 'a', t: 'aaa' }));
    await expect(page.getByTestId('match-status')).toHaveText('3 matches');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Switch to light', exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await editor(page).press('ControlOrMeta+End');
    await editor(page).pressSequentially('+');
    await expect(page.getByTestId('match-status')).toHaveText('1 match');
  });
}

test('stored theme takes precedence over the system preference and survives reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(share({ p: 'a', t: 'a' }));
  await page.getByRole('button', { name: 'Switch to light', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to dark', exact: true })).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('share navigation restores the whole workspace, cancels old saves and supports back/forward', async ({
  page,
}) => {
  await page.goto(
    share({
      p: 'a',
      t: 'aaa',
      r: 'X',
      sr: true,
      c: 'python',
      tc: [{ id: 'saved', label: 'Saved test', input: 'a', expect: 'match' }],
    }),
  );
  await expect(page.getByTestId('match-status')).toHaveText('3 matches');
  await editor(page, 'Test String').press('ControlOrMeta+End');
  await editor(page, 'Test String').pressSequentially('a');
  await expect.poll(() => saved(page).t).toBe('aaaa');

  // Leave while this edit still has a debounced save queued.
  await editor(page).press('ControlOrMeta+End');
  await editor(page).pressSequentially('+');
  await page.goto(share({ e: 'pcre2', p: '(?<=a)b', f: '', t: 'ab' }));
  await expect(editor(page)).toHaveText('(?<=a)b');
  await expect(page.getByTestId('match-status')).toHaveText('1 match');
  await page.getByRole('tab', { name: 'Replace', exact: true }).click();
  await expect(page.getByPlaceholder('Replacement string (supports $1, $2, $& etc.)')).toHaveValue(
    '',
  );

  // A subsequent save proves the store also dropped the old optional fields.
  await editor(page, 'Test String').press('ControlOrMeta+End');
  await editor(page, 'Test String').pressSequentially('b');
  await expect.poll(() => saved(page).t).toBe('abb');
  expect(saved(page)).toMatchObject({ e: 'pcre2', p: '(?<=a)b', f: '' });
  for (const key of ['r', 'c', 'lf', 'tc']) expect(saved(page)[key]).toBeUndefined();

  await page.goBack();
  await expect(editor(page)).toHaveText('a');
  await expect(editor(page, 'Test String')).toHaveText('aaaa');
  await expect(page.getByTestId('match-status')).toHaveText('4 matches');
  await page.goForward();
  await expect(editor(page)).toHaveText('(?<=a)b');
  await expect(editor(page, 'Test String')).toHaveText('abb');
  await expect(page.getByTestId('match-status')).toHaveText('1 match');

  await page.goto('/#s=invalid');
  await expect(editor(page)).toHaveText('(?<=a)b');
  await editor(page, 'Test String').press('ControlOrMeta+End');
  await editor(page, 'Test String').pressSequentially('c');
  await expect.poll(() => saved(page).t).toBe('abbc');
});

test('opening a share leaves a lesson without keeping its restoration snapshot', async ({
  page,
}) => {
  await page.goto(share({ p: 'original', t: 'original' }));
  await page.getByTitle('Interactive tutorial', { exact: true }).click();
  await page.getByRole('button', { name: /Literals:/ }).click();
  await expect(page.getByTitle('Back to catalog (restores editor)', { exact: true })).toBeVisible();
  await page.goto(share({ p: 'shared', t: 'shared' }));
  await expect(editor(page)).toHaveText('shared');
  await expect(
    page.getByRole('dialog', { name: 'Interactive tutorial', exact: true }),
  ).toBeHidden();
  await page.getByTitle('Interactive tutorial', { exact: true }).click();
  await page.getByRole('button', { name: /Literals:/ }).click();
  await page.getByTitle('Back to catalog (restores editor)', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(editor(page)).toHaveText('shared');
});

for (const entry of [
  { query: 'lesson=basics-literals', chunk: 'registry-' },
  { query: 'challenge=email-find', chunk: 'data-' },
  { query: 'challenge=missing-challenge', chunk: 'data-' },
]) {
  test(`a late ${entry.query} load cannot replace a new shared workspace`, async ({ page }) => {
    let release!: () => void;
    let started!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(`**/assets/${entry.chunk}*.js`, async (route) => {
      started();
      await held;
      await route.continue();
    });
    await page.goto(`/?${entry.query}`, { waitUntil: 'domcontentloaded' });
    await requested;
    await expect(editor(page)).toBeVisible();
    const shared = share({ p: 'SHARED', t: 'SHARED', r: 'X' }).slice(1);
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, shared);
    await expect(editor(page)).toHaveText('SHARED');
    await expect(page.getByTestId('match-status')).toHaveText('1 match');
    const downloaded = page.waitForResponse((response) =>
      response.url().includes(`/assets/${entry.chunk}`),
    );
    release();
    await (await downloaded).finished();
    // Give the import continuation, effects and debounced URL save time to run.
    await page.waitForTimeout(700);
    await expect(editor(page)).toHaveText('SHARED');
    await expect(editor(page, 'Test String')).toHaveText('SHARED');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(saved(page)).toMatchObject({ p: 'SHARED', t: 'SHARED', r: 'X' });
  });
}

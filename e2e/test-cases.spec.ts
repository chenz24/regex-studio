import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const rows = (page: Page) => page.getByTestId('test-case');
const patternEditor = (page: Page) =>
  page
    .getByRole('group', { name: 'Regular expression', exact: true })
    .locator('[contenteditable=true]');
async function open(page: Page, state: Record<string, unknown> = {}) {
  await page.goto(
    `/en#s=${Buffer.from(JSON.stringify({ v: 3, e: 'javascript', p: '(a)', f: 'g', t: 'other', tc: [{ id: '1', label: 'Sample', input: 'a', expect: 'match' }], ...state })).toString('base64url')}`,
  );
  await expect(patternEditor(page)).toHaveText(String(state.p ?? '(a)'));
  await page.getByRole('tab', { name: /^Tests/ }).click();
  await expect(rows(page)).toHaveCount(1);
  await rows(page).locator('summary').click();
}
async function setPattern(page: Page, value: string) {
  await patternEditor(page).press('ControlOrMeta+a');
  await patternEditor(page).press('Backspace');
  await patternEditor(page).pressSequentially(value);
  await expect(patternEditor(page)).toHaveText(value);
}
async function settled(page: Page, status = 'pass') {
  await expect(rows(page).first()).toHaveAttribute('data-status', status);
}
const setExpected = (page: Page) =>
  page.getByRole('button', { name: 'Set current result as expected', exact: true });
const filter = (page: Page) => page.getByRole('combobox', { name: 'Filter test cases' });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('round trips exported test sets larger than 2 MB through file import', async ({ page }) => {
  const cases = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    label: `Large input ${i}`,
    input: 'a'.repeat(100_001),
    expect: 'noMatch',
  }));
  let file = Buffer.from(JSON.stringify({ format: 'regexstudio-tests', version: 1, cases }));
  expect(file.byteLength).toBeGreaterThan(2_000_000);
  for (let round = 0; round < 2; round++) {
    await page.goto('about:blank');
    await page.goto(
      `/en#s=${Buffer.from(JSON.stringify({ v: 3, e: 'javascript', p: '^z', f: '', t: '' })).toString('base64url')}`,
    );
    await expect(patternEditor(page)).toHaveText('^z');
    await page.getByRole('tab', { name: /^Tests/ }).click();
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'large-tests.json', mimeType: 'application/json', buffer: file });
    await expect(rows(page)).toHaveCount(cases.length);
    await expect(page.getByRole('alert').filter({ hasText: 'Could not import' })).toHaveCount(0);
    const inputPreview = rows(page)
      .first()
      .getByRole('button', { name: 'Edit test input', exact: true });
    expect((await inputPreview.innerText()).length).toBeLessThan(2_200);
    await expect(inputPreview).toContainText('Preview truncated');
    await inputPreview.click();
    const fullInput = rows(page)
      .first()
      .getByRole('textbox', { name: 'Edit test input', exact: true });
    await expect(fullInput).toHaveValue(cases[0].input);
    await fullInput.press('Tab');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const download = await downloadPromise;
    file = await readFile((await download.path())!);
    expect(
      JSON.parse(file.toString()).cases.map(
        ({ id: _id, ...rest }: Record<string, unknown>) => rest,
      ),
    ).toEqual(cases.map(({ id: _id, ...rest }) => rest));
  }
});

test('saves native lookbehind captures, reloads expectations, and shows changed/failed cases', async ({
  page,
}) => {
  await open(page, {
    p: '.+(?<=(.+)(.+))',
    tc: [{ id: '1', label: 'Lookbehind', input: 'bba', expect: 'match' }],
  });
  await settled(page);
  await setExpected(page).click();
  await expect(
    rows(page).getByRole('checkbox', { name: 'Capture groups', exact: true }),
  ).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            new TextDecoder().decode(
              Uint8Array.from(
                atob(location.hash.slice(3).replace(/-/g, '+').replace(/_/g, '/')),
                (c) => c.charCodeAt(0),
              ),
            ),
          ).tc[0].assertions?.captures?.[0]?.[1]?.value,
      ),
    )
    .toBe('ba');
  await page.reload();
  await page.getByRole('tab', { name: /^Tests/ }).click();
  await settled(page);
  await setPattern(page, '.+(?<=(.)(.))');
  await settled(page, 'fail');
  await expect(page.getByTestId('test-differences')).toContainText('Capture groups');
  await filter(page).selectOption('changed');
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset comparison baseline' }).click();
  await expect(rows(page)).toHaveCount(0);
  await filter(page).selectOption('failed');
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Use as test string', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Test String', exact: true }).locator('[contenteditable=true]'),
  ).toHaveText('bba');
  await rows(page).screenshot({ path: test.info().outputPath('assertion-differences.png') });
});

test('exports and imports native PCRE2 captures and replacement expectations without losing empty or unset groups', async ({
  page,
}) => {
  await open(page, {
    e: 'pcre2',
    p: '(?<prefix>foo)\\K(?<empty>)(?<missing>z)?bar',
    r: `\${prefix}:$0`,
    tc: [{ id: '1', label: 'PCRE2 captures', input: '😀foobar', expect: 'match' }],
  });
  await settled(page);
  await rows(page).getByRole('checkbox', { name: 'Replacement output', exact: true }).check();
  await settled(page, 'fail');
  await filter(page).selectOption('changed');
  await expect(rows(page)).toHaveCount(0);
  await filter(page).selectOption('all');
  await rows(page).locator('summary').click();
  await setExpected(page).click();
  await settled(page);
  await expect(page.getByTestId('test-actual')).toContainText('😀foofoo:bar');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloadPromise;
  const file = await readFile((await download.path())!);
  const data = JSON.parse(file.toString());
  expect(data.cases[0].assertions.captures[0]).toEqual([
    { index: 1, name: 'prefix', value: 'foo', start: 2, end: 5 },
    { index: 2, name: 'empty', value: '', start: 5, end: 5 },
    { index: 3, name: 'missing', value: null, start: -1, end: -1 },
  ]);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'tests.json', mimeType: 'application/json', buffer: file });
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toHaveAttribute('data-status', 'pass');
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ ...data, cases: [{ ...data.cases[0], assertions: { count: -1 } }] }),
    ),
  });
  await expect(page.getByRole('alert').filter({ hasText: 'Could not import' })).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
});

test('asserts zero-width matches and replacements on empty input', async ({ page }) => {
  await open(page, {
    p: '^',
    r: 'X',
    t: '',
    tc: [
      {
        id: '1',
        label: 'Empty input',
        input: '',
        expect: 'match',
        assertions: { count: 1, texts: [''], ranges: [[0, 0]], captures: [[]], replacement: 'X' },
      },
    ],
  });
  await settled(page);
  await expect(page.getByTestId('test-actual')).toContainText('"replacement": "X"');
  await page.getByRole('button', { name: 'Snapshot', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toHaveAttribute('data-status', 'pass');
});

test('counts beyond the detail limit but withholds incomplete snapshots and detail verdicts', async ({
  page,
}) => {
  await open(page, {
    p: '(a)',
    tc: [
      {
        id: '1',
        label: 'Limited details',
        input: 'a'.repeat(101),
        expect: 'match',
        assertions: { count: 101 },
      },
    ],
  });
  await settled(page);
  await expect(setExpected(page)).toBeDisabled();
  await rows(page).getByRole('checkbox', { name: 'Match texts', exact: true }).check();
  await settled(page, 'inconclusive');
  await expect(rows(page)).toContainText('Result limit reached');
  await filter(page).selectOption('unsettled');
  await expect(rows(page)).toHaveCount(1);
});

test('keeps drafts separate from saved assertions and rejects invalid formats', async ({
  page,
}) => {
  await open(page);
  await settled(page);
  await rows(page).getByRole('checkbox', { name: 'Match count', exact: true }).check();
  const value = rows(page).getByRole('textbox', { name: 'Expected Match count', exact: true });
  await value.fill('-1');
  await expect(rows(page)).toContainText('Unsaved draft');
  await page.getByRole('button', { name: 'Save expectation', exact: true }).click();
  await expect(rows(page).getByRole('alert')).toContainText('Not saved');
  await settled(page);
  await value.fill('2');
  await page.getByRole('button', { name: 'Save expectation', exact: true }).click();
  await settled(page, 'fail');
  await expect(page.getByTestId('test-differences')).toContainText('Match count');
  await setExpected(page).click();
  await settled(page);
});

test('does not snapshot stale PCRE2 results while real WASM is pending', async ({
  page,
  context,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/*.wasm', async (route) => {
    await gate;
    await route.continue();
  });
  await open(page, {
    e: 'pcre2',
    p: '(a)',
    tc: [
      {
        id: '1',
        label: 'Pending engine',
        input: 'a',
        expect: 'match',
        assertions: { texts: ['a'] },
      },
    ],
  });
  await settled(page, 'inconclusive');
  await expect(setExpected(page)).toBeDisabled();
  await setPattern(page, '(b)');
  release();
  await settled(page, 'fail');
  await expect(setExpected(page)).toBeEnabled();
  await expect(page.getByTestId('test-actual')).toContainText('"count": 0');
});

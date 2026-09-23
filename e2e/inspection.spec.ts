import { editorKey } from './editor-keys';
import { test, expect, type Page } from '@playwright/test';

const patternEditor = (page: Page) =>
  page
    .getByRole('group', { name: 'Regular expression', exact: true })
    .locator('[contenteditable=true]');
const source = (page: Page) => page.locator('.cm-source-inspection');
const subject = (page: Page) => page.locator('.cm-subject-inspection');
const capture = (page: Page, index: number) =>
  page.locator(`[data-testid="inspect-capture"][data-group-index="${index}"]`).first();
async function sourceText(page: Page, expected: string) {
  await expect
    .poll(() =>
      source(page)
        .allTextContents()
        .then((parts) => parts.join('')),
    )
    .toBe(expected);
}
async function subjectText(page: Page, expected: string) {
  await expect
    .poll(() =>
      subject(page)
        .allTextContents()
        .then((parts) => parts.join('')),
    )
    .toBe(expected);
}
async function open(page: Page, state: Record<string, unknown>, tab = 'Matches') {
  await page.goto(
    `/en#s=${Buffer.from(JSON.stringify({ v: 3, e: 'javascript', f: 'g', ...state })).toString('base64url')}`,
  );
  await expect(patternEditor(page)).toHaveText(String(state.p));
  await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
  await expect(page.getByTestId('match-status')).toHaveText(/\d+ match(?:es)?/);
}
async function setPattern(page: Page, value: string) {
  await patternEditor(page).press(await editorKey(page, 'a'));
  await patternEditor(page).press('Backspace');
  await patternEditor(page).pressSequentially(value);
  await expect(patternEditor(page)).toHaveText(value);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('links equal captures by number, preserves unset/empty groups, and clears stale selections', async ({
  page,
}) => {
  const p = '(?<first>ab)(?<second>ab)(c)?()';
  await open(page, { p, t: 'xabab' });
  await capture(page, 2).focus();
  await capture(page, 2).press('Enter');
  await expect(capture(page, 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(capture(page, 2)).toBeFocused();
  await sourceText(page, '(?<second>ab)');
  await subjectText(page, 'ab');
  await expect(subject(page).first()).toHaveAttribute('data-start', '3');
  await expect(subject(page).first()).toHaveAttribute('data-end', '5');
  await expect(page.locator('svg g[data-inspected=true]')).toHaveCount(1);
  await capture(page, 3).click();
  await expect(capture(page, 3)).toContainText('Did not participate');
  await expect(subject(page)).toHaveCount(0);
  await sourceText(page, '(c)');
  await expect(page.getByRole('button', { name: 'Show test text', exact: true })).toBeDisabled();
  await capture(page, 4).click();
  await expect(subject(page)).toHaveAttribute('data-position', '5');
  await sourceText(page, '()');
  await setPattern(page, '(x)');
  await expect(source(page)).toHaveCount(0);
  await expect(subject(page)).toHaveCount(0);
  await expect(page.locator('svg g[data-inspected=true]')).toHaveCount(0);
});

test('selects results from the test text and diagram nodes from a source caret', async ({
  page,
}) => {
  await open(page, { p: '(ab)(cd)', t: 'abcd' }, 'Debugger');
  await page.locator('.cm-match-0').first().click();
  await expect(page.getByRole('tab', { name: /^Matches/ })).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('inspect-match').first()).toHaveAttribute('aria-pressed', 'true');
  await subjectText(page, 'abcd');
  await patternEditor(page).press(await editorKey(page, 'a'));
  await patternEditor(page).press('ArrowLeft');
  await expect(source(page)).toHaveAttribute('data-position', '0');
  await expect(page.locator('svg g[data-inspected=true]')).toHaveCount(1);
  await expect(subject(page)).toHaveCount(0);
});

test('locates PCRE2 captures before reset-start using UTF-16 offsets', async ({ page }) => {
  await open(page, { e: 'pcre2', p: '(😀foo)\\Kbar', t: '😀foobar', f: 'gu' });
  await capture(page, 1).click();
  await sourceText(page, '(😀foo)');
  await subjectText(page, '😀foo');
  await expect(subject(page).first()).toHaveAttribute('data-start', '0');
  await expect(subject(page).last()).toHaveAttribute('data-end', '5');
  await page.getByTestId('inspect-match').first().click();
  await subjectText(page, 'bar');
  await expect(subject(page).first()).toHaveAttribute('data-start', '5');
  await page.screenshot({ path: test.info().outputPath('result-linking.png'), fullPage: true });
});

test('selects empty PCRE2 matches independently of a nonempty match at the same start', async ({
  page,
}) => {
  await open(page, { e: 'pcre2', p: '(?:|a)', t: 'a' });
  await expect(page.getByTestId('inspect-match')).toHaveCount(3);
  await page.locator('.cm-match-1').click();
  await expect(page.getByTestId('inspect-match').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await subjectText(page, 'a');
  await page.locator('.cm-empty-match[data-position="0"]').click();
  await expect(page.getByTestId('inspect-match').nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(subject(page)).toHaveAttribute('data-position', '0');
  await page.locator('.cm-empty-match[data-position="1"]').click();
  await expect(page.getByTestId('inspect-match').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(subject(page)).toHaveAttribute('data-position', '1');
});

test('shows all branch-reset definitions and does not fabricate unsupported source mappings', async ({
  page,
}) => {
  await open(page, { e: 'pcre2', p: '(?|(a)|(b))', t: 'b' });
  await capture(page, 1).click();
  await sourceText(page, '(a)(b)');
  await expect(page.getByRole('status').filter({ hasText: 'multiple definitions' })).toBeVisible();
  await expect(page.locator('svg g[data-inspected=true]')).toHaveCount(2);
  await setPattern(page, '(?C1)(?<x>b)');
  await expect(capture(page, 1)).toBeEnabled();
  await capture(page, 1).click();
  await subjectText(page, 'b');
  await expect(source(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show source', exact: true })).toBeDisabled();
  await expect(
    page.getByText('this pattern has no supported source mapping', { exact: false }),
  ).toBeVisible();
});

test('links native PCRE2 steps to source and diagram, including the final EOF position', async ({
  page,
}) => {
  const p = '(foo)\\Kbar';
  await open(page, { e: 'pcre2', p, t: 'foobar' }, 'Debugger');
  await page.getByRole('checkbox', { name: 'Follow steps in editors', exact: true }).check();
  await page.locator('button[data-step]').filter({ hasText: 'Before \\K' }).first().click();
  await sourceText(page, '\\K');
  await expect(page.locator('svg g[data-inspected=true]')).toHaveCount(1);
  await expect(subject(page)).toHaveAttribute('data-position', '3');
  await page.getByTitle(/Last step/).click();
  await expect(source(page)).toHaveAttribute('data-position', String(p.length));
  await subjectText(page, 'bar');
  await expect(page.locator('svg g[data-inspected=true]')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Follow steps in editors', exact: true }).uncheck();
  await expect(source(page)).toHaveCount(0);
  await expect(subject(page)).toHaveCount(0);
});

test('locates native trace source even when visual parsing is unavailable', async ({ page }) => {
  await open(page, { e: 'pcre2', p: '(?C1)foo', t: 'foo' }, 'Debugger');
  await page.getByRole('checkbox', { name: 'Follow steps in editors', exact: true }).check();
  await page.locator('button[data-step]').filter({ hasText: 'Before f' }).first().click();
  await sourceText(page, 'f');
  await expect(page.locator('svg g[data-inspected=true]')).toHaveCount(0);
  await page.getByRole('tab', { name: /^Matches/ }).click();
  await expect(source(page)).toHaveCount(0);
});

test('links JavaScript steps without intercepting editor arrow keys or retaining an old trace', async ({
  page,
}) => {
  await open(page, { p: '(ab)', t: 'ab' }, 'Debugger');
  await page.getByRole('checkbox', { name: 'Follow steps in editors', exact: true }).check();
  await page
    .locator('button[data-step]')
    .filter({ hasText: 'Enter capturing group' })
    .first()
    .click();
  await sourceText(page, '(ab)');
  await expect(subject(page)).toHaveAttribute('data-position', '0');
  const current = await page.locator('button[aria-current=step]').getAttribute('data-step');
  await patternEditor(page).press('ArrowRight');
  await expect(page.locator('button[aria-current=step]')).toHaveAttribute('data-step', current!);
  await page.getByRole('tab', { name: /^Matches/ }).click();
  await capture(page, 1).click();
  const text = page
    .getByRole('group', { name: 'Test String', exact: true })
    .locator('[contenteditable=true]');
  await text.press(await editorKey(page, 'a'));
  await text.pressSequentially('xx');
  await expect(source(page)).toHaveCount(0);
  await expect(subject(page)).toHaveCount(0);
});

test('explicit text navigation reveals a distant capture without moving editor focus', async ({
  page,
}) => {
  await open(page, { p: '(target)', t: `${'line\n'.repeat(120)}target` });
  await capture(page, 1).click();
  await page.getByRole('button', { name: 'Show test text', exact: true }).click();
  await subjectText(page, 'target');
  await expect(subject(page)).toBeInViewport();
  await expect(page.locator('[contenteditable=true]:focus')).toHaveCount(0);
});

test('keeps inspection on resize and gives narrow screens full-width editors and section navigation', async ({
  page,
}) => {
  await open(page, { p: '(ab)', t: 'ab' });
  await capture(page, 1).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  const text = page.getByRole('group', { name: 'Test String', exact: true });
  await expect.poll(async () => (await text.boundingBox())?.width ?? 0).toBeGreaterThan(320);
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toBeVisible();
  await expect(capture(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show source', exact: true }).click();
  await expect(patternEditor(page)).toBeInViewport();
  await sourceText(page, '(ab)');
  await page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'Tools', exact: true })
    .click();
  await expect(capture(page, 1)).toBeInViewport();
  await expect(page.locator('[contenteditable=true]:focus')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toHaveCount(0);
  await expect(capture(page, 1)).toHaveAttribute('aria-pressed', 'true');
});

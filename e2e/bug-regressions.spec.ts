import { test, expect, type Page } from '@playwright/test';

const editor = (page: Page) =>
  page
    .getByRole('group', { name: 'Regular expression', exact: true })
    .locator('[contenteditable=true]');
const textEditor = (page: Page) =>
  page.getByRole('group', { name: 'Test String', exact: true }).locator('[contenteditable=true]');
const share = (state: Record<string, unknown>) =>
  `/#s=${Buffer.from(JSON.stringify({ v: 3, e: 'javascript', p: 'a', f: 'g', t: 'abc', ...state })).toString('base64url')}`;

async function open(page: Page, state: Record<string, unknown>) {
  await page.goto(share(state));
  await expect(editor(page)).toHaveText(String(state.p ?? 'a'));
}

test('lesson navigation resets hints and restores the original replacement template', async ({
  page,
}) => {
  await open(page, { p: '(a)', t: 'abc', r: 'ORIGINAL', sr: true });
  await page.getByTitle('Interactive tutorial', { exact: true }).click();
  await page.getByRole('button', { name: /Literals:/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Interactive tutorial', exact: true });
  await drawer.getByRole('button', { name: 'Need a hint? (1/1)', exact: true }).click();
  await drawer.getByRole('button', { name: /Step 3:/ }).click();
  await expect(
    drawer.getByText('You need some notion of "word boundary".', { exact: true }),
  ).toBeHidden();
  await expect(
    drawer.getByRole('button', { name: 'Need a hint? (1/2)', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Replace', exact: true }).click();
  const replacement = page.getByPlaceholder('Replacement string (supports $1, $2, $& etc.)');
  await replacement.fill('EXERCISE');
  await page.getByTitle('Interactive tutorial', { exact: true }).click();
  await page.getByRole('button', { name: /Literals:/ }).click();
  await page.getByTitle('Back to catalog (restores editor)', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(editor(page)).toHaveText('(a)');
  await expect(replacement).toHaveValue('ORIGINAL');
  await expect(page.getByTestId('replacement-result')).toHaveText('ORIGINALbc');
});

test('duplicate group names use the branch that actually matched', async ({ page }) => {
  for (const [pattern, text] of [
    [String.raw`(?:(?<x>a)|(?<x>b))\k<x>`, 'aa'],
    [String.raw`(?:(?<x>a)|(?<x>b))\k<x>`, 'bb'],
    [String.raw`(?:(?<x>a)|(?<x>b))\k<x>`, 'ab'],
    [String.raw`(?:(?<x>a)|(?<x>b))+\k<x>$`, 'baa'],
    [String.raw`(?<=\k<x>(?:(?<x>a)|(?<x>b)))c`, 'bbc'],
  ]) {
    await page.goto('about:blank');
    await open(page, { p: `(${pattern})`, f: '', t: text });
    const native = await page.evaluate(
      ({ pattern, text }) => new RegExp(pattern).exec(text)?.[0] ?? null,
      { pattern, text },
    );
    await expect(page.getByTestId('match-status')).toHaveText(
      native === null ? '0 matches' : '1 match',
    );
    await page.getByTitle('Last step', { exact: true }).click();
    await expect(page.getByTestId('debugger-current-step')).toContainText(
      native === null ? 'failed' : `captured "${native}"`,
    );
  }
});

test('exported JavaScript escapes Unicode line terminators in the pattern', async ({ page }) => {
  const pattern = 'a\u2028b';
  await open(page, { p: pattern, t: pattern });
  await expect(page.getByTestId('match-status')).toHaveText('1 match');
  await page.getByRole('tab', { name: 'Code Gen', exact: true }).click();
  const code = await page.getByRole('tabpanel').locator('code').innerText();
  const count = await page.evaluate(
    (code) => new Function(`${code}\nreturn matches.length;`)(),
    code,
  );
  expect(count).toBe(1);
});

test('merged diagram literals remain editable through repeated edits', async ({ page }) => {
  await open(page, { p: '^abc$', f: '', t: 'abc' });
  await page.getByRole('button', { name: 'Edit "abc"', exact: true }).click();
  await expect(page.getByText('Edit Node', { exact: true })).toBeVisible();
  for (const [before, after] of [
    ['abc', 'longer'],
    ['longer', 'xy'],
  ]) {
    await page.getByRole('button', { name: `${before} · pick or type…` }).click();
    const input = page.getByPlaceholder('Type a replacement or pick below…');
    await input.fill(after);
    await input.press('Enter');
    await expect(editor(page)).toHaveText(`^${after}$`);
    await expect(page.getByText('Edit Node', { exact: true })).toBeVisible();
  }
});

test('scoped modifiers agree with native browser matching through nesting and backtracking', async ({
  page,
}) => {
  for (const [pattern, flags, text] of [
    ['(?i:a)', '', 'A'],
    ['(?i:a(?-i:b)c)', '', 'AbC'],
    ['(?i:a|ab)c', '', 'ABc'],
    ['(?i:a+)a', '', 'AAa'],
    [String.raw`(?<letter>a)(?i:\k<letter>)`, '', 'aA'],
    [String.raw`(?i:\bK\b)`, 'u', 'K'],
    ['(?s:a.b)', '', 'a\rb'],
    ['(?m:^b$)', '', 'a\rb\nc'],
  ]) {
    await page.goto('about:blank');
    await open(page, { p: `(${pattern})`, f: flags, t: text });
    const native = await page.evaluate(
      ({ pattern, flags, text }) => new RegExp(pattern, flags).exec(text)?.[0],
      { pattern, flags, text },
    );
    expect(native).toBeDefined();
    await expect(page.getByTestId('match-status')).toHaveText('1 match');
    await page.getByTitle('Last step', { exact: true }).click();
    await expect(page.getByTestId('debugger-current-step')).toContainText(`captured "${native}"`);
  }
  await page.goto('about:blank');
  await open(page, { p: '(?i:a+)a', f: '', t: 'AAA' });
  await expect(page.getByTestId('match-status')).toHaveText('0 matches');
  await page.getByTitle('Last step', { exact: true }).click();
  await expect(page.getByTestId('debugger-current-step')).toContainText('failed');
});

test('Unicode and CR line boundaries agree with real matching in the debugger', async ({
  page,
}) => {
  await open(page, { p: '(😀+)', f: 'u', t: '😀😀' });
  await expect(page.getByTestId('match-status')).toHaveText('1 match');
  await page.getByTitle('Last step', { exact: true }).click();
  await expect(page.getByTestId('debugger-current-step')).toContainText('captured "😀😀"');
  await page.goto('about:blank');
  await open(page, { p: '^b', f: 'm', t: 'a\rb' });
  await expect(page.getByTestId('match-status')).toHaveText('1 match');
  await page.getByTitle('Last step', { exact: true }).click();
  await expect(page.getByTestId('debugger-current-step')).toContainText('matched "b"');
});

test('empty replacement stays empty in generated code', async ({ page }) => {
  await open(page, { r: '' });
  await page.getByRole('tab', { name: 'Replace', exact: true }).click();
  await expect(page.getByTestId('replacement-result')).toHaveText('bc');
  await page.getByRole('tab', { name: 'Code Gen', exact: true }).click();
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByRole('tabpanel').locator('code')).toContainText("const replacement = '';");
});

test('Unicode sets and legacy identity escapes agree with the browser engine', async ({ page }) => {
  for (const [pattern, flags, text] of [
    ['([a&&[ab]])', 'v', 'a'],
    [String.raw`([\q{ab|cd}])`, 'v', 'ab'],
    [String.raw`([\q{a|ab}]b)`, 'v', 'ab'],
    [String.raw`(\u{2})`, '', 'uu'],
    [String.raw`(\k<a>)`, '', 'k<a>'],
  ]) {
    await page.goto('about:blank');
    await open(page, { p: pattern, f: flags, t: text });
    await expect(page.getByTestId('match-status')).toHaveText('1 match');
    await page.getByTitle('Last step', { exact: true }).click();
    await expect(page.getByTestId('debugger-current-step')).toContainText(`captured "${text}"`);
  }
});

test('tutorial step navigation and consecutive lessons preserve the correct workspace', async ({
  page,
}) => {
  await open(page, { p: 'ORIGINAL_WORKSPACE', t: 'original test text' });
  const drawer = page.getByRole('dialog', { name: 'Interactive tutorial', exact: true });
  await page.getByTitle('Interactive tutorial', { exact: true }).click();
  await drawer.getByRole('button', { name: /Dot and escapes: / }).click();
  await drawer.getByRole('button', { name: /^Step 2:/ }).click();
  await expect(textEditor(page)).toHaveText('version 1.2.3 build 4.5');
  await drawer.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(editor(page)).toHaveText('a.b');
  await expect(textEditor(page).locator('.cm-line')).toHaveText(['a', 'b a b axb']);
  await drawer.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(textEditor(page)).toHaveText('version 1.2.3 build 4.5');
  await drawer.getByRole('button', { name: /^Step 4:/ }).click();
  await expect(editor(page)).toHaveText('a.b');
  await page.keyboard.press('Escape');
  await page.getByTitle('Interactive tutorial', { exact: true }).click();
  await drawer.getByRole('button', { name: /Anchors: match only/ }).click();
  await drawer.getByTitle('Back to catalog (restores editor)', { exact: true }).click();
  await expect(editor(page)).toHaveText('ORIGINAL_WORKSPACE');
  await expect(textEditor(page)).toHaveText('original test text');
});

test('code generation carries non-global replacement scope into Python and Ruby', async ({
  page,
}) => {
  await open(page, { p: 'a', f: '', t: 'aaa', r: 'X' });
  await page.getByRole('tab', { name: 'Replace', exact: true }).click();
  await expect(page.getByTestId('replacement-result')).toHaveText('Xaa');
  await page.getByRole('tab', { name: 'Code Gen', exact: true }).click();
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await page.getByRole('button', { name: 'JavaScript', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Python', exact: true }).click();
  await expect(page.getByRole('tabpanel').locator('code')).toContainText(
    'pattern.sub(replacement, text, count=1)',
  );
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Ruby', exact: true }).click();
  await expect(page.getByRole('tabpanel').locator('code')).toContainText(
    'text.sub(pattern, replacement)',
  );
});

for (const entry of [
  { query: 'challenge=email-find', dialog: 'Regex challenges' },
  { query: 'lesson=basics-literals&step=1', dialog: 'Interactive tutorial' },
]) {
  test(`restores edited workspaces after entering via ${entry.query}`, async ({ page }) => {
    await page.goto(`/?${entry.query}`);
    await expect(page.getByRole('dialog', { name: entry.dialog, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: entry.dialog, exact: true })).toBeHidden();
    await editor(page).fill('SAVED_WORKSPACE');
    await expect(editor(page)).toHaveText('SAVED_WORKSPACE');
    await expect
      .poll(() => {
        const url = new URL(page.url());
        if (!url.hash.startsWith('#s=')) return null;
        return {
          query: url.search,
          pattern: JSON.parse(Buffer.from(url.hash.slice(3), 'base64url').toString()).p,
        };
      })
      .toEqual({ query: '', pattern: 'SAVED_WORKSPACE' });
    await page.reload();
    await expect(editor(page)).toHaveText('SAVED_WORKSPACE');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('restores old workspace links even when launch parameters are still present', async ({
  page,
}) => {
  await page.goto(share({ p: 'SAVED_WORKSPACE' }).replace('/#', '/?challenge=email-find#'));
  await expect(editor(page)).toHaveText('SAVED_WORKSPACE');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const engine of ['javascript', 'pcre2']) {
  test(`labels truncated ${engine} matches while replacing every match`, async ({ page }) => {
    await open(page, { e: engine, t: 'a'.repeat(10001), r: 'X' });
    await expect(page.getByTestId('match-status')).toHaveText('10000+ matches (results limited)');
    await page.getByRole('tab', { name: 'Replace', exact: true }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Replacement result (all matches)');
    await expect(page.getByTestId('replacement-result')).toHaveText('X'.repeat(10001));
  });
}

test('recovers immediately from obsolete slow matches after rapid editing', async ({ page }) => {
  await open(page, { p: '^(a+)+$', t: 'a' });
  await expect(page.getByTestId('match-status')).toHaveText('1 match');
  await page.getByRole('tab', { name: /^Matches/ }).click();
  const input = textEditor(page);
  for (let length = 34; length <= 38; length++) {
    const text = `${'a'.repeat(length)}!`;
    // Use CodeMirror's selection transaction. On touch Chromium, fill() can
    // insert at the DOM selection while leaving the old document suffix.
    await input.press('ControlOrMeta+a');
    await input.press('Backspace');
    await input.pressSequentially(text);
    await expect(input).toHaveText(text);
  }
  await editor(page).press('ControlOrMeta+a');
  await editor(page).press('Backspace');
  await editor(page).pressSequentially('^a+$');
  await expect(editor(page)).toHaveText('^a+$');
  // The old FIFO queue needed ten seconds to drain five discarded inputs.
  await expect(page.getByTestId('match-status')).toHaveText('0 matches', { timeout: 4000 });
});

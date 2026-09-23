import { replaceEditorText } from './editor-keys';
import { test, expect, type Page } from '@playwright/test';

const patternEditor = (page: Page) =>
  page
    .getByRole('group', { name: 'Regular expression', exact: true })
    .locator('[contenteditable=true]');
const textEditor = (page: Page) =>
  page.getByRole('group', { name: 'Test String', exact: true }).locator('[contenteditable=true]');
const status = (page: Page) => page.getByTestId('match-status');
const share = (state: Record<string, unknown>) =>
  `/en#s=${Buffer.from(JSON.stringify({ v: 2, e: 'javascript', p: 'a+', f: 'g', t: 'aa ab', ...state })).toString('base64url')}`;

async function open(page: Page, state: Record<string, unknown> = {}) {
  await page.goto(share(state));
  await expect(patternEditor(page)).toHaveText(String(state.p ?? 'a+'));
  await expect(page.getByTestId('compatibility-trigger')).toBeVisible();
}

async function setPattern(page: Page, value: string) {
  await replaceEditorText(page, patternEditor(page), value);
}

async function selectEngine(page: Page, name: 'JavaScript' | 'PCRE2') {
  await page.getByRole('button', { name: 'Execution engine', exact: true }).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByTestId('execution-summary')).toContainText(name);
}

async function matches(page: Page, count: number) {
  await expect(status(page)).toHaveText(`${count} ${count === 1 ? 'match' : 'matches'}`);
}

async function editCharacterClass(page: Page) {
  const label = page.locator('svg text').filter({ hasText: /^\[a-z\]$/ });
  await expect(label).toBeVisible();
  const id = await label.getAttribute('data-node-id');
  if (!id) throw new Error('Railroad label has no node');
  // Labels are non-interactive; operate the corresponding node hit target.
  const node = page.locator(`svg g[data-node-id="${id}"]`);
  if (test.info().project.use.isMobile) await node.tap();
  else await node.click();
  const editor = page.getByRole('region', { name: 'Edit PCRE2 node' });
  await expect(editor).toBeVisible();
  return editor;
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('loads PCRE2 only on selection; compatibility checks leave execution unchanged', async ({
  page,
}) => {
  const wasm: string[] = [];
  page.context().on('request', (r) => {
    if (r.url().includes('.wasm')) wasm.push(r.url());
  });
  await open(page, { p: 'a(?=b)', t: 'ab ab' });
  await matches(page, 2);
  await page.getByTestId('compatibility-trigger').click();
  await page.getByRole('combobox', { name: 'Target environment' }).selectOption('go');
  await expect(page.getByText('Partial syntax checks only.', { exact: false })).toBeVisible();
  await expect(page.getByText("Go's regexp package", { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close compatibility check', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Target environment' })).toHaveCount(0);
  await expect(page.getByTestId('compatibility-trigger')).toContainText('Go');
  await expect(page.getByTestId('compatibility-trigger')).toContainText('notice');
  await matches(page, 2);
  await expect(page.getByRole('button', { name: 'Flag g', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(wasm).toEqual([]);
  await page.getByRole('tab', { name: /^Matches/ }).click();
  await selectEngine(page, 'PCRE2');
  await matches(page, 2);
  expect(wasm.length).toBeGreaterThan(0);
  await expect(page.getByTestId('compatibility-trigger')).toContainText('Not checked');
  await page.getByTestId('compatibility-trigger').click();
  await expect(page.getByText('Cross-engine compatibility checks', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close compatibility check', exact: true }).click();
  await selectEngine(page, 'JavaScript');
  await matches(page, 2);
  await page.screenshot({ path: test.info().outputPath('engine-controls.png') });
});

test('keeps the newest input while a real PCRE2 worker waits for its WASM', async ({
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
  await open(page);
  await page.getByRole('tab', { name: /^Matches/ }).click();
  const requested = context.waitForEvent('request', (r) => r.url().includes('.wasm'));
  await selectEngine(page, 'PCRE2');
  await requested;
  await expect(status(page)).toContainText('Evaluating');
  await replaceEditorText(page, textEditor(page), 'bbb');
  await setPattern(page, 'b+');
  // A switch away and back while the old request is loading must stay responsive.
  await selectEngine(page, 'JavaScript');
  await matches(page, 1);
  await selectEngine(page, 'PCRE2');
  release();
  await matches(page, 1);
  await expect(page.getByRole('tabpanel')).toContainText('bbb');
  await expect(page.getByRole('tabpanel')).not.toContainText('aa');
});

test('recovers from a WASM network failure by explicitly retrying', async ({ page, context }) => {
  await context.route('**/*.wasm', (route) => route.abort());
  await open(page);
  await page.getByRole('tab', { name: /^Matches/ }).click();
  await selectEngine(page, 'PCRE2');
  await expect(status(page)).toContainText('Engine unavailable');
  await context.unroute('**/*.wasm');
  await status(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await matches(page, 2);
});

test('recovers after a JavaScript timeout and never grades unfinished work as passing', async ({
  page,
}) => {
  // WebKit can end one pathological search before our deadline. A real batch
  // exercises the request-wide budget in all engines without mocking Worker.
  const cases = Array.from({ length: 24 }, (_, i) => ({
    id: `no-${i}`,
    label: `negative case ${i}`,
    input: `${'a'.repeat(32)}!`,
    expect: 'noMatch',
  }));
  await open(page, { tc: cases });
  await page.getByRole('tab', { name: /^Tests/ }).click();
  await replaceEditorText(page, textEditor(page), `${'a'.repeat(32)}!`);
  await setPattern(page, '^(a+)+$');
  await expect(status(page)).toContainText('execution budget');
  await expect(page.getByRole('tabpanel').getByTitle('Test passes')).toHaveCount(0);
  await setPattern(page, '^a+$');
  await matches(page, 0);
  await expect(page.getByRole('tabpanel').getByTitle('Test passes')).toHaveCount(cases.length);
});

test('PCRE2 resource limits are recoverable', async ({ page }) => {
  await open(page, { e: 'pcre2', p: '^(a+)+$', t: `${'a'.repeat(80)}!` });
  await expect(status(page)).toContainText('execution budget');
  await setPattern(page, '^a+$');
  await matches(page, 0);
  await replaceEditorText(page, textEditor(page), 'aaa');
  await matches(page, 1);
});

test('restores old Python shares without enabling g, u or x execution', async ({ page }) => {
  await open(page, {
    v: 1,
    e: 'python',
    p: '.',
    f: 'ux',
    t: '😀 aa',
    r: 'X',
    sr: true,
    tc: [{ id: 'legacy', label: 'old test', input: 'ab', expect: 'match' }],
  });
  await matches(page, 1);
  await page.getByTestId('compatibility-trigger').click();
  await expect(page.getByRole('combobox', { name: 'Target environment' })).toHaveValue('python');
  await expect(page.getByText('This older share displayed', { exact: false })).toContainText('ux');
  await page.getByRole('button', { name: 'Close compatibility check', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Flag g', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Flag u', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  // Wait for the actual v3 hash write before reloading.
  await expect
    .poll(
      () => JSON.parse(Buffer.from(new URL(page.url()).hash.slice(3), 'base64url').toString()).v,
    )
    .toBe(3);
  await page.reload();
  await matches(page, 1);
  await page.getByTestId('compatibility-trigger').click();
  await expect(page.getByRole('combobox', { name: 'Target environment' })).toHaveValue('python');
  await page.getByRole('button', { name: 'Close compatibility check', exact: true }).click();
  await page.getByRole('tab', { name: /^Tests/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('old test');
  await expect(page.getByRole('tabpanel').getByTitle('Test passes')).toBeVisible();
});

test('PCRE2 reset-start captures agree with the native final trace and replacement', async ({
  page,
}) => {
  await open(page, { e: 'pcre2', p: '(a)\\Kb', t: 'ab', r: '$1-$0' });
  await matches(page, 1);
  await page.getByTitle('Last step', { exact: true }).click();
  await expect(page.getByTestId('debugger-current-step')).toContainText('PCRE2 matched [1, 2)');
  await expect(page.getByTestId('debugger-current-step')).toContainText('#1="a"');
  await page.getByRole('tab', { name: /^Matches/ }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('Full Match', { exact: true }).locator('..')).toHaveText(
    'Full Matchb',
  );
  await expect(panel.locator('[data-group-index="1"] [data-testid="capture-value"]')).toHaveText(
    'a',
  );
  await page.getByRole('tab', { name: 'Replace', exact: true }).click();
  await expect(page.getByTestId('replacement-result')).toHaveText('aa-b');
});

test('JavaScript lookbehind captures agree between matches and the final debug step', async ({
  page,
}) => {
  await open(page, { p: '.+(?<=(.+)(.+))', t: 'bba', f: '' });
  await matches(page, 1);
  await page.getByTitle('Last step', { exact: true }).click();
  await expect(page.getByTestId('debugger-current-step')).toContainText('#1="b"');
  await expect(page.getByTestId('debugger-current-step')).toContainText('#2="ba"');
  await page.getByRole('tab', { name: /^Matches/ }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.locator('[data-group-index="1"] [data-testid="capture-value"]')).toHaveText(
    'b',
  );
  await expect(panel.locator('[data-group-index="2"] [data-testid="capture-value"]')).toHaveText(
    'ba',
  );
});

test('native validation rejects an invalid visual edit, then applies a valid edit and supports undo', async ({
  page,
}) => {
  await open(page, { e: 'pcre2', p: '^[a-z]+$', t: '123' });
  await matches(page, 0);
  const editor = await editCharacterClass(page);
  await editor
    .getByRole('textbox', { name: 'Character class (including brackets)', exact: true })
    .fill('[z-a]');
  await editor.getByRole('button', { name: 'Validate and apply' }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(patternEditor(page)).toHaveText('^[a-z]+$');
  await editor
    .getByRole('textbox', { name: 'Character class (including brackets)', exact: true })
    .fill('[0-9]');
  await editor.getByRole('button', { name: 'Validate and apply' }).click();
  await matches(page, 1);
  await expect(patternEditor(page)).toHaveText('^[0-9]+$');
  await page.getByTitle('Undo (⌘Z / Ctrl+Z)', { exact: true }).click();
  await expect(patternEditor(page)).toHaveText('^[a-z]+$');
  await matches(page, 0);
});

test('a late native validation cannot overwrite a newer source edit', async ({ page, context }) => {
  await page.addInitScript(() => {
    // Observe genuine replies; matching and validation still use the real workers.
    const state = window as typeof window & { validationReplies: number };
    state.validationReplies = 0;
    const original = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      message,
      options?: StructuredSerializeOptions | Transferable[],
    ) {
      if (message?.validateOnly) {
        const listener = (event: MessageEvent) => {
          if (event.data.id === message.id) {
            state.validationReplies++;
            this.removeEventListener('message', listener);
          }
        };
        this.addEventListener('message', listener);
      }
      original.call(this, message, Array.isArray(options) ? { transfer: options } : options);
    };
  });
  await open(page, { e: 'pcre2', p: '^[a-z]+$', t: '123' });
  await matches(page, 0);
  // Let both existing PCRE2 workers initialize before holding the validator's load.
  await expect(page.getByTitle('Last step', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /^Matches/ }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/*.wasm', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    const editor = await editCharacterClass(page);
    await editor
      .getByRole('textbox', { name: 'Character class (including brackets)', exact: true })
      .fill('[0-9]');
    const requested = context.waitForEvent('request', (r) => r.url().includes('.wasm'));
    await editor.getByRole('button', { name: 'Validate and apply' }).click();
    await requested;
    await setPattern(page, '^Z+$');
    await expect(editor).toBeHidden();
    release();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { validationReplies: number }).validationReplies,
        ),
      )
      .toBe(1);
    await expect(patternEditor(page)).toHaveText('^Z+$');
    await matches(page, 0);
  } finally {
    release();
  }
});

import { expect, type Locator, type Page } from '@playwright/test';

/** CodeMirror follows the emulated device; ControlOrMeta follows the test host. */
export async function editorKey(page: Page, key: string): Promise<string> {
  const apple = await page.evaluate(
    () =>
      /Mac/.test(navigator.platform) ||
      (/Apple Computer/.test(navigator.vendor) &&
        (/Mobile\/\w+/.test(navigator.userAgent) || navigator.maxTouchPoints > 2)),
  );
  // CodeMirror's history keymap uses Ctrl-Y on Windows/Linux, Cmd-Shift-Z on Apple.
  // Shifted letters must carry uppercase event.key (also in Linux WebKit).
  if (key === 'Shift+z') return apple ? 'Meta+Shift+Z' : 'Control+y';
  return `${apple ? 'Meta' : 'Control'}+${key}`;
}

/** Replace through CodeMirror's selection so touch DOM selections cannot diverge. */
export async function replaceEditorText(page: Page, editor: Locator, value: string) {
  await editor.press(await editorKey(page, 'a'));
  await page.keyboard.insertText(value);
  await expect(editor).toHaveText(value);
}

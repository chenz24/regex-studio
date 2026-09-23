import type { Page } from '@playwright/test';

/** CodeMirror follows the emulated device; ControlOrMeta follows the test host. */
export async function editorKey(page: Page, key: string): Promise<string> {
  const apple = await page.evaluate(
    () =>
      /Mac/.test(navigator.platform) ||
      (/Apple Computer/.test(navigator.vendor) &&
        (/Mobile\/\w+/.test(navigator.userAgent) || navigator.maxTouchPoints > 2)),
  );
  // CodeMirror's history keymap uses Ctrl-Y on Windows/Linux, Cmd-Shift-Z on Apple.
  if (key === 'Shift+z' && !apple) return 'Control+y';
  return `${apple ? 'Meta' : 'Control'}+${key}`;
}

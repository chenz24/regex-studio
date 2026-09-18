// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MatchInfo, TestCase, TestCaseResult } from '@/types/regex';
import type { ToolPanelTab } from '@/tutorial/types';
import { parseRegex } from '@/utils/regexParser';
import { parsePcre2 } from '@/utils/pcre2Parser';
import { ToolPanel } from './ToolPanel';

const match: MatchInfo = { index: 0, match: 'needle', groups: [], start: 0, end: 6 };
const testCases: TestCase[] = [
  { id: 't1', label: 'finds it', input: 'a needle here', expect: 'match' },
];
const testResults: TestCaseResult[] = [{ id: 't1', pass: true, matchCount: 1, invalid: false }];

function renderPanel(
  activeTab: ToolPanelTab,
  executionEngine: 'javascript' | 'pcre2' = 'javascript',
  visualizationSupported = true,
) {
  const view = render(
    <ToolPanel
      executionEngine={executionEngine}
      visualizationSupported={visualizationSupported}
      ast={executionEngine === 'pcre2' ? parsePcre2('needle').ast : parseRegex('needle')}
      pattern="needle"
      testText="a needle here"
      flagString="g"
      jsFlagString="g"
      hoveredNodeId={null}
      onHoverNode={() => {}}
      replacement=""
      onReplacementChange={() => {}}
      replacedText="a needle here"
      matchCount={1}
      matches={[match]}
      selectedMatch={null}
      onSelectMatch={() => {}}
      testCases={testCases}
      testResults={testResults}
      testsPassed={1}
      onAddTestCase={() => {}}
      onImportTestCases={() => {}}
      onUpdateTestCase={() => {}}
      onRemoveTestCase={() => {}}
      onLoadTestCaseInput={() => {}}
      activeTab={activeTab}
      onActiveTabChange={() => {}}
    />,
  );
  const openPanel = () => view.container.querySelector('[role=tabpanel]:not([hidden])');
  return { ...view, openPanel };
}

describe('ToolPanel', () => {
  it.each<ToolPanelTab>([
    'explanation',
    'ast',
  ])('identifies unavailable PCRE2 %s instead of showing a JS interpretation', async (tab) => {
    const { openPanel } = renderPanel(tab, 'pcre2', false);
    await waitFor(() =>
      expect(openPanel()?.textContent).toMatch(/not available|cannot be visualized/),
    );
    expect(openPanel()?.textContent).not.toContain('needle');
  });

  it.each<ToolPanelTab>(['explanation', 'ast'])('shows supported PCRE2 %s', async (tab) => {
    const { openPanel } = renderPanel(tab, 'pcre2');
    await waitFor(() =>
      expect(openPanel()?.textContent).toContain(tab === 'ast' ? 'needle' : 'Matches'),
    );
    expect(openPanel()?.textContent).not.toContain('cannot be visualized');
  });

  it('renders the open tab without waiting on a lazy chunk', () => {
    // The debugger is what is on screen at startup, so it is imported
    // eagerly: its content has to be there on the very first render.
    const { openPanel } = renderPanel('debugger');
    expect(openPanel()?.textContent).toContain('needle');
  });

  it('leaves the panels behind the other tabs unmounted', () => {
    const { container } = renderPanel('debugger');
    const closed = [...container.querySelectorAll('[role=tabpanel][hidden]')];
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.every((p) => p.textContent === '')).toBe(true);
  });

  it.each<[ToolPanelTab, string]>([
    ['matches', 'needle'],
    ['replace', 'a needle here'],
    ['tests', 'finds it'],
    ['codegen', 'needle'],
  ])('loads the %s panel when its tab is open', async (tab, content) => {
    const { openPanel } = renderPanel(tab);
    // Suspends on the dynamic import, so the content arrives a tick later.
    await waitFor(() => {
      expect(openPanel()?.textContent).toContain(content);
    });
  });
});

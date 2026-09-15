// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pcre2DebuggerPanel } from './Pcre2DebuggerPanel';
import { parsePcre2 } from '../../utils/pcre2Parser';
import { runMatch, type MatchInput, type MatchOutcome } from '../../utils/matchEngine';
vi.mock('../../utils/matchEngine', async (original) => ({
  ...(await original<typeof import('../../utils/matchEngine')>()),
  runMatch: vi.fn(),
}));
let requests: Array<{ input: MatchInput; resolve: (outcome: MatchOutcome) => void }>;
const successful: MatchOutcome = {
  matches: [
    {
      index: 3,
      start: 3,
      end: 6,
      match: 'bar',
      groups: [{ index: 1, name: null, value: 'foo', start: 0, end: 3 }],
    },
  ],
  replacedText: 'foobar',
  testMatchCounts: [],
  timedOut: false,
  validation: { valid: true },
  trace: { steps: [], truncated: false },
};
function panel(pattern = '(foo)\\Kbar') {
  return (
    <Pcre2DebuggerPanel
      ast={parsePcre2(pattern).ast}
      pattern={pattern}
      testText="foobar"
      flagString="g"
    />
  );
}
beforeEach(() => {
  requests = [];
  vi.mocked(runMatch).mockImplementation(
    (input) => new Promise((resolve) => requests.push({ input, resolve })),
  );
});
afterEach(cleanup);
describe('asynchronous PCRE2 debugger', () => {
  it('waits for native results and never invokes the JavaScript debugger', async () => {
    const view = render(panel());
    expect(view.getByRole('status').textContent).toContain('Loading PCRE2');
    expect(requests[0].input).toMatchObject({
      engine: 'pcre2',
      trace: true,
      pattern: '(foo)\\Kbar',
    });
    await act(async () => requests[0].resolve(successful));
    expect(view.container.textContent).toContain('PCRE2 matched [3, 6)');
    expect(view.container.textContent).toContain('foo');
    expect(view.container.textContent).not.toContain('Invalid regular expression');
  });
  it('clears stale traces on input changes and ignores late responses', async () => {
    const view = render(panel());
    view.rerender(panel('foo'));
    await act(async () => requests[0].resolve(successful));
    expect(view.getByRole('status')).toBeTruthy();
    await act(async () => requests[1].resolve({ ...successful, matches: [] }));
    expect(view.container.textContent).toContain('PCRE2: no match');
    expect(view.container.textContent).not.toContain('PCRE2 matched');
  });
  it('offers retry after an execution error, withholds any verdict while retrying', async () => {
    const view = render(panel());
    await act(async () =>
      requests[0].resolve({ ...successful, matches: [], executionError: 'load failed' }),
    );
    expect(view.getByRole('alert').textContent).toContain('load failed');
    fireEvent.click(view.getByText('Retry', { exact: true }));
    expect(view.getByRole('status')).toBeTruthy();
    await act(async () => requests[1].resolve(successful));
    expect(view.container.textContent).toContain('PCRE2 matched');
  });
  it('can trace native syntax that the visual parser declines', async () => {
    const view = render(panel('(?C1)foo'));
    await act(async () =>
      requests[0].resolve({
        ...successful,
        trace: {
          truncated: false,
          steps: [
            {
              patternStart: 5,
              patternEnd: 6,
              stringPos: 0,
              matchStart: 0,
              flags: 1,
              calloutNumber: 1,
              captures: [],
            },
          ],
        },
      }),
    );
    expect(view.container.textContent).toContain('Before f');
    expect(view.container.textContent).not.toContain('cannot be visualized');
  });
});

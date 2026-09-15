// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pcre2NodeEditor } from './Pcre2NodeEditor';
import { parsePcre2 } from '../../utils/pcre2Parser';
import { runMatch, type MatchInput, type MatchOutcome } from '../../utils/matchEngine';
vi.mock('../../utils/matchEngine', async (original) => ({
  ...(await original<typeof import('../../utils/matchEngine')>()),
  runMatch: vi.fn(),
}));
let requests: Array<{ input: MatchInput; resolve: (result: MatchOutcome) => void }>;
const valid: MatchOutcome = {
  matches: [],
  replacedText: '',
  testMatchCounts: [],
  timedOut: false,
  validation: { valid: true },
};
const onChange = vi.fn();
const onClose = vi.fn();
function panel(pattern = 'abc', flags = '') {
  const ast = parsePcre2(pattern, flags).ast;
  const selectedNodeId = ast.children![0].id;
  return (
    <Pcre2NodeEditor
      key={JSON.stringify([pattern, flags, selectedNodeId])}
      ast={ast}
      selectedNodeId={selectedNodeId}
      pattern={pattern}
      flags={flags}
      onPatternChange={onChange}
      onClose={onClose}
    />
  );
}
beforeEach(() => {
  requests = [];
  onChange.mockClear();
  onClose.mockClear();
  vi.mocked(runMatch).mockImplementation(
    (input) => new Promise((resolve) => requests.push({ input, resolve })),
  );
});
afterEach(cleanup);
describe('native-validated PCRE2 edits', () => {
  it('applies only after asynchronous native compilation succeeds', async () => {
    const view = render(panel());
    fireEvent.change(view.getByLabelText('Literal text'), { target: { value: 'def' } });
    fireEvent.click(view.getByText('Validate and apply'));
    expect(onChange).not.toHaveBeenCalled();
    expect(requests[0].input).toMatchObject({
      engine: 'pcre2',
      validateOnly: true,
      pattern: 'def',
      text: '',
      testInputs: [],
    });
    await act(async () => requests[0].resolve(valid));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('def');
    expect(onClose).toHaveBeenCalledOnce();
  });
  it.each([
    'source',
    'flags',
    'close',
  ])('discards late validation after %s changes', async (change) => {
    const view = render(panel());
    fireEvent.change(view.getByLabelText('Literal text'), { target: { value: 'old draft' } });
    fireEvent.click(view.getByText('Validate and apply'));
    if (change === 'close') view.unmount();
    else view.rerender(change === 'source' ? panel('new source') : panel('abc', 'x'));
    await act(async () => requests[0].resolve(valid));
    expect(onChange).not.toHaveBeenCalled();
  });
  it('retains the source and lets the user correct native compilation errors', async () => {
    const view = render(panel('[a-z]'));
    fireEvent.change(view.getByLabelText('Character class (including brackets)'), {
      target: { value: '[z-a]' },
    });
    fireEvent.click(view.getByText('Validate and apply'));
    await act(async () =>
      requests[0].resolve({ ...valid, validation: { valid: false, error: 'range out of order' } }),
    );
    expect(view.getByRole('alert').textContent).toBe('range out of order');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(view.getByLabelText('Character class (including brackets)'), {
      target: { value: '[0-9]' },
    });
    fireEvent.click(view.getByText('Validate and apply'));
    await act(async () => requests[1].resolve(valid));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('[0-9]');
  });
  it('does not apply on a worker timeout or load failure', async () => {
    const view = render(panel());
    fireEvent.change(view.getByLabelText('Literal text'), { target: { value: 'new' } });
    fireEvent.click(view.getByText('Validate and apply'));
    await act(async () => requests[0].resolve({ ...valid, timedOut: true }));
    expect(onChange).not.toHaveBeenCalled();
    expect(view.getByRole('alert')).toBeTruthy();
  });
});

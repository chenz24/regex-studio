// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchDetails } from './MatchDetails';
import { findMatches } from '../../utils/regexMatcher';

afterEach(cleanup);
describe('independent match and capture controls', () => {
  it('allows keyboard selection of an unset group without nesting buttons or selecting its parent match', () => {
    const selectMatch = vi.fn(),
      selectGroup = vi.fn();
    const view = render(
      <MatchDetails
        matches={findMatches('(a)?()b', 'g', 'b')}
        selectedMatch={null}
        onSelectMatch={selectMatch}
        onSelectGroup={selectGroup}
      />,
    );
    expect(view.container.querySelector('button button')).toBeNull();
    const groups = view.getAllByTestId('inspect-capture');
    expect(groups[0].textContent).toContain('Did not participate');
    expect(groups[1].textContent).toContain('empty');
    fireEvent.click(groups[0]);
    expect(selectGroup).toHaveBeenCalledWith(0, 1);
    expect(selectMatch).not.toHaveBeenCalled();
  });
  it('disables result navigation while the worker is pending or failed', () => {
    const select = vi.fn();
    const view = render(
      <MatchDetails
        matches={findMatches('(a)', 'g', 'a')}
        selectedMatch={null}
        onSelectMatch={select}
        onSelectGroup={select}
        resultsReady={false}
      />,
    );
    for (const button of view.container.querySelectorAll('button'))
      expect(button.disabled).toBe(true);
    fireEvent.click(view.getByTestId('inspect-match'));
    expect(select).not.toHaveBeenCalled();
  });
});

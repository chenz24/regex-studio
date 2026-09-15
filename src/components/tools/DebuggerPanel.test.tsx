// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { parseRegex } from '@/utils/regexParser';
import { DebuggerPanel } from './DebuggerPanel';

afterEach(cleanup);

describe('DebuggerPanel numeric escapes', () => {
  it.each(['u', 'v'])('shows a syntax error for an invalid reference with %s', (flags) => {
    const pattern = String.raw`\1*`;
    const { getByRole, queryByTitle } = render(
      <DebuggerPanel
        ast={parseRegex(pattern, flags)}
        pattern={pattern}
        testText=""
        flagString={flags}
      />,
    );
    expect(getByRole('alert').textContent).toContain('Invalid');
    expect(queryByTitle('Play/Pause (Space)')).toBeNull();
  });

  it('debugs a valid pattern against empty text', () => {
    const pattern = String.raw`\1{2}`;
    const { container, getByTitle } = render(
      <DebuggerPanel ast={parseRegex(pattern)} pattern={pattern} testText="" flagString="" />,
    );
    expect(getByTitle('Play/Pause (Space)')).toBeTruthy();
    expect(container.textContent).toContain('failed, at end of string');
    expect(container.textContent).not.toContain('group not set');
  });
});

// @vitest-environment jsdom
import { runInNewContext } from 'node:vm';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeGeneratorPanel } from './CodeGeneratorPanel';

afterEach(cleanup);
describe('generated replacement code', () => {
  it.each([
    ['a', 'abc', '', 'bc'],
    ['^$', '', 'X', 'X'],
  ])('preserves empty editor values for /%s/g', (pattern, testText, replacement, expected) => {
    const view = render(
      <CodeGeneratorPanel
        pattern={pattern}
        flags="g"
        testText={testText}
        replacement={replacement}
      />,
    );
    fireEvent.click(view.getByRole('button', { name: 'Replace' }));
    const output: unknown[][] = [];
    runInNewContext(view.container.querySelector('code')!.textContent!, {
      console: { log: (...args: unknown[]) => output.push(args) },
    });
    expect(output).toEqual([['Result:', expected]]);
  });
});

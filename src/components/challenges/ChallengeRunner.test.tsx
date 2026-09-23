// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchEngine from '@/utils/matchEngine';
import { CHALLENGES } from '@/challenges/data';
import { useChallengeStore } from '@/stores/challengeStore';
import { useRegexStore } from '@/stores/regexStore';
import { ChallengeRunner } from './ChallengeRunner';

const challenge = CHALLENGES[0];
afterEach(cleanup);

beforeEach(async () => {
  await act(async () => {
    useChallengeStore.setState({
      view: 'closed',
      currentChallengeId: null,
      completion: {},
      snapshotBeforeChallenge: null,
    });
  });
});

async function start() {
  await act(async () => {
    await useChallengeStore.getState().startChallenge(challenge.id);
  });
}

describe('ChallengeRunner', () => {
  it('does not award the next challenge using the previous challenge’s results', async () => {
    await start();
    const { container } = render(<ChallengeRunner />);
    await act(async () => {
      const solution = challenge.idealSolution!;
      useRegexStore.getState().loadPattern(solution.pattern, solution.flags ?? 'g');
    });
    await waitFor(() => expect(useChallengeStore.getState().completion[challenge.id]).toBeTruthy());

    let finish!: () => void;
    vi.spyOn(matchEngine, 'runMatch').mockImplementation(
      (input) =>
        new Promise((resolve) => {
          finish = () => resolve(matchEngine.runMatchInline(input));
        }),
    );
    await act(async () => useChallengeStore.getState().startChallenge('https-url'));
    expect(container.textContent).toContain('Evaluating');
    expect(useChallengeStore.getState().completion['https-url']).toBeUndefined();
    await act(async () => finish());
    expect(container.textContent).toContain('0 / 13');
    expect(useChallengeStore.getState().completion['https-url']).toBeUndefined();
  });
  it.each([
    'delete',
    'edit',
  ])('grades the original cases when playground cases are changed: %s', async (action) => {
    await start();
    const { container } = render(<ChallengeRunner />);
    await act(async () => {
      useRegexStore.getState().loadPattern('@', 'g');
    });
    await waitFor(() => expect(container.textContent).toContain('1 / 5'));
    await act(async () => {
      for (const id of ['email-find__3', 'email-find__4']) {
        if (action === 'delete') useRegexStore.getState().removeTestCase(id);
        else useRegexStore.getState().updateTestCase(id, { input: 'no email here' });
      }
    });
    expect(container.textContent).toContain('1 / 5');
    expect(useChallengeStore.getState().completion[challenge.id]).toBeUndefined();
  });
  it('renders the challenge it was given', async () => {
    await start();
    const { container } = render(<ChallengeRunner />);
    await act(async () => {});

    expect(container.textContent).toContain(challenge.title);
  });

  it('marks the challenge solved once the pattern passes every case', async () => {
    const solution = challenge.idealSolution;
    expect(solution, 'the first challenge needs a reference solution').toBeTruthy();

    await start();
    render(<ChallengeRunner />);
    await act(async () => {});

    await act(async () => {
      useRegexStore.getState().loadPattern(solution!.pattern, solution!.flags ?? 'g');
    });

    await waitFor(() => {
      expect(useChallengeStore.getState().completion[challenge.id]).toBeTruthy();
    });
  });

  it('stays unsolved for a pattern that fails a case', async () => {
    await start();
    render(<ChallengeRunner />);

    await act(async () => {
      useRegexStore.getState().loadPattern('zzzz', 'g');
    });
    await act(async () => {});

    expect(useChallengeStore.getState().completion[challenge.id]).toBeUndefined();
  });
});

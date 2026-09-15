// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHALLENGES } from '@/challenges/data';
import { useChallengeStore } from '@/stores/challengeStore';
import { useRegexStore } from '@/stores/regexStore';
import { ChallengeRunner } from './ChallengeRunner';

const challenge = CHALLENGES[0];

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

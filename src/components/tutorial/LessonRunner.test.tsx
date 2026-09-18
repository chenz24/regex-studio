// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchEngine from '@/utils/matchEngine';
import { useRegexStore } from '@/stores/regexStore';
import { useTutorialStore } from '@/stores/tutorialStore';
import { LessonRunner } from './LessonRunner';

const LESSON = 'basics-literals';
afterEach(cleanup);

beforeEach(async () => {
  await act(async () => {
    useTutorialStore.setState({
      view: 'closed',
      currentLessonId: null,
      currentStepIndex: 0,
      completion: {},
      lastResult: null,
      failCount: 0,
      snapshotBeforeLesson: null,
    });
  });
});

async function startLesson(stepIndex = 0) {
  await act(async () => {
    await useTutorialStore.getState().startLesson(LESSON, stepIndex);
  });
}

describe('LessonRunner', () => {
  it('resets revealed hints between steps and lessons with the same step ID', async () => {
    await startLesson();
    const { getByRole, queryByText } = render(<LessonRunner />);
    fireEvent.click(getByRole('button', { name: 'Need a hint? (1/1)' }));
    expect(
      queryByText('Characters with no special meaning match themselves. Just type `cat`.'),
    ).not.toBeNull();
    await act(async () => useTutorialStore.getState().goTo(2));
    expect(getByRole('button', { name: 'Need a hint? (1/2)' })).toBeTruthy();
    expect(queryByText('You need some notion of "word boundary".')).toBeNull();
    await act(async () => useTutorialStore.getState().goTo(0));
    fireEvent.click(getByRole('button', { name: 'Need a hint? (1/1)' }));
    await act(async () => useTutorialStore.getState().startLesson('basics-dot-and-escapes'));
    expect(getByRole('button', { name: 'Need a hint? (1/1)' })).toBeTruthy();
  });

  it('does not reveal or unlock another step’s solution after showing one', async () => {
    await startLesson(2);
    const { getByRole, queryByRole } = render(<LessonRunner />);
    await waitFor(() => expect(useTutorialStore.getState().lastResult).not.toBeNull());
    await act(async () => useTutorialStore.setState({ failCount: 4 }));
    fireEvent.click(getByRole('button', { name: 'Show solution' }));
    expect(getByRole('button', { name: 'Solution shown' })).toBeTruthy();
    await act(async () => useTutorialStore.getState().startLesson('basics-dot-and-escapes', 1));
    expect(queryByRole('button', { name: 'Solution shown' })).toBeNull();
    expect((getByRole('button', { name: 'Show solution' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('withholds validation while matching is pending or timed out', async () => {
    await startLesson();
    const { getByRole } = render(<LessonRunner />);
    await act(async () => useRegexStore.getState().setPattern('cat'));
    await waitFor(() => expect(useTutorialStore.getState().lastResult?.pass).toBe(true));

    let finish!: () => void;
    vi.spyOn(matchEngine, 'runMatch').mockImplementation(
      (input) =>
        new Promise((resolve) => {
          finish = () => resolve(matchEngine.timedOutOutcome(input));
        }),
    );
    await act(async () => useRegexStore.getState().setPattern('cat(?:)'));
    expect(getByRole('status').textContent).toBe('Evaluating…');
    expect(useTutorialStore.getState().lastResult).toBeNull();
    expect(useTutorialStore.getState().failCount).toBe(0);
    await act(async () => finish());
    expect(getByRole('status').textContent).toBe('Timed out');
    expect(useTutorialStore.getState().lastResult).toBeNull();
    expect(useTutorialStore.getState().failCount).toBe(0);

    await act(async () => useRegexStore.getState().setPattern('cat'));
    await waitFor(() => expect(useTutorialStore.getState().lastResult?.pass).toBe(true));
  });
  it('renders the current step', async () => {
    await startLesson();
    const { container } = render(<LessonRunner />);
    await act(async () => {});

    expect(container.textContent).toContain('Match your first');
  });

  // The runner validates the step on every change of the derived regex state
  // and writes the verdict back to the store. When the derived object lost
  // its identity between renders that became an update loop, and React tore
  // the whole tree down with "Maximum update depth exceeded" — a crash no
  // amount of testing the pure functions would have caught.
  it('validates the step without looping', async () => {
    await startLesson();
    render(<LessonRunner />);

    await waitFor(() => {
      expect(useTutorialStore.getState().lastResult).not.toBeNull();
    });
  });

  it('passes the step once the pattern satisfies it', async () => {
    await startLesson();
    render(<LessonRunner />);
    await act(async () => {});

    await act(async () => {
      useRegexStore.getState().setPattern('cat');
    });

    await waitFor(() => {
      expect(useTutorialStore.getState().lastResult?.pass).toBe(true);
    });
  });

  it('reports a step that is not satisfied yet', async () => {
    await startLesson();
    render(<LessonRunner />);

    await act(async () => {
      useRegexStore.getState().setPattern('zzz');
    });

    await waitFor(() => {
      expect(useTutorialStore.getState().lastResult?.pass).toBe(false);
    });
  });

  it('falls back to the catalogue when the lesson is gone', async () => {
    await act(async () => {
      useTutorialStore.setState({ view: 'lesson', currentLessonId: 'no-such-lesson' });
    });
    const { container } = render(<LessonRunner />);
    await act(async () => {});

    expect(container.textContent).toContain('not found');
  });
});

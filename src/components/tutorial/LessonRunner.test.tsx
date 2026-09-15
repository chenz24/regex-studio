// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRegexStore } from '@/stores/regexStore';
import { useTutorialStore } from '@/stores/tutorialStore';
import { LessonRunner } from './LessonRunner';

const LESSON = 'basics-literals';

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

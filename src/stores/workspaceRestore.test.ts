import { beforeEach, describe, expect, it } from 'vitest';
import { useRegexStore } from './regexStore';
import { useTutorialStore } from './tutorialStore';
import { useChallengeStore } from './challengeStore';

const regexInitial = useRegexStore.getState();
const tutorialInitial = useTutorialStore.getState();
const challengeInitial = useChallengeStore.getState();

beforeEach(() => {
  useRegexStore.setState(regexInitial);
  useTutorialStore.setState(tutorialInitial);
  useChallengeStore.setState(challengeInitial);
  const editor = useRegexStore.getState();
  editor.setEngine('pcre2');
  editor.loadPattern('(a)\\Kb', 'gU');
  editor.setTestText('ab');
  editor.setReplacement('ORIGINAL');
  editor.setShowReplace(true);
  editor.setCompatibilityTarget('python');
  editor.setLegacyTargetFlags('ux');
});

function changeWorkspace() {
  const editor = useRegexStore.getState();
  editor.setEngine('javascript');
  editor.setCompatibilityTarget('go');
  editor.loadPattern('a+', 'i');
  editor.setReplacement('EXERCISE');
  editor.setShowReplace(false);
}

function expectRestored() {
  const editor = useRegexStore.getState();
  expect(editor).toMatchObject({
    engine: 'pcre2',
    compatibilityTarget: 'python',
    legacyTargetFlags: 'ux',
    pattern: '(a)\\Kb',
    testText: 'ab',
    replacement: 'ORIGINAL',
    showReplace: true,
  });
  expect(
    editor.flags
      .filter((f) => f.enabled)
      .map((f) => f.key)
      .join(''),
  ).toBe('gU');
}

describe('workspace restoration with independent compatibility settings', () => {
  it.each([
    'lesson',
    'challenge',
  ] as const)('restores an empty replacement after a %s', async (mode) => {
    const editor = useRegexStore.getState();
    editor.setReplacement('');
    editor.setShowReplace(false);
    if (mode === 'lesson') await useTutorialStore.getState().startLesson('basics-literals');
    else await useChallengeStore.getState().startChallenge('email-find');
    editor.setReplacement('EXERCISE');
    editor.setShowReplace(true);
    if (mode === 'lesson') useTutorialStore.getState().exitLesson(true);
    else useChallengeStore.getState().exitChallenge();
    expect(useRegexStore.getState()).toMatchObject({ replacement: '', showReplace: false });
  });

  it('keeps the original workspace through multiple lessons and catalog visits', async () => {
    const tutorial = useTutorialStore.getState();
    await tutorial.startLesson('basics-literals');
    changeWorkspace();
    tutorial.close();
    tutorial.openCatalog();
    await tutorial.startLesson('basics-dot-and-escapes');
    await tutorial.startLesson('basics-anchors');
    tutorial.exitLesson(true);
    expectRestored();
    expect(useTutorialStore.getState().stepSnapshots).toEqual({});
  });

  it('captures a fresh workspace when a completed lesson session has ended', async () => {
    const tutorial = useTutorialStore.getState();
    await tutorial.startLesson('basics-literals');
    tutorial.exitLesson(true);
    changeWorkspace();
    await tutorial.startLesson('basics-anchors');
    tutorial.exitLesson(true);
    expect(useRegexStore.getState().pattern).toBe('a+');
  });

  it('restores the complete engine selection after a lesson', async () => {
    await useTutorialStore.getState().startLesson('basics-literals');
    expect(useTutorialStore.getState().currentLessonId).toBe('basics-literals');
    expect(useRegexStore.getState().compatibilityTarget).toBeNull();
    changeWorkspace();
    useTutorialStore.getState().exitLesson(true);
    expectRestored();
  });

  it.each([
    'close',
    'exitChallenge',
  ] as const)('restores compatibility metadata on challenge %s', async (action) => {
    await useChallengeStore.getState().startChallenge('email-find');
    expect(useChallengeStore.getState().currentChallengeId).toBe('email-find');
    changeWorkspace();
    useChallengeStore.getState()[action]();
    expectRestored();
  });
});

describe('lesson step navigation', () => {
  it('keeps each visited step’s replacement settings and restores the original on exit', async () => {
    const tutorial = useTutorialStore.getState();
    const editor = useRegexStore.getState();
    await tutorial.startLesson('basics-literals');
    editor.setReplacement('STEP_ONE');
    editor.setShowReplace(false);
    tutorial.next();
    editor.setReplacement('STEP_TWO');
    editor.setShowReplace(true);
    tutorial.prev();
    expect(useRegexStore.getState()).toMatchObject({ replacement: 'STEP_ONE', showReplace: false });
    tutorial.next();
    expect(useRegexStore.getState()).toMatchObject({ replacement: 'STEP_TWO', showReplace: true });
    tutorial.exitLesson(true);
    expectRestored();
  });

  it('applies skipped setups and restores each visited step with its edits', async () => {
    const tutorial = useTutorialStore.getState();
    await tutorial.startLesson('basics-dot-and-escapes');
    useRegexStore.getState().loadPattern('c.t', 'g');
    tutorial.goTo(1);
    expect(useRegexStore.getState().testText).toBe('version 1.2.3 build 4.5');
    useRegexStore.getState().loadPattern(String.raw`\d\.\d`, 'g');
    tutorial.next();
    expect(useRegexStore.getState()).toMatchObject({ pattern: 'a.b', testText: 'a\nb a b axb' });
    useRegexStore.getState().loadPattern('a.b', 'gs');
    tutorial.prev();
    expect(useRegexStore.getState()).toMatchObject({
      pattern: String.raw`\d\.\d`,
      testText: 'version 1.2.3 build 4.5',
    });
    tutorial.goTo(0);
    expect(useRegexStore.getState()).toMatchObject({
      pattern: 'c.t',
      testText: 'cat cot cut bat sit',
    });
    tutorial.goTo(2);
    expect(useRegexStore.getState()).toMatchObject({ pattern: 'a.b', testText: 'a\nb a b axb' });
    expect(useRegexStore.getState().flags.find((f) => f.key === 's')?.enabled).toBe(true);
    tutorial.exitLesson(true);
    expectRestored();
  });

  it('applies every setup when jumping past unvisited steps', async () => {
    const tutorial = useTutorialStore.getState();
    await tutorial.startLesson('basics-dot-and-escapes');
    tutorial.goTo(3);
    expect(useRegexStore.getState()).toMatchObject({ pattern: 'a.b', testText: 'a\nb a b axb' });
    tutorial.goTo(1);
    expect(useRegexStore.getState()).toMatchObject({
      pattern: '',
      testText: 'version 1.2.3 build 4.5',
    });
  });

  it('sets up earlier steps when entering through a deep link', async () => {
    const tutorial = useTutorialStore.getState();
    await tutorial.startLesson('basics-dot-and-escapes', 2);
    tutorial.prev();
    expect(useRegexStore.getState().testText).toBe('version 1.2.3 build 4.5');
    tutorial.prev();
    expect(useRegexStore.getState().testText).toBe('cat cot cut bat sit');
  });

  it('preserves an answer when the next step builds on it', async () => {
    const tutorial = useTutorialStore.getState();
    await tutorial.startLesson('basics-anchors');
    useRegexStore.getState().loadPattern(String.raw`^\w+`, 'g');
    tutorial.next();
    expect(useRegexStore.getState().pattern).toBe(String.raw`^\w+`);
    tutorial.goTo(1);
    expect(useRegexStore.getState().pattern).toBe(String.raw`^\w+`);
  });
});

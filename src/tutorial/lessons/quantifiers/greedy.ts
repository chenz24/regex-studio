import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Greedy: the default behavior',
    summary: 'Quantifiers consume as much as possible by default — often too much.',
    s1_title: 'See what `<.+>` matches',
    s1_body: [
      'Trying to "match every HTML tag", a beginner naturally writes `<.+>`.',
      'Set the pattern to `<.+>`, then **count** the matches.',
    ].join('\n'),
    s1_hint: '`.+` is greedy — it stretches as far right as possible until the whole pattern can still match.',
    s2_title: 'It overshot',
    s2_body: [
      'Only **1** match, spanning from the first `<` all the way to the last `>`.',
      '',
      'Reason: `.+` is **greedy** by default — it grabs as much as it can, then backtracks until the entire pattern succeeds. The result is one match that spans multiple tags.',
      '',
      'Click "Next" to see how to make it stop early.',
    ].join('\n'),
  },
  zh: {
    title: '贪婪：默认行为',
    summary: '量词默认尽可能多地吃，常常会"吃过头"。',
    s1_title: '看看 `<.+>` 匹配了什么',
    s1_body: [
      '想"匹配每一个 HTML 标签"的人很自然地会写 `<.+>`。',
      '把 pattern 改成 `<.+>`，然后**数一数**有几个匹配。',
    ].join('\n'),
    s1_hint: '`.+` 是贪婪的——它会尽量往右吃，直到再也找不到能让整个 pattern 匹配的位置为止。',
    s2_title: '它"吃过头"了',
    s2_body: [
      '只有 **1** 个匹配，而且这个匹配从第一个 `<` 一路吃到最后一个 `>`。',
      '',
      '原因：`.+` 默认**贪婪**——它先尝试匹配尽量多的字符，再一步一步回退，直到 pattern 整体能成功为止。结果就是它跨越了多个标签。',
      '',
      '点击"下一步"，看怎么让它克制一点。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const greedyLesson: Lesson = {
  id: 'quantifiers-greedy',
  trackId: 'quantifiers',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 4,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: '<b>bold</b> and <i>italic</i> text',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('<.+>'), v.matchesAtLeast(1)),
      hints: [t.s1_hint],
      spotlight: {
        patternSubstrings: ['.+'],
        openPanel: 'explanation',
        scrollExplanation: true,
      },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'quantifiers-lazy',
};

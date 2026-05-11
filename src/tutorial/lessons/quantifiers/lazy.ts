import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Lazy: append `?` to a quantifier',
    summary: 'Make the quantifier consume **as little as possible** so each tag matches on its own.',
    s1_title: 'Change `+` to `+?`',
    s1_body: [
      'Append `?` to a quantifier to make it **lazy**: start with the smallest count and stop as soon as the match succeeds.',
      '',
      'Change the pattern to `<.+?>` — you should get **4** independent tag matches.',
    ].join('\n'),
    s1_hint: '`+?`, `*?`, `??` are the lazy counterparts.',
    s1_explanation: '`.+?` stops as soon as it sees a `>`, so each tag is matched separately.',
    s2_title: 'Recap',
    s2_body: [
      'Remember:',
      '',
      '- Default **greedy**: as much as possible',
      '- Append `?` for **lazy**: as little as possible',
      '- For HTML / quoted strings, lazy is often what you want',
      '',
      'But a more robust approach is **negated character classes**, e.g. `<[^>]+>` simply forbids crossing `>`. Next lesson: precise counts.',
    ].join('\n'),
  },
  zh: {
    title: '懒惰：在量词后加 `?`',
    summary: '让量词尽可能**少**吃，每个标签独立匹配。',
    s1_title: '把 `+` 改成 `+?`',
    s1_body: [
      '在量词后追加 `?` 把它变成**懒惰**模式：从最少的次数开始尝试，能成功就停。',
      '',
      '把 pattern 改成 `<.+?>`，应该会得到 **4** 个独立的标签匹配。',
    ].join('\n'),
    s1_hint: '`+?` `*?` `??` 都是对应的懒惰版本。',
    s1_explanation: '`.+?` 一旦遇到 `>` 就停止，于是每个标签独立。',
    s2_title: '小结',
    s2_body: [
      '记忆要点：',
      '',
      '- 默认**贪婪**：吃尽量多',
      '- 加 `?` 变**懒惰**：吃尽量少',
      '- 解析 HTML / 引号字符串等场景里，懒惰常常是你想要的',
      '',
      '不过更稳的做法其实是**字符类取反**：比如 `<[^>]+>`，根本不让它跨过 `>`。下一课讲量词的精确控制。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const lazyLesson: Lesson = {
  id: 'quantifiers-lazy',
  trackId: 'quantifiers',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 3,
  initialState: {
    engine: 'javascript',
    pattern: '<.+>',
    flags: 'g',
    testText: '<b>bold</b> and <i>italic</i> text',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('<.+?>'), v.matchesExactly(4)),
      hints: [t.s1_hint],
      solution: { pattern: '<.+?>', explanation: t.s1_explanation },
      spotlight: {
        patternSubstrings: ['.+?'],
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
  nextLessonId: 'quantifiers-counted',
};

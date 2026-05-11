import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Quantifiers intro: `+ * ?`',
    summary: 'Repeat a token to match runs of characters.',
    s1_title: '`+` — one or more',
    s1_body: [
      '`+` makes the preceding token repeat **one or more times**.',
      '',
      'Write `\\d+` to match each consecutive run of digits as a whole.',
    ].join('\n'),
    s1_hint: 'Think of `\\d` as "one digit" and `\\d+` as "at least one digit".',
    s2_title: '`?` — optional',
    s2_body: [
      '`?` makes the preceding token appear **zero or one time** — a classic way to express an optional letter.',
      '',
      'In the new text, write a pattern matching both "color" and "colour".',
    ].join('\n'),
    s2_hint: 'British spelling has an extra `u` — make it optional.',
    s2_explanation: '`u?` means u may or may not be there, so both color and colour match.',
    s3_title: '`*` — zero or more',
    s3_body: [
      '`*` means **zero or more** — like `+`, but it also accepts "not at all".',
      '',
      'In the new text, write a pattern matching `color`, `colour`, and `colouur`.',
    ].join('\n'),
    s3_hint: 'Let `u` appear any number of times (including 0).',
    s4_title: 'Recap',
    s4_body: [
      'The three quantifiers:',
      '',
      '- `+` one or more',
      '- `*` zero or more',
      '- `?` zero or one (optional)',
      '',
      'Track 1 done. Next we go deeper into **greedy vs lazy** and exact counts `{n,m}`.',
    ].join('\n'),
  },
  zh: {
    title: '量词初探：`+ * ?`',
    summary: '让一个 token 重复出现，搞定一连串字符的匹配。',
    s1_title: '`+` —— 一次或多次',
    s1_body: [
      '`+` 让前面的 token **重复 1 次或更多**。',
      '',
      '写一个 pattern：`\\d+`，把所有连续数字串作为整体匹配。',
    ].join('\n'),
    s1_hint: '想象 `\\d` 是 "一个数字"，`\\d+` 是 "至少一个数字"。',
    s2_title: '`?` —— 可有可无',
    s2_body: [
      '`?` 让前面的 token **出现 0 次或 1 次**——典型用法是表示"可选字母"。',
      '',
      '换一段测试文本，写一个能同时匹配 "color" 和 "colour" 的 pattern。',
    ].join('\n'),
    s2_hint: '英式拼写多了一个 `u`，让它变成可选。',
    s2_explanation: '`u?` 表示 u 可有可无，于是 color / colour 都能匹配。',
    s3_title: '`*` —— 零次或多次',
    s3_body: [
      '`*` 表示**0 次或更多次**——比 `+` 多了"可以一次都不出现"这种情况。',
      '',
      '在新文本里，写一个 pattern 同时匹配 `color`、`colour`、`colouur`。',
    ].join('\n'),
    s3_hint: '让 `u` 出现任意多次（含 0）。',
    s4_title: '小结',
    s4_body: [
      '量词三剑客：',
      '',
      '- `+` 一次或多次',
      '- `*` 零次或多次',
      '- `?` 零次或一次（可选）',
      '',
      'Track 1 完结。下一阶段我们深入量词的**贪婪/懒惰**与精确控制 `{n,m}`。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const quantifiersIntroLesson: Lesson = {
  id: 'basics-quantifiers',
  trackId: 'basics',
  title: t.title,
  summary: t.summary,
  difficulty: 'beginner',
  estimatedMinutes: 5,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'Order 2025 has 42 items.',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('\\d+'), v.matchesExactly(2)),
      hints: [t.s1_hint],
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      setup: { testText: 'color or colour' },
      validate: v.all(v.patternEquals('colou?r'), v.matchesExactly(2)),
      hints: [t.s2_hint],
      solution: {
        pattern: 'colou?r',
        explanation: t.s2_explanation,
      },
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      setup: { testText: 'color colour colouur' },
      validate: v.all(v.patternEquals('colou*r'), v.matchesExactly(3)),
      hints: [t.s3_hint],
      solution: { pattern: 'colou*r' },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'quantifiers-greedy',
};

import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Negative lookahead `(?!...)`',
    summary: 'Assert what does **not** follow — useful to filter "looks like but isn\'t".',
    s1_title: 'Exclude "dollars" digits',
    s1_body: [
      'Goal: every digit run except the ones followed by " dollars".',
      '',
      'Write `\\d+(?! dollars)` — you should get **2** matches (10 and 7).',
    ].join('\n'),
    s1_hints: [
      '`(?!...)` is also zero-width — failure abandons this match position.',
      'Like positive lookahead, the match does **not** include " dollars".',
    ],
    s1_explanation: '"5 dollars" is excluded because " dollars" follows; "10 euros" and "7 yen" pass.',
    s2_title: 'A common pitfall',
    s2_body: [
      '`(?!...)` is a zero-width check; it doesn\'t change the greedy behavior of `\\d+`.',
      '',
      'For `\\d+(?! dollars)` against `"50 dollars"`:',
      '',
      '1. `\\d+` greedily takes "50"',
      '2. Followed by " dollars" → negative lookahead **fails**',
      '3. `\\d+` backs off to "5", lookahead now checks "0 dollars" → **passes**',
      '4. Result: "5" is matched, "0" is discarded',
      '',
      'To avoid this "digit slicing", add a boundary, e.g. `\\b\\d+\\b(?! dollars)`.',
    ].join('\n'),
    s3_title: 'Recap',
    s3_body: [
      'Key points:',
      '',
      '- `(?!...)` — zero-width negative lookahead',
      '- Great for filtering out "shouldn\'t-match" shapes',
      '- Watch for **backtracking**: a greedy quantifier may retry after a failed assertion',
      '',
      'Next: `(?<=...)` and `(?<!...)` — **looking back**.',
    ].join('\n'),
  },
  zh: {
    title: '否定先行 `(?!...)`',
    summary: '断言后面**没有**某个模式——经常用来过滤"看起来像但不是"的内容。',
    s1_title: '排除 "dollars" 的数字',
    s1_body: [
      '想要：所有数字，但**不要**后面跟着 " dollars" 的。',
      '',
      '写 `\\d+(?! dollars)`，应该匹配 **2** 处（10 和 7）。',
    ].join('\n'),
    s1_hints: [
      '`(?!...)` 也是零宽：失败就放弃当前匹配位置。',
      '注意：和正向先行一样，匹配里**不**包含 " dollars" 这部分内容。',
    ],
    s1_explanation: '"5 dollars" 因为后跟 " dollars" 被排除；"10 euros" 和 "7 yen" 通过。',
    s2_title: '一个常见陷阱',
    s2_body: [
      '`(?!...)` 是**零宽**断言，它只检查紧跟的位置，不会改变 `\\d+` 的贪婪行为。',
      '',
      '比如 `\\d+(?! dollars)` 在 `"50 dollars"` 上：',
      '',
      '1. `\\d+` 贪婪吃下 "50"',
      '2. 后面是 " dollars"，否定先行**失败**',
      '3. `\\d+` 回退到 "5"，否定先行检查 "0 dollars"——**成功**',
      '4. 结果："5" 被当作匹配，"0" 被丢弃',
      '',
      '想要避免这种"切碎数字"，常见做法是再加一个边界，例如 `\\b\\d+\\b(?! dollars)`。',
    ].join('\n'),
    s3_title: '小结',
    s3_body: [
      '本课要点：',
      '',
      '- `(?!...)` —— 零宽否定先行',
      '- 适合"过滤掉不该匹配的形式"',
      '- 警惕**回溯**：贪婪量词会因否定断言失败而退一步再试',
      '',
      '下一课：`(?<=...)` 与 `(?<!...)`——**往前看**。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const negativeLookaheadLesson: Lesson = {
  id: 'lookaround-negative-lookahead',
  trackId: 'lookaround',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 4,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: '5 dollars and 10 euros and 7 yen',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('\\d+(?! dollars)'), v.matchesExactly(2)),
      hints: t.s1_hints,
      solution: {
        pattern: '\\d+(?! dollars)',
        explanation: t.s1_explanation,
      },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.always(),
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'lookaround-lookbehind',
};

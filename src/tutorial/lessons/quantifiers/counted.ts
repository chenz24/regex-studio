import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: '`{n,m}`: precise repetition counts',
    summary: 'Use braces to express "exactly n", "n to m", and "at least n" times.',
    s1_title: '`\\d{3}` — exactly 3',
    s1_body: [
      '`{n}` means exactly n repetitions.',
      '',
      'Write `\\d{3}` to find every "3-digit" run. Note it **also** carves 3 digits out of longer runs.',
    ].join('\n'),
    s1_hint: '"1234" yields one match "123"; the remaining "4" is too short to form another.',
    s2_title: '`\\d{3,5}` — 3 to 5 (greedy)',
    s2_body: [
      '`{n,m}` gives a range — still greedy by default, so it prefers 5 over 3 when possible.',
      '',
      'Change the pattern to `\\d{3,5}`. The match count is the same as before, but **each match is longer**.',
    ].join('\n'),
    s2_hint: 'Still 3 matches: 555 / 1234 / 56789.',
    s3_title: '`\\d{2,}` — at least 2',
    s3_body: [
      '`{n,}` drops the upper bound — "at least n" repetitions.',
      '',
      'Change the pattern to `\\d{2,}`. Now "78" also gets in.',
    ].join('\n'),
    s4_title: 'Recap',
    s4_body: [
      'Counted quantifiers:',
      '',
      '- `{n}` exactly',
      '- `{n,m}` range',
      '- `{n,}` at least',
      '- Each has a lazy version: `{n,m}?`',
      '',
      'Next is the most important lesson of this track: **backtracking traps**.',
    ].join('\n'),
  },
  zh: {
    title: '`{n,m}`：精确控制次数',
    summary: '用花括号写出"恰好 n 次"、"n 到 m 次"、"至少 n 次"。',
    s1_title: '`\\d{3}` —— 恰好 3 个',
    s1_body: [
      '`{n}` 表示恰好重复 n 次。',
      '',
      '写 `\\d{3}`，找出文本里的"3 位数字"片段。注意它**也会**从更长的数字串里切出 3 位。',
    ].join('\n'),
    s1_hint: '"1234" 会被切成一段 "123"，剩下的 "4" 不够 3 位就放弃。',
    s2_title: '`\\d{3,5}` —— 3 到 5 个（贪婪）',
    s2_body: [
      '`{n,m}` 给一个范围，仍然默认贪婪——能匹配 5 个就不会只匹配 3 个。',
      '',
      '把 pattern 改成 `\\d{3,5}`，看看匹配数和上一步是不是一样，但**每个匹配的长度**变长了。',
    ].join('\n'),
    s2_hint: '仍然是 3 个匹配：555 / 1234 / 56789。',
    s3_title: '`\\d{2,}` —— 至少 2 个',
    s3_body: [
      '`{n,}` 省掉上限，表示"至少 n 次"。',
      '',
      '把 pattern 改成 `\\d{2,}`，这时候连 "78" 也能进来了。',
    ].join('\n'),
    s4_title: '小结',
    s4_body: [
      '量词写法：',
      '',
      '- `{n}` 恰好',
      '- `{n,m}` 范围',
      '- `{n,}` 至少',
      '- 各自都有懒惰版本：`{n,m}?`',
      '',
      '下一课是这条线最重要的一节：**回溯陷阱**。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const countedLesson: Lesson = {
  id: 'quantifiers-counted',
  trackId: 'quantifiers',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 4,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'Phone: 555-1234, code 56789, ext 78',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('\\d{3}'), v.matchesExactly(3)),
      hints: [t.s1_hint],
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.all(v.patternEquals('\\d{3,5}'), v.matchesExactly(3)),
      hints: [t.s2_hint],
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(v.patternEquals('\\d{2,}'), v.matchesExactly(4)),
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'quantifiers-backtracking',
};

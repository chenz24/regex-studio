import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Named groups and non-capturing groups',
    summary: '`(?<name>...)` gives a group a name; `(?:...)` groups without capturing — lighter.',
    s1_title: 'Named group `(?<name>...)`',
    s1_body: [
      'Match ISO dates and **name** the year/month/day parts — no need to remember indexes in code or replacements.',
      '',
      'Pattern: `(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})`.',
    ].join('\n'),
    s1_hint: 'Syntax is `(?<name>...)`. Names allow letters, digits, underscores, and must start with a letter.',
    s1_explanation: 'In replacements use `$<year>`; in JS read `match.groups.year`.',
    s2_title: 'Non-capturing group `(?:...)`',
    s2_body: [
      'When you only need "grouping for a quantifier or to scope `|`", and you do **not** want to claim a group index, use `(?:...)`.',
      '',
      'Switch the text and match the three honorifics. Requirement: **just one whole-match** column, no group 1.',
    ].join('\n'),
    s2_hints: [
      'Try `(?:Mrs|Mr|Ms)\\. \\w+` — `(?:...)` groups without capturing.',
      'Put `Mrs` first so `Mr` does not match-and-then-backtrack.',
    ],
    s2_explanation: 'The matches panel shows **no group 1**, and the engine spends less bookkeeping.',
    s3_title: 'Recap',
    s3_body: [
      'Key points:',
      '',
      '- `(?<name>...)` — named group; `\\k<name>` is its backreference',
      '- `(?:...)` — group only, no capture; faster and more readable',
      '- Replacements: numbered groups `$1`, named groups `$<name>`',
      '',
      '🎉 Track 3 complete. Next: **lookaround** — assert without consuming.',
    ].join('\n'),
  },
  zh: {
    title: '命名组与非捕获组',
    summary: '`(?<name>...)` 给捕获组起名字；`(?:...)` 只分组不捕获，更轻量。',
    s1_title: '命名组 `(?<name>...)`',
    s1_body: [
      '匹配 ISO 日期，并把年/月/日**分别命名**——这样在替换或代码里都不用记编号了。',
      '',
      '写 pattern：`(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})`。',
    ].join('\n'),
    s1_hint: '语法是 `(?<名字>...)`。名字只允许字母数字下划线，且必须以字母开头。',
    s1_explanation: '替换时可用 `$<year>` 引用；JS 里通过 `match.groups.year` 拿到值。',
    s2_title: '非捕获组 `(?:...)`',
    s2_body: [
      '当你只想"分组以便加量词或限定 `|` 范围"，并**不想**真的占用一个 group 编号时，用 `(?:...)`。',
      '',
      '换一段文本，匹配三种称呼。要求**只有 1 个全文匹配**，没有 group 1。',
    ].join('\n'),
    s2_hints: [
      '尝试 `(?:Mrs|Mr|Ms)\\. \\w+` —— `(?:...)` 只分组不捕获。',
      '把 Mrs 放最前面，避免 Mr 先匹配后失败回退。',
    ],
    s2_explanation: '匹配结果列表里**没有 group 1**，正则引擎也省掉一次记录。',
    s3_title: '小结',
    s3_body: [
      '本课要点：',
      '',
      '- `(?<name>...)` —— 命名组；`\\k<name>` 反向引用',
      '- `(?:...)` —— 只分组不捕获，性能更优、可读性更好',
      '- 替换字符串：编号组 `$1`，命名组 `$<name>`',
      '',
      '🎉 Track 3 完结。下一阶段：**lookaround**——在不消耗字符的情况下做断言。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const namedAndNonCapturingLesson: Lesson = {
  id: 'groups-named-and-noncapturing',
  trackId: 'groups',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 5,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'Born 1990-05-15. Joined 2019-03-22.',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(
        v.patternEquals('(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})'),
        v.matchesExactly(2),
      ),
      hints: [t.s1_hint],
      solution: {
        pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})',
        explanation: t.s1_explanation,
      },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      setup: { testText: 'Hi Mr. Smith, Mrs. Jones, Ms. Doe today.' },
      validate: v.all(v.patternEquals('(?:Mrs|Mr|Ms)\\. \\w+'), v.matchesExactly(3)),
      hints: t.s2_hints,
      solution: {
        pattern: '(?:Mrs|Mr|Ms)\\. \\w+',
        explanation: t.s2_explanation,
      },
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'lookaround-lookahead',
};

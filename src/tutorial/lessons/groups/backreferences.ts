import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Backreferences: reuse what you captured',
    summary: '`\\1` `\\2` refer to the actual text matched by the Nth group — useful for duplicate words, paired quotes, etc.',
    s1_title: 'Find repeated adjacent words',
    s1_body: [
      '"the the" is a classic accidental repetition in writing.',
      '',
      'Write `(\\w+) \\1` — the first `\\w+` captures a word; `\\1` requires the **exact same** content right after.',
    ].join('\n'),
    s1_hints: [
      '`\\1` is not a digit 1 — it is backslash + digit.',
      '`(\\w+) \\1` — note the literal space between them.',
    ],
    s1_explanation: 'The content of `\\1` is whatever group 1 captured **in this match**.',
    s2_title: 'Paired quotes',
    s2_body: [
      'Backreferences also enforce "matching open/close symbols".',
      '',
      'Switch the test text. Write `(["\\\'])(.*?)\\1` — group 1 captures a quote (`"` or `\'`), `.+?` matches anything in the middle lazily, then `\\1` requires the **same** quote to close.',
    ].join('\n'),
    s2_hints: [
      "`'` does not need escaping inside a character class, but a JS string literal needs `\\'`.",
      "The pattern is `(['\"])(.*?)\\1` (no spaces).",
    ],
    s2_explanation: 'Only same-quote pairs match: `"hi"` and `\'bye\'`. The mismatched `"mismatched\'` is left alone.',
    s3_title: 'Recap',
    s3_body: [
      'Key points:',
      '',
      '- `\\1`, `\\2`, ... reference the **actual text** captured by the corresponding group',
      '- In replacement strings use `$1`, `$2` (not `\\1`)',
      '- Named-group backreference: `\\k<name>` (next lesson)',
      '',
      'Next: **named groups** and **non-capturing groups**.',
    ].join('\n'),
  },
  zh: {
    title: '反向引用：在 pattern 里"复用"已捕获的内容',
    summary: '`\\1` `\\2` 引用第 N 个捕获组实际匹配到的字符串——可以发现重复词、配对引号等。',
    s1_title: '找重复的相邻单词',
    s1_body: [
      '"the the" 这种**意外重复**是写作里很常见的小毛病。',
      '',
      '写 `(\\w+) \\1` —— 第一个 `\\w+` 捕获一个单词，`\\1` 要求紧接着出现**完全一样**的内容。',
    ].join('\n'),
    s1_hints: [
      '`\\1` 不是数字 1，是反斜杠 + 数字。',
      '`(\\w+) \\1` —— 注意中间是空格，不是其它符号。',
    ],
    s1_explanation: '`\\1` 的内容是 group 1 在**当次匹配**里实际抓到的字符串。',
    s2_title: '配对引号',
    s2_body: [
      '反向引用还能保证"开闭符号一致"。',
      '',
      '换一段文本，写 `(["\\\'])(.*?)\\1` —— 第一个组捕获引号字符（`"` 或 `\'`），中间懒惰匹配任意内容，末尾用 `\\1` 要求**同一种引号**收尾。',
    ].join('\n'),
    s2_hints: [
      '字符类里 `\'` 不需要转义，但写成 JS 字符串时要 `\\\'`。',
      'pattern 是 `(["\']) (.*?) \\1`（去掉空格）。',
    ],
    s2_explanation: '只匹配引号一致的两段：`"hi"` 和 `\'bye\'`。错配的 `"mismatched\'` 不会被吞。',
    s3_title: '小结',
    s3_body: [
      '本课要点：',
      '',
      '- `\\1`、`\\2`... 引用前面的捕获组**当次实际匹配到的内容**',
      '- 替换字符串里用 `$1`、`$2`（不是 `\\1`）',
      '- 命名组的反向引用：`\\k<name>`（下一课）',
      '',
      '下一课：**命名组**和**非捕获组**。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const backreferencesLesson: Lesson = {
  id: 'groups-backreferences',
  trackId: 'groups',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 4,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'the the cat sat sat down.',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('(\\w+) \\1'), v.matchesExactly(2)),
      hints: t.s1_hints,
      solution: {
        pattern: '(\\w+) \\1',
        explanation: t.s1_explanation,
      },
      spotlight: {
        patternSubstrings: ['\\1'],
        openPanel: 'explanation',
        scrollExplanation: true,
      },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      setup: { testText: 'He said "hi" and \'bye\' but said "mismatched\'.' },
      validate: v.all(v.patternEquals('(["\'])(.*?)\\1'), v.matchesExactly(2)),
      hints: t.s2_hints,
      solution: {
        pattern: '(["\'])(.*?)\\1',
        explanation: t.s2_explanation,
      },
      spotlight: { patternSubstrings: ['\\1'] },
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'groups-named-and-noncapturing',
};

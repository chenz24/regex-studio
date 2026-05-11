import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXT = [
  'See [the docs](https://example.com/docs) and [issues](https://example.com/issues).',
  'Reference [Wikipedia](https://en.wikipedia.org/wiki/Regex) for background.',
  'A pitfall: [bad text]still here](url).',
].join('\n');

const TEXTS = {
  en: {
    title: 'Match Markdown links `[text](url)`',
    summary: 'Pitfalls of lazy quantifiers, negated character classes, and why `[^\\]]+` is almost always safer.',
    s1_title: 'A lazy attempt',
    s1_body: [
      'To grab `[text](url)` Markdown links, lazy quantifiers come to mind:',
      '',
      '`\\[(.+?)\\]\\((.+?)\\)`',
      '',
      '`.+?` means "match as little as possible", stopping at the first `]` or `)`.',
    ].join('\n'),
    s1_hint: '`[` `]` `(` `)` all need escaping.',
    s2_title: 'Look at line 3',
    s2_body: [
      'In the matches list, line 3 — `[bad text]still here](url)` — also got captured. The "text" group becomes `bad text]still here` — it **crossed a `]`**.',
      '',
      'Lazy quantifiers only promise "as short as possible", but when the rest fails they will **backtrack and grow**. `.+?` cannot prevent crossing `]`.',
      '',
      'Sturdier approach: **negated character classes** — tell the engine "no `]` allowed here".',
    ].join('\n'),
    s3_title: 'Negated character classes',
    s3_body: [
      'Replace the text part with `[^\\]]+` (one or more "not `]`"), and url with `[^)]+`:',
      '',
      '`\\[([^\\]]+)\\]\\(([^)]+)\\)`',
      '',
      'Now `bad text]still here` from line 3 is no longer matched — only content up to the first `]` is allowed.',
    ].join('\n'),
    s3_hints: [
      '`]` inside `[^\\]]` must be escaped too.',
      '`)` inside `[^)]` does **not** need escaping (`(`/`)` are literal in a character class).',
    ],
    s3_explanation: 'A negated class blocks "illegal" characters at the gate — more precise than `.+?`, and no backtracking required.',
    s4_title: 'Recap',
    s4_body: [
      'Key points:',
      '',
      '- Lazy ≠ "won\'t cross delimiters" — it just means "short first, grow on failure"',
      '- To truly forbid a character, **use a negated character class**',
      '- Rule of thumb: if you can stuff the delimiter into `[^...]`, do it',
    ].join('\n'),
  },
  zh: {
    title: '抓 Markdown 链接 `[text](url)`',
    summary: '懒惰量词的陷阱、字符类取反，以及为什么 `[^\\]]+` 几乎总是更稳。',
    s1_title: '懒惰版的尝试',
    s1_body: [
      '想抓 `[text](url)` 这种 Markdown 链接，自然想到懒惰量词：',
      '',
      '`\\[(.+?)\\]\\((.+?)\\)`',
      '',
      '`.+?` 表示"尽量少地匹配任意字符"，刚好停在第一个 `]` 或 `)` 上。',
    ].join('\n'),
    s1_hint: '`[` `]` `(` `)` 都要转义。',
    s2_title: '看看第三行',
    s2_body: [
      '看匹配列表：第三行 `[bad text]still here](url)` 也被抓了——但抓出来的 text 部分是 `bad text]still here`，**跨过了一个 `]`**。',
      '',
      '懒惰量词只保证"尽量短"，但当外层失败它**还是会回退**继续吃。`.+?` 不能阻止它跨越 `]`。',
      '',
      '更稳的做法：用**字符类取反** —— 直接告诉引擎"这里不许出现 `]`"。',
    ].join('\n'),
    s3_title: '取反字符类',
    s3_body: [
      '把 text 部分换成 `[^\\]]+`（一个或多个"不是 `]`"的字符），url 部分换成 `[^)]+`：',
      '',
      '`\\[([^\\]]+)\\]\\(([^)]+)\\)`',
      '',
      '现在第三行的 `bad text]still here` 不会被吃掉——因为只允许第一个 `]` 之前的内容。',
    ].join('\n'),
    s3_hints: [
      '`[^\\]]` 字符类内的 `]` 也要转义。',
      '`[^)]` 内的 `)` 不需要转义（`(` `)` 在字符类里是字面量）。',
    ],
    s3_explanation: '取反字符类把"非法字符"挡在外面，比 `.+?` 更准、不依赖回溯。',
    s4_title: '小结',
    s4_body: [
      '本课要点：',
      '',
      '- 懒惰量词 ≠ "不会跨越分隔符"——它只是"先短后长"',
      '- 想真正限制"不能出现某字符"，**用取反字符类**',
      '- 经验法则："如果你能把分隔符塞进 `[^...]` 里，就这么写"',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const markdownLinkLesson: Lesson = {
  id: 'practical-markdown-link',
  trackId: 'practical',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 6,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: TEXT,
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(
        v.patternEquals('\\[(.+?)\\]\\((.+?)\\)'),
        v.matchesAtLeast(3),
      ),
      hints: [t.s1_hint],
      spotlight: { patternSubstrings: ['(.+?)'], openPanel: 'matches' },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.always(),
      spotlight: { patternSubstrings: ['(.+?)'] },
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(
        v.patternEquals('\\[([^\\]]+)\\]\\(([^)]+)\\)'),
        v.matchesExactly(3),
      ),
      hints: t.s3_hints,
      solution: {
        pattern: '\\[([^\\]]+)\\]\\(([^)]+)\\)',
        explanation: t.s3_explanation,
      },
      spotlight: { patternSubstrings: ['([^\\]]+)', '([^)]+)'], openPanel: 'matches' },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'practical-csv',
};

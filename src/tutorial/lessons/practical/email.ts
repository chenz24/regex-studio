import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXT = [
  'Reach out: hello@example.com or sales@example.org.',
  'Engineering: alice+filter@mail.sub.example.io',
  'Phone (no email): 555-1234, see you soon!',
  'Bad ones: bob@host (no TLD), @nope.com, user@.com',
].join('\n');

const TEXTS = {
  en: {
    title: 'Extract emails from text',
    summary: 'Combine character classes, `+`, escaping, and `\\b` to extract real emails.',
    s1_title: 'The naive approach',
    s1_body: [
      'Seeing "email", the natural first try is `\\S+@\\S+` — non-whitespace + `@` + non-whitespace.',
      '',
      'Type it into the pattern and see how many matches you get.',
    ].join('\n'),
    s1_hint: '`\\S` matches "any non-whitespace character".',
    s2_title: 'Problem: it grabs punctuation',
    s2_body: [
      'Look at the first line — the trailing `.` after `hello@example.com` was eaten too. `\\S+` is too greedy.',
      '',
      'Use stricter character classes: local part allows `[\\w.+-]`, host allows `[\\w-]`, joined by `\\.`.',
      '',
      'Change the pattern to `[\\w.+-]+@[\\w-]+\\.\\w+`. You should get **3** real emails.',
    ].join('\n'),
    s2_hints: [
      'Local part: `[\\w.+-]+`',
      'Host: `[\\w-]+`',
      'Then `\\.\\w+` for "dot + TLD".',
    ],
    s3_title: 'Stricter TLD',
    s3_body: [
      '`\\w+` lets the TLD be anything; in practice valid TLDs are at least 2 **letters**, no digits.',
      '',
      'Replace the trailing `\\w+` with `[a-zA-Z]{2,}`.',
    ].join('\n'),
    s3_hint: '`[a-zA-Z]{2,}` = at least 2 letters.',
    s4_title: 'Add word boundaries',
    s4_body: [
      'Finally, clamp the whole email with `\\b` on both sides to avoid bleeding into neighbors: `\\b...\\b`.',
      '',
      'Final pattern: `\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b`.',
    ].join('\n'),
    s4_explanation: 'Boundary + local + `@` + host + `.TLD` + boundary — the standard "good enough" email extractor.',
    s5_title: 'Recap',
    s5_body: [
      'Key points:',
      '',
      '- In real text `\\S+` is almost always too broad — use specific character classes',
      '- Express "at least N occurrences" with `{n,}`',
      '- `\\b` shields you from neighboring punctuation',
      '',
      '⚠️ Note: real RFC 5322 email syntax is **extremely** complex; this pattern is a practical extractor, not a 100% RFC-compliant validator.',
    ].join('\n'),
  },
  zh: {
    title: '从段落里抓邮箱',
    summary: '把字符类、`+`、转义和 `\\b` 组合起来抓出真正的邮箱。',
    s1_title: '最朴素的写法',
    s1_body: [
      '看到 "邮箱"，最直觉的写法是 `\\S+@\\S+`——非空白 + `@` + 非空白。',
      '',
      '把它写进 pattern，看看会抓到几个匹配。',
    ].join('\n'),
    s1_hint: '`\\S` 是"任意非空白字符"。',
    s2_title: '问题：吃了标点',
    s2_body: [
      '注意第一行的匹配——`hello@example.com` 后面那个 `.` 也被抓进去了。`\\S+` 太贪了。',
      '',
      '改用更精确的字符类：本地段允许 `[\\w.+-]`，主机段允许 `[\\w-]`，中间再用 `\\.` 串起来。',
      '',
      '把 pattern 改成 `[\\w.+-]+@[\\w-]+\\.\\w+`，应该恰好抓到 **3** 个真正的邮箱。',
    ].join('\n'),
    s2_hints: [
      '本地段：`[\\w.+-]+`',
      '主机段：`[\\w-]+`',
      '后面再 `\\.\\w+` 表示"点 + TLD"。',
    ],
    s3_title: '更严格的 TLD',
    s3_body: [
      '`\\w+` 让 TLD 任意长度，但其实合法 TLD 至少 2 个**字母**，不应该有数字。',
      '',
      '把末尾的 `\\w+` 换成 `[a-zA-Z]{2,}`。',
    ].join('\n'),
    s3_hint: '`[a-zA-Z]{2,}` ＝ 至少 2 个字母。',
    s4_title: '加上词边界',
    s4_body: [
      '最后用 `\\b` 把整个邮箱"夹紧"，避免被前后字符干扰：`\\b...\\b`。',
      '',
      '完整 pattern：`\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b`。',
    ].join('\n'),
    s4_explanation: '边界 + 本地段 + `@` + 主机 + `.TLD` + 边界，是最常见的"足够好"的邮箱抽取式。',
    s5_title: '小结',
    s5_body: [
      '本课要点：',
      '',
      '- 真实场景里 `\\S+` 几乎总是太宽——用具体字符类',
      '- 想表达"至少 N 次某种字符"用 `{n,}`',
      '- `\\b` 帮你避免被相邻标点污染',
      '',
      '⚠️ 注意：RFC 5322 真正的邮箱语法**非常**复杂，这里这种 pattern 只是工程实践里的"够用"版本，不是 100% 合规验证器。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const emailLesson: Lesson = {
  id: 'practical-email',
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
      validate: v.all(v.patternEquals('\\S+@\\S+'), v.matchesAtLeast(3)),
      hints: [t.s1_hint],
      spotlight: { patternSubstrings: ['\\S+'], openPanel: 'matches' },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.all(
        v.patternEquals('[\\w.+-]+@[\\w-]+\\.\\w+'),
        v.matchesExactly(3),
      ),
      hints: t.s2_hints,
      solution: { pattern: '[\\w.+-]+@[\\w-]+\\.\\w+' },
      spotlight: { patternSubstrings: ['[\\w.+-]+', '[\\w-]+'], openPanel: 'matches' },
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(
        v.patternEquals('[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}'),
        v.matchesExactly(3),
      ),
      hints: [t.s3_hint],
      spotlight: { patternSubstrings: ['[a-zA-Z]{2,}'] },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.all(
        v.patternEquals('\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b'),
        v.matchesExactly(3),
      ),
      solution: {
        pattern: '\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b',
        explanation: t.s4_explanation,
      },
      spotlight: { patternSubstrings: ['\\b'] },
    },
    {
      id: 's5',
      title: t.s5_title,
      body: t.s5_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'practical-url',
};

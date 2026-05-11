import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Anchors: match only at specific positions',
    summary: '`^` `$` `\\b` `\\B` match positions, not characters.',
    s1_title: '`^` — start of string',
    s1_body: [
      '`^` matches no character — it matches a **position**: by default, the start of the whole string.',
      '',
      'Write `^\\w+` to highlight the first word at the start.',
    ].join('\n'),
    s1_hint: '`\\w+` means "one or more word characters".',
    s2_title: '`m` flag — make `^` and `$` line-aware',
    s2_body: [
      'With the `m` (multiline) flag on, `^` and `$` fire at the start/end of every line.',
      '',
      'Keep the pattern, turn on `m`. The match count should become **3**.',
    ].join('\n'),
    s3_title: '`$` — end of line/string',
    s3_body: [
      '`$` mirrors `^`: it matches the end of the string (or each line with `m`).',
      '',
      'Change the pattern to `\\w+$` and use the `m` flag to highlight the last word of each line.',
    ].join('\n'),
    s3_hint: '`\\w+$` — a run of word characters right against the line end.',
    s4_title: '`\\b` and `\\B` — word boundaries',
    s4_body: [
      '`\\b` matches the seam **between a word character and a non-word character**; `\\B` matches the opposite — both sides are the same kind.',
      '',
      'In the new text, use `\\Bcat\\B` to find a "cat" embedded inside another word.',
    ].join('\n'),
    s4_hints: [
      'We want a "cat" with **word characters on both sides**.',
      '`\\Bcat\\B` — note the capital `B` for the negation.',
    ],
    s4_explanation: 'Only the "cat" inside "concatenation" has letters on both sides → `\\B` succeeds twice.',
    s5_title: 'Recap',
    s5_body: [
      'Key points:',
      '',
      '- `^` and `$` are **positions**, not characters',
      '- The `m` flag makes them line-aware',
      '- `\\b` word boundary / `\\B` non-boundary',
      '',
      'Next: **quantifiers** — control repetition.',
    ].join('\n'),
  },
  zh: {
    title: '锚点：让正则只在特定位置匹配',
    summary: '`^` `$` `\\b` `\\B` 不匹配字符本身，而是匹配位置。',
    s1_title: '`^` — 字符串开头',
    s1_body: [
      '`^` 不匹配任何字符，它匹配**位置**：默认是整个字符串的开头。',
      '',
      '写一个 pattern：`^\\w+`，把开头的第一个单词圈出来。',
    ].join('\n'),
    s1_hint: '`\\w+` 是"一个或多个单词字符"。',
    s2_title: '`m` flag — 让 `^` 作用于每一行',
    s2_body: [
      '打开 `m`（multiline）flag 后，`^` 与 `$` 会在每行的开头/结尾都触发。',
      '',
      '保持 pattern 不变，打开 `m` flag。匹配数应该变成 **3**。',
    ].join('\n'),
    s3_title: '`$` — 行/串末尾',
    s3_body: [
      '`$` 与 `^` 对称，匹配字符串结尾（开了 `m` 后是每行结尾）。',
      '',
      '把 pattern 改成 `\\w+$`，配合 `m` flag，圈出每行的最后一个单词。',
    ].join('\n'),
    s3_hint: '`\\w+$` —— 一串单词字符紧跟着行尾。',
    s4_title: '`\\b` 与 `\\B` — 词边界',
    s4_body: [
      '`\\b` 匹配**单词字符与非单词字符之间**的位置；`\\B` 反之，匹配两侧都是同一类字符的位置。',
      '',
      '在新的文本里，用 `\\Bcat\\B` 找到嵌在其它单词里的 "cat"。',
    ].join('\n'),
    s4_hints: [
      '我们要找的是**两侧都是单词字符**的 cat。',
      '`\\Bcat\\B` —— 注意取反符是大写的 B。',
    ],
    s4_explanation: '只有 "concatenation" 里的 cat 两侧都是字母 → `\\B` 都成立。',
    s5_title: '小结',
    s5_body: [
      '本课要点：',
      '',
      '- `^` `$` 是**位置**，不是字符',
      '- `m` flag 让 `^` `$` 作用于每行',
      '- `\\b` 词边界 / `\\B` 非词边界',
      '',
      '下一课讲**量词**——让重复的字符变得可控。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const anchorsLesson: Lesson = {
  id: 'basics-anchors',
  trackId: 'basics',
  title: t.title,
  summary: t.summary,
  difficulty: 'beginner',
  estimatedMinutes: 5,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'hello world\nfoo bar\nbaz qux',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('^\\w+'), v.matchesExactly(1)),
      hints: [t.s1_hint],
      spotlight: { patternSubstrings: ['^'] },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.all(v.patternEquals('^\\w+'), v.flagEnabled('m'), v.matchesExactly(3)),
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(v.patternEquals('\\w+$'), v.flagEnabled('m'), v.matchesExactly(3)),
      hints: [t.s3_hint],
      spotlight: { patternSubstrings: ['$'] },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      setup: {
        pattern: '',
        flags: 'g',
        testText: 'the cat is in concatenation. catalog. a cat.',
      },
      validate: v.all(v.patternEquals('\\Bcat\\B'), v.matchesExactly(1)),
      hints: t.s4_hints,
      solution: {
        pattern: '\\Bcat\\B',
        explanation: t.s4_explanation,
      },
      spotlight: { patternSubstrings: ['\\B'] },
    },
    {
      id: 's5',
      title: t.s5_title,
      body: t.s5_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'basics-quantifiers',
};

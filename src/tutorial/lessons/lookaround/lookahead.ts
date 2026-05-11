import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Positive lookahead `(?=...)`',
    summary: 'Assert what follows **without** consuming characters.',
    s1_title: 'Only digits "followed by dollars"',
    s1_body: [
      'We want to grab digits that are immediately followed by " dollars", but **not** include " dollars" itself.',
      '',
      'Write `\\d+(?= dollars)`.',
    ].join('\n'),
    s1_hints: [
      '`(?=...)` is a **zero-width** assertion — it checks the right side without moving the cursor.',
      'The match therefore contains **digits only**, not " dollars".',
    ],
    s1_explanation: 'Matches "5" and "50". The match length is just the digits — " dollars" is not counted.',
    s1_compare_go: '⚠️ **Go (RE2) does not support lookahead.** RE2 uses an NFA to guarantee linear-time matching at the cost of lookaround and backreferences.',
    s1_compare_rust: '⚠️ Rust\'s standard `regex` crate is also RE2-based and **does not support lookahead**. Use `fancy-regex` if you need it.',
    s1_compare_python: 'Python `re` fully supports `(?=...)` / `(?!...)`, behaving like JavaScript.',
    s2_title: 'Recap',
    s2_body: [
      'Key points:',
      '',
      '- `(?=...)` — **zero-width**: never advances the cursor on success',
      '- Great as a "constraint": something must follow for the match to count',
      '- Combined with `\\b` and quantifiers it makes patterns concise',
      '',
      'Next: flip it — `(?!...)` negative lookahead.',
    ].join('\n'),
  },
  zh: {
    title: '正向先行 `(?=...)`',
    summary: '断言后面**有**某个模式，但不消耗字符。',
    s1_title: '只要"后面跟 dollars"的数字',
    s1_body: [
      '我们想抓出后面紧跟 " dollars" 的数字，但**不**把 " dollars" 一起抓出来。',
      '',
      '写 `\\d+(?= dollars)`。',
    ].join('\n'),
    s1_hints: [
      '`(?=...)` 是**零宽断言**——它检查右边但不前移指针。',
      '这意味着匹配结果**只包含数字**，不会把 " dollars" 算进去。',
    ],
    s1_explanation: '匹配的是 "5" 和 "50"，长度只有数字部分，` dollars` 不计入匹配。',
    s1_compare_go: '⚠️ **Go (RE2) 不支持 lookahead**。RE2 用 NFA 保证线性时间匹配，代价就是放弃了 lookaround / 反向引用这类需要回溯的特性。',
    s1_compare_rust: '⚠️ Rust 标准 `regex` crate 也基于 RE2，**不支持 lookahead**。需要的话用 `fancy-regex`。',
    s1_compare_python: 'Python `re` 完整支持 `(?=...)` / `(?!...)`，跟 JavaScript 行为一致。',
    s2_title: '小结',
    s2_body: [
      '本课要点：',
      '',
      '- `(?=...)` —— **零宽**：成功时不前移指针',
      '- 适合用作"约束条件"——必须紧跟着某种内容才算',
      '- 配合 `\\b`、量词等，能写出非常精炼的 pattern',
      '',
      '下一课：把它**反过来**——`(?!...)` 否定先行。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const lookaheadLesson: Lesson = {
  id: 'lookaround-lookahead',
  trackId: 'lookaround',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 4,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: '5 dollars and 10 euros and 50 dollars',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('\\d+(?= dollars)'), v.matchesExactly(2)),
      hints: t.s1_hints,
      solution: {
        pattern: '\\d+(?= dollars)',
        explanation: t.s1_explanation,
      },
      spotlight: {
        patternSubstrings: ['(?= dollars)'],
        openPanel: 'explanation',
        scrollExplanation: true,
      },
      flavorCompare: {
        flavors: ['javascript', 'python', 'go', 'rust'],
        commentary: {
          go: t.s1_compare_go,
          rust: t.s1_compare_rust,
          python: t.s1_compare_python,
        },
      },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'lookaround-negative-lookahead',
};

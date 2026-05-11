import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Character classes: one token, many characters',
    summary: 'Use brackets, ranges, and predefined classes to match a set of characters.',
    s1_title: 'Character set `[abc]`',
    s1_body: [
      'Inside brackets, **any one** of the listed characters matches. Change the pattern to `[abc]` and count the highlights.',
      '',
      'You should get **6** matches (`a` 4 times, `b` once, `c` once).',
    ].join('\n'),
    s1_hint: 'Just type `[abc]`. Each character matches on its own.',
    s2_title: 'Range `[a-e]`',
    s2_body: [
      'A hyphen denotes a range. `[a-e]` is equivalent to `[abcde]` but shorter.',
      'Change the pattern to `[a-e]` and watch the match count.',
      '',
      'You should now have **8** matches (the previous 6 plus two `e`s).',
    ].join('\n'),
    s2_hint: 'Range syntax: `[from-to]`.',
    s3_title: 'Predefined class `\\d`',
    s3_body: [
      '`\\d` matches **any digit** — equivalent to `[0-9]`.',
      'Switch to the new test text and write a pattern that catches every digit.',
    ].join('\n'),
    s3_hint: '`\\d` is short for digit.',
    s4_title: 'Negation `[^...]`',
    s4_body: [
      '`^` immediately after `[` flips the class — match anything **not** in the set.',
      'In the new test text, write a pattern that matches all **non-vowel** letters.',
    ].join('\n'),
    s4_hint: 'Vowels are `aeiou`; their negation is `[^aeiou]`.',
    s4_explanation: '`^` after `[` means negation; elsewhere it is just an ordinary character.',
    s5_title: 'Recap',
    s5_body: [
      'You have learned:',
      '',
      '- Sets `[abc]`',
      '- Ranges `[a-z]`',
      '- Predefined classes `\\d` (and `\\w` for word chars, `\\s` for whitespace)',
      '- Negation `[^...]`',
      '',
      'Next: the real meaning of `.` and how to **escape** metacharacters.',
    ].join('\n'),
  },
  zh: {
    title: '字符类：一次表达一组字符',
    summary: '使用方括号、范围、预定义类，让一个 token 代表多种字符。',
    s1_title: '字符集 `[abc]`',
    s1_body: [
      '方括号里的字符**任选其一**。把 pattern 改成 `[abc]`，看看测试文本里被高亮了多少个字母。',
      '',
      '应该有 **6** 处匹配（`a` 4 次、`b` 1 次、`c` 1 次）。',
    ].join('\n'),
    s1_hint: '直接输入 `[abc]`。每个字符独立匹配。',
    s2_title: '范围 `[a-e]`',
    s2_body: [
      '范围用连字符表示。`[a-e]` 等价于 `[abcde]`，但更简洁。',
      '把 pattern 改成 `[a-e]`，看看匹配数有什么变化。',
      '',
      '应该有 **8** 处匹配（在前面 6 个的基础上加上两个 `e`）。',
    ].join('\n'),
    s2_hint: '范围语法：`[起-止]`。',
    s3_title: '预定义类 `\\d`',
    s3_body: [
      '`\\d` 表示**任意数字**，等价于 `[0-9]`。',
      '换一段测试文本，再写一个能找出所有数字字符的 pattern。',
    ].join('\n'),
    s3_hint: '`\\d` 是 digit 的缩写。',
    s4_title: '取反 `[^...]`',
    s4_body: [
      '在 `[` 后面加 `^` 表示**取反**——匹配不在集合里的字符。',
      '在新的测试文本里，写一个能匹配所有**非元音字母**的 pattern。',
    ].join('\n'),
    s4_hint: '元音是 `aeiou`，取反就是 `[^aeiou]`。',
    s4_explanation: '`^` 出现在 `[` 之后表示取反；其它位置只是普通字符。',
    s5_title: '小结',
    s5_body: [
      '你已经掌握了：',
      '',
      '- 字符集 `[abc]`',
      '- 范围 `[a-z]`',
      '- 预定义类 `\\d`（还有 `\\w` 单词字符、`\\s` 空白）',
      '- 取反 `[^...]`',
      '',
      '下一课我们看 `.` 的真实语义和**转义**。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const classesLesson: Lesson = {
  id: 'basics-classes',
  trackId: 'basics',
  title: t.title,
  summary: t.summary,
  difficulty: 'beginner',
  estimatedMinutes: 5,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'apple banana cherry',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('[abc]'), v.matchesExactly(6)),
      hints: [t.s1_hint],
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.all(v.patternEquals('[a-e]'), v.matchesExactly(8)),
      hints: [t.s2_hint],
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      setup: { testText: 'Order #2025-001 ships on day 7.' },
      validate: v.all(v.patternEquals('\\d'), v.matchesExactly(8)),
      hints: [t.s3_hint],
      solution: { pattern: '\\d' },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      setup: { testText: 'education' },
      validate: v.all(v.patternEquals('[^aeiou]'), v.matchesExactly(4)),
      hints: [t.s4_hint],
      solution: {
        pattern: '[^aeiou]',
        explanation: t.s4_explanation,
      },
    },
    {
      id: 's5',
      title: t.s5_title,
      body: t.s5_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'basics-dot-and-escapes',
};

import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Literals: starting from characters',
    summary: 'Understand "a character matches itself" and write your first regex.',
    s1_title: 'Match your first "cat"',
    s1_body: 'Type `cat` into the Pattern input and watch the test text on the right.',
    s1_hint: 'Characters with no special meaning match themselves. Just type `cat`.',
    s2_title: 'How many times did it match?',
    s2_body: [
      'You should see **3** highlights, including the "cat" nested inside `Concatenate`.',
      'By default, regex finds every occurrence in the text (with the `g` flag).',
      '',
      'Once you see 3 highlights, move on.',
    ].join('\n'),
    s3_title: 'Match the standalone word only',
    s3_body: [
      'Change the pattern to `\\bcat\\b` so the "cat" embedded in "Concatenate" is no longer matched.',
      '',
      '`\\b` is a **word boundary**: it sits at the seam between a word character and a non-word character.',
    ].join('\n'),
    s3_hints: ['You need some notion of "word boundary".', 'Try `\\b`.'],
    s3_explanation:
      '`\\b` is a word boundary, so the "cat" inside "Concatenate" is excluded — neither side is a boundary.',
    s4_title: 'Case insensitive',
    s4_body: [
      'A capitalized "Cat" now appears in the test text.',
      'Keep the pattern, but turn on the `i` flag so it matches both cases.',
    ].join('\n'),
    s4_hint: 'Click the flag area next to `/.../` on the right of the pattern input.',
    s5_title: 'Recap',
    s5_body: [
      'You have learned:',
      '',
      '- **literal characters** match themselves',
      '- `\\b` **word boundary**',
      '- The `i` flag toggles **case sensitivity**',
      '',
      'Next up: **character classes** — express a group of characters in one token.',
    ].join('\n'),
  },
  zh: {
    title: '字面量：从字符开始',
    summary: '理解"一个字符就代表它自己"，写下你的第一个正则。',
    s1_title: '匹配第一个 cat',
    s1_body: '在 Pattern 输入框里输入 `cat`，看看右侧测试文本里发生了什么。',
    s1_hint: '正则中没有特殊含义的字符就代表它自己。直接输入 `cat` 即可。',
    s2_title: '它匹配了多少次？',
    s2_body: [
      '你应该看到 **3** 个高亮，包括 `Concatenate` 中嵌着的 "cat"。',
      '正则默认会找出文本中所有出现的位置（开了 `g` flag 时）。',
      '',
      '当你在测试文本里看到 3 个高亮，就可以进入下一步。',
    ].join('\n'),
    s3_title: '只想匹配独立单词',
    s3_body: [
      '把 pattern 改成 `\\bcat\\b`，让 "Concatenate" 中嵌着的 cat 不再被匹配。',
      '',
      '`\\b` 是 **单词边界**：它出现在「单词字符与非单词字符」交界处。',
    ].join('\n'),
    s3_hints: ['需要某种"单词边界"的概念。', '试试 `\\b`。'],
    s3_explanation:
      '`\\b` 是单词边界，使得 "Concatenate" 内嵌的 "cat" 两侧都不是边界，因而被排除。',
    s4_title: '大小写不敏感',
    s4_body: [
      '现在测试文本里出现了一个大写的 "Cat"。',
      '保持 pattern 不变，打开 `i` flag，让它同时匹配大写和小写。',
    ].join('\n'),
    s4_hint: 'flag 在 pattern 输入框右侧的 `/.../` 旁边可以点开。',
    s5_title: '小结',
    s5_body: [
      '你已经掌握了：',
      '',
      '- **字面字符**匹配（一个字符代表它自己）',
      '- `\\b` **单词边界**',
      '- `i` flag 切换**大小写**敏感',
      '',
      '下一课我们看 **字符类** —— 一次表达一组字符。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const literalsLesson: Lesson = {
  id: 'basics-literals',
  trackId: 'basics',
  title: t.title,
  summary: t.summary,
  difficulty: 'beginner',
  estimatedMinutes: 3,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'cat sat on the mat. The cat was black. Concatenate.',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('cat'), v.matchesAtLeast(1)),
      hints: [t.s1_hint],
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.matchesExactly(3),
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(v.patternEquals('\\bcat\\b'), v.matchesExactly(2)),
      hints: t.s3_hints,
      solution: {
        pattern: '\\bcat\\b',
        explanation: t.s3_explanation,
      },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      setup: {
        testText: 'cat sat on the mat. The Cat was black. Concatenate.',
      },
      validate: v.all(v.flagEnabled('i'), v.matchesExactly(2)),
      hints: [t.s4_hint],
    },
    {
      id: 's5',
      title: t.s5_title,
      body: t.s5_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'basics-classes',
};

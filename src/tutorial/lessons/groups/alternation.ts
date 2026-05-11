import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: '`|` alternation and group scope',
    summary: '`|` is a low-precedence "or" — usually you need `()` to scope it.',
    s1_title: 'Basic form: `cat|dog|bird`',
    s1_body: [
      '`|` means "or" — either side succeeding makes the whole alternation succeed.',
      '',
      'Write `cat|dog|bird` to find the three pets in the text.',
    ].join('\n'),
    s2_title: 'Scope of `|`: by default it spans the whole pattern',
    s2_body: [
      'Switch the test text and try matching "cat or dog, singular or plural".',
      '',
      'The intuitive `cats?|dogs?` works, but if you want a common boundary on both sides, e.g. `\\b(cat|dog)s?\\b`, parentheses are mandatory — `|` greedily extends to both pattern ends.',
      '',
      'Try `(cat|dog)s?`. You should get **2** matches (cats, dogs).',
    ].join('\n'),
    s2_hint: '`(cat|dog)s?` — the parens scope `|` to cat/dog, with `s?` applying to the whole.',
    s2_explanation: 'Without the parens, `s?` would only apply to dog: `cat|dogs?` means something completely different.',
    s3_title: 'Recap',
    s3_body: [
      'Key points:',
      '',
      '- `a|b|c` — multi-way "or"',
      '- Default scope is the **whole pattern**, so `^a|b$` means "starts with a" OR "ends with b"',
      '- Use `()` to scope `|`',
      '- If you only need scoping (no capture), see `(?:...)` non-capturing groups in a later lesson',
      '',
      'Next: **backreferences**.',
    ].join('\n'),
  },
  zh: {
    title: '`|` 多选一与括号的作用域',
    summary: '`|` 是低优先级的"或"，常常需要 `()` 限定它的范围。',
    s1_title: '基本写法 `cat|dog|bird`',
    s1_body: [
      '`|` 表示"或"——它两边的子表达式任一匹配就算成功。',
      '',
      '写 `cat|dog|bird`，找出文本里出现的三种宠物。',
    ].join('\n'),
    s2_title: '`|` 的作用域：默认贯穿整条 pattern',
    s2_body: [
      '把 testText 切到下一段，然后我们想匹配"cat 或 dog，单复数都要"。',
      '',
      '直觉写法 `cats?|dogs?` 就够了，但如果你想给前后**加共同的边界**，比如 `\\b(cat|dog)s?\\b`，那 `()` 就必不可少了——`|` 默认贪婪到 pattern 两端。',
      '',
      '写 `(cat|dog)s?` 试试，应该匹配 **2** 处（cats、dogs）。',
    ].join('\n'),
    s2_hint: '`(cat|dog)s?` —— 括号让 `|` 只在 cat / dog 之间二选一，s? 作用于整体。',
    s2_explanation: '没有括号，`s?` 只会作用于 dog，写成 `cat|dogs?` 含义就完全不同了。',
    s3_title: '小结',
    s3_body: [
      '本课要点：',
      '',
      '- `a|b|c` 多选一',
      '- 默认作用域是**整条 pattern**，所以 `^a|b$` 匹配的是"行首是 a"或"行尾是 b"',
      '- 用 `()` 给 `|` 划定作用范围',
      '- 如果只是为了限定范围、并不需要捕获，下一课会讲到 `(?:...)` 非捕获组',
      '',
      '下一课：**反向引用**。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const alternationLesson: Lesson = {
  id: 'groups-alternation',
  trackId: 'groups',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 4,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'I have a cat, a dog, and a bird.',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('cat|dog|bird'), v.matchesExactly(3)),
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      setup: { testText: 'I love cats and dogs equally.' },
      validate: v.all(v.patternEquals('(cat|dog)s?'), v.matchesExactly(2)),
      hints: [t.s2_hint],
      solution: {
        pattern: '(cat|dog)s?',
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
  nextLessonId: 'groups-backreferences',
};

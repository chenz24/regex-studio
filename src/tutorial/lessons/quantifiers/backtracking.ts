import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Backtracking traps: the cost of nested quantifiers',
    summary: '`(a+)+b` can backtrack exponentially in the worst case. Recognize it, avoid it.',
    s1_title: 'A pattern that "looks fine"',
    s1_body: [
      'The pattern `(a+)+b` matches `"aaaaab"` just fine, no issue.',
      '',
      'This step is just observation — confirm it does match.',
    ].join('\n'),
    s2_title: 'Remove the `b`',
    s2_body: [
      'Now switch to a same-length string **without `b`**.',
      '',
      '`(a+)+b` must prove "no match" — but because the inner `a+` and outer `+` can **partition** the run of `a`s arbitrarily, the engine tries every partition: O(2^n) backtracking.',
      '',
      '20 `a`s is fine in a browser; much more and it freezes. This is **catastrophic backtracking**.',
    ].join('\n'),
    s3_title: 'Fix: avoid nested quantifiers',
    s3_body: [
      'Change the pattern to `a+b` — a single quantifier, one decision, no exponential partitioning.',
      '',
      'It expresses the same intent: "one or more `a`, then `b`".',
    ].join('\n'),
    s3_hint: 'There is no `b` in the text so the match count is 0 — but it is constant time.',
    s3_explanation: 'No nested quantifier means the engine no longer tries multiple partitions of the same run.',
    s4_title: 'Recap',
    s4_body: [
      'Spot dangerous patterns:',
      '',
      '- Nested quantifiers over the same set: `(a+)+`, `(a*)*`',
      '- Alternations with overlapping branches: `(a|a)+`',
      '- A quantified subexpression that can match empty',
      '',
      'Fixes:',
      '',
      '- Flatten the nesting: `(a+)+` → `a+`',
      '- Use **negated character classes** for tight borders: `<[^>]+>` beats `<.+?>`',
      '- If the engine supports it, use **atomic groups** `(?>...)` or **possessive quantifiers** `a++` to prevent backtracking',
      '',
      '🎉 Track 2 complete. Try the Debugger panel to watch backtracking step by step.',
    ].join('\n'),
  },
  zh: {
    title: '回溯陷阱：嵌套量词的代价',
    summary: '`(a+)+b` 这种写法在最坏情况下会指数级回溯。理解它，避开它。',
    s1_title: '"看起来能用"的写法',
    s1_body: [
      'pattern `(a+)+b` 在 `"aaaaab"` 上能成功匹配，看似没什么问题。',
      '',
      '这一步只是观察——确认它确实匹配了。',
    ].join('\n'),
    s2_title: '把 `b` 拿掉',
    s2_body: [
      '现在把测试文本改成同样长但**没有 b** 的字符串。',
      '',
      '`(a+)+b` 必须证明"匹配不上"——但因为内层 `a+` 和外层 `+` 可以**任意拆分**这串 a，引擎会把所有拆法都试一遍，得到 2^n 量级的回溯。',
      '',
      '在你的浏览器里 20 个 a 还能扛得住，再多就要卡住了。这就是 **catastrophic backtracking**。',
    ].join('\n'),
    s3_title: '修法：避免嵌套量词',
    s3_body: [
      '把 pattern 改成 `a+b`——单层量词，一次决断，不再有指数拆分。',
      '',
      '它表达的是同一个意图："1 个或多个 a 后面紧跟 b"。',
    ].join('\n'),
    s3_hint: '当前文本没有 b，所以匹配数应该是 0——但耗时是常数级。',
    s3_explanation: '没有嵌套量词，引擎不会再为同一段 a 尝试多种拆分。',
    s4_title: '小结',
    s4_body: [
      '识别"危险写法"：',
      '',
      '- 嵌套相同字符集的量词：`(a+)+`、`(a*)*`',
      '- 重叠选择项的交替：`(a|a)+`',
      '- 量词内出现可以匹配空串的子表达式',
      '',
      '解法套路：',
      '',
      '- 拍扁嵌套：`(a+)+` → `a+`',
      '- 用**字符类取反**精确边界：`<[^>]+>` 比 `<.+?>` 更稳',
      '- 如目标语言支持，用**原子组** `(?>...)` 或**独占量词** `a++` 阻断回溯',
      '',
      '🎉 Track 2 完结。继续学习其它 track 之前，可以打开 Debugger 面板亲手观察回溯过程。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const backtrackingLesson: Lesson = {
  id: 'quantifiers-backtracking',
  trackId: 'quantifiers',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 5,
  initialState: {
    engine: 'javascript',
    pattern: '(a+)+b',
    flags: '',
    testText: 'aaaaab',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('(a+)+b'), v.matchesAtLeast(1)),
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      setup: { testText: 'aaaaaaaaaaaaaaaaaaaa' },
      validate: v.always(),
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(v.patternEquals('a+b'), v.matchesExactly(0)),
      hints: [t.s3_hint],
      solution: {
        pattern: 'a+b',
        explanation: t.s3_explanation,
      },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'groups-capturing',
};

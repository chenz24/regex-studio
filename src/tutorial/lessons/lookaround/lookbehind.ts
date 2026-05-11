import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Lookbehind `(?<=...)` and `(?<!...)`',
    summary: 'Assert what does/doesn\'t precede — also zero-width.',
    s1_title: 'Positive lookbehind `(?<=...)`',
    s1_body: [
      'Goal: digits prefixed by `$` — money amounts only, not other identifiers.',
      '',
      'Write `(?<=\\$)\\d+`. Only the amount **5** should match.',
    ].join('\n'),
    s1_hint: '`(?<=...)` checks the **left** of the cursor, zero-width. The match does not include `$`.',
    s1_explanation: '"$5" qualifies; "A1" has "A" before it, "7" has a space — both excluded.',
    s2_title: 'Negative lookbehind `(?<!...)`',
    s2_body: [
      'Flipped — "digits **not** prefixed by `$`".',
      '',
      'Write `(?<!\\$)\\d+`. You should match **2** places (the 1 in A1, the 7 after "Floor").',
    ].join('\n'),
    s2_hint: '`(?<!...)` — the left must **not** be the specified pattern.',
    s3_title: 'Engine differences',
    s3_body: [
      'Variable-length lookbehind support varies:',
      '',
      '- **JavaScript / PCRE2**: full variable-length, e.g. `(?<=foo|barbaz)`',
      '- **Python `re`**: only **fixed-width** — even branches must match equal lengths; the third-party `regex` package unlocks variable-length',
      '- **Java**: requires a computable upper bound',
      '',
      'The widget below switches flavors for live comparison.',
    ].join('\n'),
    s3_compare: {
      javascript: 'JavaScript fully supports variable-length lookbehind since ES2018.',
      pcre2: 'PCRE2 also supports variable-length lookbehind, matching JS behavior.',
      python: '⚠️ Python `re` requires lookbehind to be **fixed-width**. For variable-length, use the third-party `regex` package.',
      java: '⚠️ Java requires lookbehind to have a **computable upper bound**; `*` and `+` are rejected.',
      go: '❌ Go (RE2) does not support lookbehind at all.',
    },
    s4_title: 'Recap',
    s4_body: [
      '🎉 Lookaround complete! You now know:',
      '',
      '- `(?=...)` `(?!...)` — lookahead',
      '- `(?<=...)` `(?<!...)` — lookbehind',
      '- All **zero-width** — matches do not include assertion content',
      '',
      'Coming up: flavor differences, challenges, and putting it all together for real-world regex.',
    ].join('\n'),
  },
  zh: {
    title: '后行断言 `(?<=...)` 与 `(?<!...)`',
    summary: '断言**前面**有/没有某个模式，同样零宽。',
    s1_title: '正向后行 `(?<=...)`',
    s1_body: [
      '"前缀是 `$` 的数字"——只想要金额，不想要其它编号。',
      '',
      '写 `(?<=\\$)\\d+`，应该只匹配到金额 **5**。',
    ].join('\n'),
    s1_hint: '`(?<=...)` 检查光标**左边**，零宽。匹配结果不包括 `$`。',
    s1_explanation: '"$5" 满足；"A1" 前面是 "A"，"7" 前面是空格，都被排除。',
    s2_title: '否定后行 `(?<!...)`',
    s2_body: [
      '反过来——"前面**不是** `$` 的数字"。',
      '',
      '写 `(?<!\\$)\\d+`，应该匹配到 **2** 处（A1 里的 1，"Floor" 后的 7）。',
    ].join('\n'),
    s2_hint: '`(?<!...)` —— 注意左侧必须**不是**指定模式。',
    s3_title: '引擎差异提醒',
    s3_body: [
      '后行断言的**变长**支持各家不一样：',
      '',
      '- **JavaScript / PCRE2**：完全支持变长后行，比如 `(?<=foo|barbaz)`',
      '- **Python `re`**：只接受**固定宽度**——`(?<=foo|bar)` 在某些版本下也只放行长度一致的分支；用第三方 `regex` 包可解锁变长',
      '- **Java**：要求宽度可推算上界',
      '',
      '下面这个小部件可以实时切换 Flavor 对比。',
    ].join('\n'),
    s3_compare: {
      javascript: 'JavaScript 从 ES2018 开始完整支持变长后行断言。',
      pcre2: 'PCRE2 也支持变长后行断言，表现与 JS 一致。',
      python: '⚠️ Python `re` 要求后行断言是**固定宽度**。需变长请用第三方 `regex` 包。',
      java: '⚠️ Java 要求后行断言有**可推算上界**的长度；`*` `+` 这种无上限量词会被拒。',
      go: '❌ Go (RE2) 不支持任何后行断言。',
    },
    s4_title: '小结',
    s4_body: [
      '🎉 Lookaround 全部走完！现在你已经掌握：',
      '',
      '- `(?=...)` `(?!...)` —— 先行断言',
      '- `(?<=...)` `(?<!...)` —— 后行断言',
      '- 全部**零宽**，匹配结果不包含断言内容',
      '',
      '下一阶段（敬请期待）：Flavor 差异、Challenges 关卡、以及把这些工具拼成实战正则。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const lookbehindLesson: Lesson = {
  id: 'lookaround-lookbehind',
  trackId: 'lookaround',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 5,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'Code A1, Item $5, Floor 7',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('(?<=\\$)\\d+'), v.matchesExactly(1)),
      hints: [t.s1_hint],
      solution: {
        pattern: '(?<=\\$)\\d+',
        explanation: t.s1_explanation,
      },
      spotlight: {
        patternSubstrings: ['(?<=\\$)'],
        openPanel: 'explanation',
        scrollExplanation: true,
      },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.all(v.patternEquals('(?<!\\$)\\d+'), v.matchesExactly(2)),
      hints: [t.s2_hint],
      spotlight: { patternSubstrings: ['(?<!\\$)'] },
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      setup: { pattern: '(?<=foo|barbaz)\\w+', flags: 'g', testText: 'foobar barbazquux' },
      validate: v.always(),
      flavorCompare: {
        flavors: ['javascript', 'pcre2', 'python', 'java', 'go'],
        commentary: t.s3_compare,
      },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'practical-email',
};

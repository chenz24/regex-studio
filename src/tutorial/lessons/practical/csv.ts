import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const ROW = 'alice,42,"Wonderland, NJ",engineer,"says ""hi"""';

const TEXTS = {
  en: {
    title: 'Split CSV fields (with quotes)',
    summary: 'Why `split(",")` is not enough — and how to use `|` for two-shape fields.',
    s1_title: 'Naive: split by `,`',
    s1_body: [
      'Most direct way to grab each field: `[^,]+` — one or more "non-comma" characters.',
      '',
      'Try it — how many matches do you get?',
    ].join('\n'),
    s1_hint: '`[^,]+` reads until the next comma.',
    s2_title: 'Problem: a comma inside quotes was treated as a separator',
    s2_body: [
      'You should see ≥ 7 matches, but the **correct** field count is 5.',
      '',
      'The `,` inside `"Wonderland, NJ"` is field content, not a separator — but `[^,]+` does not know that.',
      '',
      'Plan: first **specifically** match quoted fields (`"..."` as one unit), then fall back to `[^,]+`. This "two shapes joined by `|`" is the standard regex tactic for real-world data.',
    ].join('\n'),
    s3_title: 'Add a quoted branch',
    s3_body: [
      'Write: `"[^"]*"|[^,]+`',
      '',
      '- Left branch `"[^"]*"`: a full quote pair + non-quote content',
      '- Right branch `[^,]+`: fallback — plain fields',
      '',
      '`|` tries branches in order; if the left side matches it never falls to the right.',
    ].join('\n'),
    s3_hints: [
      'Without parens, `|`\'s scope is the **whole pattern** — exactly what we want.',
      '`"` does not need escaping inside a JS regex pattern.',
    ],
    s3_explanation: '`"Wonderland, NJ"` is captured wholly by the left branch — its inner comma is no longer treated as a separator.',
    s4_title: 'A remaining edge case',
    s4_body: [
      'Look at the final match: `"says ""hi"""`.',
      '',
      'In CSV, **a quote inside a field** is escaped by **doubling** it (`""` means one `"`). But `[^"]*` stops at the first `"`, so this field is sliced into three pieces.',
      '',
      'This is a **known gap** — fully handling it requires `"(?:[^"]|"")*"`, where the left branch allows "non-quote char" or "two consecutive quotes".',
      '',
      'Change the pattern to: `"(?:[^"]|"")*"|[^,]+`',
    ].join('\n'),
    s4_hints: [
      '`(?:...)` is a non-capturing group — gives `*` a scope without claiming an index.',
      'Inside: `[^"]|""` = "one non-quote char" OR "two consecutive quotes".',
    ],
    s5_title: 'Recap',
    s5_body: [
      'Key points:',
      '',
      '- "Parse two-shape fields" → `special | plain`',
      '- Non-capturing `(?:...)` scopes `|` and `*` without claiming a number',
      '- For **serious** CSV parsing in production, use a real parser (CRLF, empty fields, UTF-8 BOM, etc.); regex is great for **quick ad-hoc** extraction',
      '',
      '🎉 The practical track is complete! You can now combine basics, quantifiers, groups, and lookaround to handle everyday text problems.',
    ].join('\n'),
  },
  zh: {
    title: '拆 CSV 字段（含引号）',
    summary: '为什么 `split(",")` 不够用——以及如何用 `|` 处理"两种形态"的字段。',
    s1_title: '简单版：按 `,` 拆',
    s1_body: [
      '想拿出每个字段，最直觉的写法是 `[^,]+`——一个或多个"不是逗号"的字符。',
      '',
      '试试：会有几个匹配？',
    ].join('\n'),
    s1_hint: '`[^,]+` 一直读到下一个逗号为止。',
    s2_title: '问题：引号里的逗号被错切了',
    s2_body: [
      '匹配数应该 ≥ 7，但**正确**的字段数其实是 5。',
      '',
      '`"Wonderland, NJ"` 里的 `,` 是字段内容的一部分，不应该作为分隔符，但 `[^,]+` 不知道这件事。',
      '',
      '思路：先**专门**匹配带引号的字段（`"..."` 整体当一个），再回落到普通 `[^,]+`。这种"两种形态用 `|` 串起来"是正则解析现实数据的标准套路。',
    ].join('\n'),
    s3_title: '加上引号分支',
    s3_body: [
      '写：`"[^"]*"|[^,]+`',
      '',
      '- 左分支 `"[^"]*"`：匹配整对引号 + 内部的非引号内容',
      '- 右分支 `[^,]+`：兜底——普通字段',
      '',
      '`|` 的两边引擎按顺序尝试；只要左分支能匹配，就不会回到右分支。',
    ].join('\n'),
    s3_hints: [
      '`|` 在没有括号的情况下作用范围是**整个 pattern**——这正是我们想要的。',
      '注意 `"` 在 JS pattern 里不需要转义。',
    ],
    s3_explanation: '`"Wonderland, NJ"` 整体被左分支抓走，里面的逗号不会再被当成字段分隔符。',
    s4_title: '一个仍未解决的角落',
    s4_body: [
      '看最后一个匹配：`"says ""hi"""`。',
      '',
      'CSV 标准里，**字段内的引号**通过"双写"来转义（`""` 表示一个 `"`）。但 `[^"]*` 一遇到第一个 `"` 就停了，于是这一段被切成了三块。',
      '',
      '这是个**已知缺陷**——彻底处理需要：`"(?:[^"]|"")*"`，左分支允许"非引号字符"或"两个连续引号"。',
      '',
      '改成：`"(?:[^"]|"")*"|[^,]+`',
    ].join('\n'),
    s4_hints: [
      '`(?:...)` 是非捕获组——只为 `*` 提供作用域，不占编号。',
      '内部 `[^"]|""` ＝ "一个非引号字符" 或 "两个连续引号"。',
    ],
    s5_title: '小结',
    s5_body: [
      '本课要点：',
      '',
      '- "解析两种形态的字段" → `特殊形态 | 普通形态`',
      '- 非捕获组 `(?:...)` 给 `|` `*` 提供作用域，不留编号',
      '- 现实里**严肃**的 CSV 解析建议用专门的解析器（处理 CRLF、空字段、UTF-8 BOM 等）；正则适合**快速 ad-hoc** 抽取',
      '',
      '🎉 整套实战 Track 跑完了！现在你已经能把基础、量词、分组、lookaround 拼起来解决日常文本问题。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const csvLesson: Lesson = {
  id: 'practical-csv',
  trackId: 'practical',
  title: t.title,
  summary: t.summary,
  difficulty: 'advanced',
  estimatedMinutes: 7,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: ROW,
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('[^,]+'), v.matchesAtLeast(7)),
      hints: [t.s1_hint],
      spotlight: { patternSubstrings: ['[^,]+'], openPanel: 'matches' },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.always(),
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(
        v.patternEquals('"[^"]*"|[^,]+'),
        v.matchesAtLeast(5),
      ),
      hints: t.s3_hints,
      solution: {
        pattern: '"[^"]*"|[^,]+',
        explanation: t.s3_explanation,
      },
      spotlight: { patternSubstrings: ['"[^"]*"'], openPanel: 'matches' },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.all(
        v.patternEquals('"(?:[^"]|"")*"|[^,]+'),
        v.matchesExactly(5),
      ),
      hints: t.s4_hints,
      solution: {
        pattern: '"(?:[^"]|"")*"|[^,]+',
      },
      spotlight: { patternSubstrings: ['(?:[^"]|"")*'], openPanel: 'explanation' },
    },
    {
      id: 's5',
      title: t.s5_title,
      body: t.s5_body,
      validate: v.always(),
    },
  ],
};

import type { Locale } from '@/paraglide/runtime';
import { NAME_SAMPLE } from '@/content/regexExamples';
import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Capturing groups: keep what you matched',
    summary:
      '`(...)` is not just grouping — it also stores the matched substring into groups 1, 2, 3...',
    s1_title: 'Match "First Last" with `\\w+ \\w+`',
    s1_body: [
      'We want to grab 3 "first last" name pairs. Start with the most direct form: `\\w+ \\w+`.',
      '',
      'You should get **3** matches.',
    ].join('\n'),
    s2_title: 'Add parentheses to capture first and last separately',
    s2_body: [
      'Change the pattern to `(\\w+) (\\w+)`. Match count stays the same, but the matches panel now shows group 1 / group 2 columns — first and last name.',
      '',
      'These are **capturing groups**: each pair of `()` claims an index (1, 2, 3, ...) and stores its matched substring, ready to use in replacements, backreferences, or code.',
    ].join('\n'),
    s2_hint: 'Just wrap each `\\w+` in `()`.',
    s3_title: 'Recap',
    s3_body: [
      'Key points:',
      '',
      '- `(...)` = grouping + capturing',
      '- Numbering starts at **1**, ordered by the opening parenthesis',
      '- In replacement, refer to groups with `$1`, `$2` — e.g. turn "First Last" into "Last, First"',
      '',
      'Next: `|` — alternation.',
    ].join('\n'),
  },
  zh: {
    title: '捕获组：把匹配到的内容"留下来"',
    summary: '`(...)` 不只是分组，它还会把括号里匹配到的子串记到 group 1、2、3...',
    s1_title: '先用 `\\w+ \\w+` 匹配 "First Last"',
    s1_body: [
      '我们想抓出 3 个"姓 名"组合。先用最直白的写法 `\\w+ \\w+`。',
      '',
      '应该有 **3** 处匹配。',
    ].join('\n'),
    s2_title: '加上括号，把"名"和"姓"分别记下来',
    s2_body: [
      '把 pattern 改成 `(\\w+) (\\w+)`。匹配数不变，但下方"匹配结果"会多出 group 1 / group 2 两列——分别是名和姓。',
      '',
      '这就是**捕获组**：每对 `()` 自动占用一个编号 (1, 2, 3...)，保存它匹配到的内容，方便后续在替换、回溯或代码里使用。',
    ].join('\n'),
    s2_hint: '只是把每段 `\\w+` 用 `()` 包起来。',
    s3_title: '小结',
    s3_body: [
      '本课要点：',
      '',
      '- `(...)` = 分组 + 捕获',
      '- 编号从 **1** 开始，按左括号顺序',
      '- 在替换框里可以用 `$1`、`$2` 引用，例如把 "First Last" 改成 "Last, First"',
      '',
      '下一课讲 `|` ——多选一。',
    ].join('\n'),
  },
};

const READING = {
  en: {
    introduction:
      'A regex match can identify a whole piece of text and also save smaller pieces inside it. Capturing groups make those pieces available separately, so code or a replacement can reuse them without splitting the text again. The examples use JavaScript matching and replacement syntax.',
    s1: {
      title: 'A whole match does not expose separate fields',
      body: 'The pattern `\\w+ \\w+` matches two runs of word characters separated by one literal space. With the global flag, the sample produces three complete name pairs. There are no capturing parentheses yet, so the names are not stored in separate numbered groups.\n\nIn these examples, `\\w` covers ASCII letters, digits and underscore. It is a convenient teaching shorthand, not a rule for validating real names: names may contain accented letters, spaces, apostrophes and other characters.',
    },
    s2: {
      title: 'Parentheses save the first and last name separately',
      body: 'The pattern `(\\w+) (\\w+)` matches the same three substrings. The first pair of parentheses stores group 1, and the second stores group 2. The table shows the complete match alongside both captured values. Capturing does not add more top-level matches.\n\nGroup numbers follow the order of opening parentheses, starting at 1. Nested capturing parentheses also receive numbers. In a JavaScript `exec()` result, element 0 is the complete match and elements 1 onward hold captures. `matchAll()` can iterate matches with their captures; `match()` with `g` returns the complete matched strings without those capture fields.',
    },
    s3: {
      title: 'Reuse captures in a replacement',
      body: 'For JavaScript string replacement, `$1` and `$2` insert the captured values. The replacement `$2, $1` changes each `First Last` pair into `Last, First`. Text outside the matches, including the original comma separators, remains in place.\n\nReplacement references such as `$1` have a different role from pattern backreferences such as `\\1`: the former insert text into output, while the latter require text in the input to match an earlier capture. Use `(?:...)` for grouping without adding a numbered capture when the captured text is not needed.',
    },
  },
  zh: {
    introduction:
      '一次正则匹配既可以找出整段文本，也可以保存其中的小片段。捕获组把这些片段分别留下来，让代码或替换表达式直接复用，而不必再次拆分文本。下面的匹配和替换均采用 JavaScript 语法。',
    s1: {
      title: '完整匹配还没有拆出独立字段',
      body: '`\\w+ \\w+` 匹配两段单词字符，中间是一个普通空格。配合全局标志，示例会得到三组完整的“名 姓”。此时还没有捕获括号，所以名和姓并没有被保存成独立的编号分组。\n\n在这些示例中，`\\w` 包含 ASCII 字母、数字和下划线。它适合演示语法，但不适合验证真实姓名：姓名可能含有带重音字母、多个空格、撇号以及其他字符。',
    },
    s2: {
      title: '用括号分别保存名和姓',
      body: '`(\\w+) (\\w+)` 仍然匹配相同的三个子串。第一对括号保存第 1 组，第二对括号保存第 2 组。表格同时列出完整匹配和两个分组的值。增加捕获组并不会增加完整匹配的数量。\n\n捕获组按照左括号出现的顺序，从 1 开始编号；嵌套的捕获括号也占用编号。JavaScript 的 `exec()` 返回结果中，第 0 项是完整匹配，第 1 项起是捕获值。`matchAll()` 可以逐个取得带分组的匹配；带 `g` 的 `match()` 则只返回完整匹配字符串，不包含这些分组字段。',
    },
    s3: {
      title: '在替换结果中复用捕获内容',
      body: '在 JavaScript 的字符串替换中，`$1`、`$2` 分别插入对应组的内容。使用 `$2, $1`，就能把每一组“名 姓”改成“姓, 名”。匹配范围以外的字符会原样保留，包括原文里分隔姓名的逗号。\n\n替换里的 `$1` 和模式里的反向引用 `\\1` 作用不同：前者把捕获内容放进输出，后者要求输入中再次出现之前捕获的文本。如果只需要分组、不需要保存内容，可以使用 `(?:...)`，它不会增加编号捕获组。',
    },
  },
};

export function createCapturingGroupsLesson(locale?: Locale): Lesson {
  const t = pickLocale(TEXTS, locale);
  const reading = pickLocale(READING, locale);
  return {
    id: 'groups-capturing',
    trackId: 'groups',
    title: t.title,
    summary: t.summary,
    reading: {
      introduction: reading.introduction,
      references: [
        {
          title: 'MDN: Capturing groups',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Capturing_group',
        },
        {
          title: 'MDN: String.replace()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace',
        },
      ],
    },
    difficulty: 'intermediate',
    estimatedMinutes: 4,
    initialState: {
      engine: 'javascript',
      pattern: '',
      flags: 'g',
      testText: NAME_SAMPLE,
    },
    steps: [
      {
        id: 's1',
        title: t.s1_title,
        body: t.s1_body,
        reading: {
          ...reading.s1,
          examples: [
            {
              pattern: '\\w+ \\w+',
              flags: 'g',
              testText: NAME_SAMPLE,
              matches: [{ text: 'John Smith' }, { text: 'Jane Doe' }, { text: 'Bob Wilson' }],
            },
          ],
        },
        validate: v.all(v.patternEquals('\\w+ \\w+'), v.matchesExactly(3)),
      },
      {
        id: 's2',
        title: t.s2_title,
        body: t.s2_body,
        reading: {
          ...reading.s2,
          examples: [
            {
              pattern: '(\\w+) (\\w+)',
              flags: 'g',
              testText: NAME_SAMPLE,
              matches: [
                { text: 'John Smith', groups: ['John', 'Smith'] },
                { text: 'Jane Doe', groups: ['Jane', 'Doe'] },
                { text: 'Bob Wilson', groups: ['Bob', 'Wilson'] },
              ],
            },
          ],
        },
        validate: v.all(v.patternEquals('(\\w+) (\\w+)'), v.matchesExactly(3)),
        hints: [t.s2_hint],
        solution: { pattern: '(\\w+) (\\w+)' },
        spotlight: {
          patternSubstrings: ['(\\w+)'],
          openPanel: 'matches',
        },
      },
      {
        id: 's3',
        title: t.s3_title,
        body: t.s3_body,
        reading: {
          ...reading.s3,
          examples: [
            {
              pattern: '(\\w+) (\\w+)',
              flags: 'g',
              testText: NAME_SAMPLE,
              matches: [
                { text: 'John Smith', groups: ['John', 'Smith'] },
                { text: 'Jane Doe', groups: ['Jane', 'Doe'] },
                { text: 'Bob Wilson', groups: ['Bob', 'Wilson'] },
              ],
              replacement: { template: '$2, $1', result: 'Smith, John, Doe, Jane, Wilson, Bob' },
            },
          ],
        },
        validate: v.always(),
      },
    ],
    nextLessonId: 'groups-alternation',
  };
}

export const capturingGroupsLesson = createCapturingGroupsLesson();

import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Capturing groups: keep what you matched',
    summary: '`(...)` is not just grouping — it also stores the matched substring into groups 1, 2, 3...',
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

const t = pickLocale(TEXTS);

export const capturingGroupsLesson: Lesson = {
  id: 'groups-capturing',
  trackId: 'groups',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 4,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'g',
    testText: 'John Smith, Jane Doe, Bob Wilson',
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('\\w+ \\w+'), v.matchesExactly(3)),
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
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
      validate: v.always(),
    },
  ],
  nextLessonId: 'groups-alternation',
};

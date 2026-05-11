import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const LOG = [
  '[2024-05-09 10:21:03] INFO  server started on :3000',
  '[2024-05-09 10:21:11] DEBUG handshake from 192.168.1.42',
  '[2024-05-09 10:22:17] WARN  slow query (430ms)',
  '[2024-05-09 10:22:30] ERROR connection reset by peer',
  '[2024-05-09 10:23:00] ERROR upstream timeout after 5s',
  '[2024-05-09 10:23:05] INFO  reconnected',
].join('\n');

const TEXTS = {
  en: {
    title: 'Parse log lines',
    summary: 'Anchors + named capturing groups + lookahead — turn logs into structured fields.',
    s1_title: 'Anchor to the start of each line',
    s1_body: [
      'Every log line has the shape `[YYYY-MM-DD HH:MM:SS] LEVEL MSG`.',
      '',
      'The `m` flag is already on so `^` matches the start of each line.',
      '',
      'Start with `^\\[` — pin the left bracket. You should get **6** matches.',
    ].join('\n'),
    s1_hint: '`[` must be escaped as `\\[` in a pattern.',
    s2_title: 'Capture the timestamp',
    s2_body: [
      'Capture the bracketed content: `^\\[([\\d\\- :]+)\\]`.',
      '',
      'The character class allows digits, `-`, `:`, and a literal space.',
    ].join('\n'),
    s2_hints: [
      'Inside a class, `-` must be at the start/end or escaped to be literal.',
      'Escape the closing bracket too: `\\]`.',
    ],
    s3_title: 'Switch to named groups',
    s3_body: [
      'Numbered groups are easy to confuse. Use **named groups** instead: `(?<name>...)`.',
      '',
      '`^\\[(?<ts>[\\d\\- :]+)\\] (?<level>\\w+)\\s+(?<msg>.*)$`',
      '',
      'Three groups: `ts` (timestamp), `level`, `msg` (the rest).',
    ].join('\n'),
    s3_hints: [
      '`(?<ts>...)` names a group.',
      '`\\s+` eats the spaces after the level (column-aligned INFO vs ERROR).',
      '`.*$` reaches the end of the line.',
    ],
    s3_explanation: 'The matches panel now shows three named groups: ts/level/msg.',
    s4_title: 'Only ERROR lines — lookahead in action',
    s4_body: [
      'To match "the timestamps from ERROR rows only", use a lookahead:',
      '',
      '`^\\[([\\d\\- :]+)\\] (?=ERROR)`',
      '',
      '`(?=ERROR)` checks the level without **consuming** "ERROR".',
      '',
      'You should get exactly **2** matches.',
    ].join('\n'),
    s4_hints: ['`(?=ERROR)` is a zero-width assertion.', "There's no need to write `ERROR` in the body — the lookahead already checked it."],
    s4_explanation: 'Without lookahead, `^\\[([\\d\\- :]+)\\] ERROR` would also pick 2 rows, but the match text would include "ERROR" — less convenient if you only want the timestamp.',
    s5_title: 'Recap',
    s5_body: [
      'This lesson combined several tools:',
      '',
      '- `m` flag + `^` `$` — line-level processing',
      '- Named capture `(?<name>...)` — structured output',
      '- Lookahead `(?=...)` — decouple "filter" from "what to capture"',
      '',
      '⚠️ Real-world log formats vary; "look at a sample → write a minimal version → tighten iteratively" usually beats trying to nail a "perfect" pattern in one go.',
    ].join('\n'),
  },
  zh: {
    title: '解析日志行',
    summary: '锚点 + 命名捕获组 + lookahead，把日志拆成结构化字段。',
    s1_title: '行首锚定',
    s1_body: [
      '日志的每一行都长得一样：`[YYYY-MM-DD HH:MM:SS] LEVEL MSG`。',
      '',
      '我们已经打开了 `m` flag，让 `^` 作用于每行行首。',
      '',
      '先写 `^\\[` —— 锁住每行的"左方括号"位置。应该有 **6** 个匹配。',
    ].join('\n'),
    s1_hint: '`[` 在 pattern 里要转义成 `\\[`。',
    s2_title: '抓出时间戳',
    s2_body: [
      '把方括号里的内容捕获出来：`^\\[([\\d\\- :]+)\\]`。',
      '',
      '中括号里的字符类允许：数字、`-`、`:` 和空格。',
    ].join('\n'),
    s2_hints: [
      '字符类里 `-` 放在最前/最后或转义后才表示字面减号。',
      '右括号也要转义：`\\]`。',
    ],
    s3_title: '加入命名捕获',
    s3_body: [
      '编号组容易混。换成**命名捕获**让代码更易读：`(?<name>...)`。',
      '',
      '`^\\[(?<ts>[\\d\\- :]+)\\] (?<level>\\w+)\\s+(?<msg>.*)$`',
      '',
      '三个组：`ts`（时间戳）、`level`（级别）、`msg`（剩余消息）。',
    ].join('\n'),
    s3_hints: [
      '`(?<ts>...)` 给一个组起名。',
      '`\\s+` 吃掉级别后面那些空格（INFO 和 ERROR 之间对齐用）。',
      '`.*$` 抓到行尾。',
    ],
    s3_explanation: '匹配结果里会显示 ts/level/msg 三个命名组。',
    s4_title: '只挑 ERROR 行 —— lookahead 实战',
    s4_body: [
      '想"只匹配 ERROR 那两行的时间戳"？最干净的做法是 lookahead：',
      '',
      '`^\\[([\\d\\- :]+)\\] (?=ERROR)`',
      '',
      '用 `(?=ERROR)` 确认级别是 ERROR，但**不消耗** ERROR 这几个字符。',
      '',
      '应该正好 **2** 个匹配。',
    ].join('\n'),
    s4_hints: ['`(?=ERROR)` 是零宽断言。', '不需要再写 `ERROR` 在主体里——lookahead 已经检查过了。'],
    s4_explanation: '如果不用 lookahead，写 `^\\[([\\d\\- :]+)\\] ERROR` 也能挑出 2 行，但匹配文本会多 "ERROR" 这几个字，不利于直接拿时间戳。',
    s5_title: '小结',
    s5_body: [
      '本课融合了之前的多个工具：',
      '',
      '- `m` flag + `^` `$` —— 行级处理',
      '- 命名捕获组 `(?<name>...)` —— 结构化输出',
      '- lookahead `(?=...)` —— 把"过滤条件"和"想抓的内容"解耦',
      '',
      '⚠️ 真实日志格式各家不同；做到"先看一眼示例 → 写一个能跑的最小版本 → 再迭代加严"通常比一次性写"完美正则"靠谱得多。',
    ].join('\n'),
  },
};

const t = pickLocale(TEXTS);

export const logLesson: Lesson = {
  id: 'practical-log',
  trackId: 'practical',
  title: t.title,
  summary: t.summary,
  difficulty: 'intermediate',
  estimatedMinutes: 7,
  initialState: {
    engine: 'javascript',
    pattern: '',
    flags: 'gm',
    testText: LOG,
  },
  steps: [
    {
      id: 's1',
      title: t.s1_title,
      body: t.s1_body,
      validate: v.all(v.patternEquals('^\\['), v.matchesExactly(6)),
      hints: [t.s1_hint],
      spotlight: { patternSubstrings: ['^'] },
    },
    {
      id: 's2',
      title: t.s2_title,
      body: t.s2_body,
      validate: v.all(
        v.patternEquals('^\\[([\\d\\- :]+)\\]'),
        v.matchesExactly(6),
      ),
      hints: t.s2_hints,
      solution: { pattern: '^\\[([\\d\\- :]+)\\]' },
      spotlight: { patternSubstrings: ['([\\d\\- :]+)'], openPanel: 'matches' },
    },
    {
      id: 's3',
      title: t.s3_title,
      body: t.s3_body,
      validate: v.all(
        v.patternEquals('^\\[(?<ts>[\\d\\- :]+)\\] (?<level>\\w+)\\s+(?<msg>.*)$'),
        v.matchesExactly(6),
      ),
      hints: t.s3_hints,
      solution: {
        pattern: '^\\[(?<ts>[\\d\\- :]+)\\] (?<level>\\w+)\\s+(?<msg>.*)$',
        explanation: t.s3_explanation,
      },
      spotlight: { patternSubstrings: ['(?<level>\\w+)'], openPanel: 'matches' },
    },
    {
      id: 's4',
      title: t.s4_title,
      body: t.s4_body,
      validate: v.all(
        v.patternEquals('^\\[([\\d\\- :]+)\\] (?=ERROR)'),
        v.matchesExactly(2),
      ),
      hints: t.s4_hints,
      solution: {
        pattern: '^\\[([\\d\\- :]+)\\] (?=ERROR)',
        explanation: t.s4_explanation,
      },
      spotlight: { patternSubstrings: ['(?=ERROR)'], openPanel: 'explanation' },
    },
    {
      id: 's5',
      title: t.s5_title,
      body: t.s5_body,
      validate: v.always(),
    },
  ],
  nextLessonId: 'practical-markdown-link',
};

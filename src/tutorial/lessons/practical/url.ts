import type { Locale } from '@/paraglide/runtime';
import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXT = [
  'Docs: https://example.com/api?token=abc.',
  'Old site (http://legacy.example.org)',
  'Visit https://blog.example.io/posts/2024-05-09 today!',
  'No protocol here: example.com is not enough.',
].join('\n');

const TEXTS = {
  en: {
    title: 'Extract URLs from text',
    summary:
      'A real-world mix of lazy quantifiers, negated character classes, and capturing groups.',
    s1_title: 'Simple `https?://\\S+`',
    s1_body: [
      '`https?` — the `?` makes the `s` optional, covering both `http` and `https`.',
      '',
      'Write `https?://\\S+` and see how many you catch.',
    ].join('\n'),
    s1_hint: '`?` means the previous token zero or one time.',
    s2_title: 'It also ate trailing punctuation',
    s2_body: [
      'Line 1: `https://example.com/api?token=abc.` — the trailing `.` was swallowed too. That period is **not** part of the URL.',
      '',
      '`\\S+` accepts every non-whitespace. Switch to "non-whitespace and not common trailing punctuation": `[^\\s.,);]+`.',
      '',
      'Change the pattern to `https?://[^\\s.,);]+`.',
    ].join('\n'),
    s2_hints: [
      'Prefix a character class with `^` to negate it.',
      'Exclude `.` `,` `)` `;` — common trailing punctuation.',
    ],
    s3_title: 'Capture protocol, host, and path separately',
    s3_body: [
      'Need protocol / host / path **individually** in code? Use three capturing groups:',
      '',
      '`(https?)://([^/\\s]+)(/[^\\s.,);]*)?`',
      '',
      '- group 1: protocol (http or https)',
      '- group 2: host (up to the first `/`)',
      '- group 3: path (optional, must start with `/`)',
    ].join('\n'),
    s3_hints: [
      'Host: `[^/\\s]+` — not `/`, not whitespace.',
      'Path: `(/...)?` to make it optional.',
    ],
    s3_explanation: 'Same number of matches, but the matches panel now lists 3 groups.',
    s4_title: 'Recap',
    s4_body: [
      'Key points:',
      '',
      '- `?` = previous token 0 or 1 time — perfect for `http` / `https`',
      '- For URL / token extraction, **negated character classes** are far more accurate than `\\S+`',
      '- Capture groups give you **structured fields** out of a match',
      '',
      '⚠️ Full RFC 3986 URL validation is extremely complex; the patterns above are practical extractors.',
    ].join('\n'),
  },
  zh: {
    title: '从段落里抓 URL',
    summary: '懒惰量词、字符类取反、捕获组的实战组合。',
    s1_title: '简单的 `https?://\\S+`',
    s1_body: [
      '`https?` 里的 `?` 让 `s` 变可选，正好覆盖 `http` 和 `https`。',
      '',
      '写 `https?://\\S+`，看看抓到几个。',
    ].join('\n'),
    s1_hint: '`?` 表示前一项 0 或 1 次。',
    s2_title: '吃了句尾的标点',
    s2_body: [
      '看第一行：`https://example.com/api?token=abc.` 末尾的 `.` 也被吞了——它通常**不属于** URL。',
      '',
      '`\\S+` 把所有非空白都包进来了。改成"任何非空白且不是常见尾标点"：`[^\\s.,);]+`。',
      '',
      '把 pattern 改成 `https?://[^\\s.,);]+`。',
    ].join('\n'),
    s2_hints: ['字符类前面加 `^` 表示取反。', '把 `.` `,` `)` `;` 这种常见尾标点排除掉。'],
    s3_title: '把协议、主机、路径分别捕获',
    s3_body: [
      '需要在代码里**单独拿到**协议 / 主机 / 路径？用三个捕获组：',
      '',
      '`(https?)://([^/\\s]+)(/[^\\s.,);]*)?`',
      '',
      '- group 1：协议（http 或 https）',
      '- group 2：主机（到第一个 `/` 之前）',
      '- group 3：路径（可选，必须以 `/` 开头）',
    ].join('\n'),
    s3_hints: ['主机段用 `[^/\\s]+`——不能是 `/` 也不能是空白。', '路径用 `(/...)? ` 让它可选。'],
    s3_explanation: '匹配数和上一题一样，但下面"匹配结果"会列出 3 个 group。',
    s4_title: '小结',
    s4_body: [
      '本课要点：',
      '',
      '- `?` = 前一项 0 或 1 次，覆盖 `http` / `https`',
      '- 在抓 URL / 文本里的标识符时，**用取反字符类**比 `\\S+` 精确得多',
      '- 想从匹配里**拿到结构化字段**，用捕获组',
      '',
      '⚠️ 完整 URL 校验（RFC 3986）极其复杂；上面只是抽取场景的实用版本。',
    ].join('\n'),
  },
  ja: {
    title: 'テキストから URL を抽出する',
    summary: '量指定子・否定文字クラス・キャプチャグループを実際の抽出に応用します。',
    s1_title: '単純な `https?://\\S+`',
    s1_body:
      '`https?` の `?` は `s` を省略可能にし、http と https の両方を扱います。\n\n`https?://\\S+` と書いて、何件取り出せるか確認しましょう。',
    s1_hint: '`?` は直前の要素を 0 または 1 回にします。',
    s2_title: '末尾の句読点まで取ってしまう',
    s2_body:
      '1 行目の `https://example.com/api?token=abc.` では、URL に含まれない末尾の `.` まで一致します。\n\n`\\S+` は空白以外をすべて許可します。まず `[^\\s.,);]+` で空白と句読点を除外し、`https?://[^\\s.,);]+` を試しましょう。\n\nただし、この形はホスト名のドットも除外するため URL を途中で切ってしまいます。次にホストとパスを分けます。',
    s2_hints: [
      '文字クラスの先頭の `^` は否定です。',
      '`.`、`,`、`)`、`;` を除外すると、必要なドットまで除外してしまう点にも注目してください。',
    ],
    s3_title: 'プロトコル・ホスト・パスを別々に保存する',
    s3_body:
      '各部分を**個別に**使うには、3 つのキャプチャグループを使います。\n\n`(https?)://([^/\\s]+)(/[^\\s.,);]*)?`\n\n- グループ 1: プロトコル（http または https）\n- グループ 2: ホスト（最初の `/` まで）\n- グループ 3: パス（省略可能。`/` で始まる）',
    s3_hints: [
      'ホストは `[^/\\s]+` で、`/` と空白以外です。',
      'パスは `(/...)?` で省略可能にします。',
    ],
    s3_explanation: '一致件数は同じですが、一致結果に 3 つのグループが表示されます。',
    s4_title: 'まとめ',
    s4_body:
      '要点:\n\n- `?` は直前の要素を 0 または 1 回にし、http / https の切り替えに便利\n- **否定文字クラス**は実際の形式に合わせて設計する。除外しすぎると URL を途中で切る\n- キャプチャグループで一致を**構造化した項目**に分けられる\n\nRFC 3986 全体の URL 検証は複雑です。これらは学習用の抽出例で、あらゆる URL に対応するものではありません。',
  },
};

export function createUrlLesson(locale?: Locale): Lesson {
  const t = pickLocale(TEXTS, locale);
  return {
    id: 'practical-url',
    trackId: 'practical',
    title: t.title,
    summary: t.summary,
    difficulty: 'intermediate',
    estimatedMinutes: 6,
    initialState: {
      engine: 'javascript',
      pattern: '',
      flags: 'g',
      testText: TEXT,
    },
    steps: [
      {
        id: 's1',
        title: t.s1_title,
        body: t.s1_body,
        validate: v.all(v.patternEquals('https?://\\S+'), v.matchesExactly(3)),
        hints: [t.s1_hint],
        spotlight: { patternSubstrings: ['s?'], openPanel: 'explanation' },
      },
      {
        id: 's2',
        title: t.s2_title,
        body: t.s2_body,
        validate: v.all(v.patternEquals('https?://[^\\s.,);]+'), v.matchesExactly(3)),
        hints: t.s2_hints,
        solution: { pattern: 'https?://[^\\s.,);]+' },
        spotlight: { patternSubstrings: ['[^\\s.,);]+'], openPanel: 'matches' },
      },
      {
        id: 's3',
        title: t.s3_title,
        body: t.s3_body,
        validate: v.all(
          v.patternEquals('(https?)://([^/\\s]+)(/[^\\s.,);]*)?'),
          v.matchesExactly(3),
        ),
        hints: t.s3_hints,
        solution: {
          pattern: '(https?)://([^/\\s]+)(/[^\\s.,);]*)?',
          explanation: t.s3_explanation,
        },
        spotlight: { patternSubstrings: ['(https?)', '([^/\\s]+)'], openPanel: 'matches' },
      },
      {
        id: 's4',
        title: t.s4_title,
        body: t.s4_body,
        validate: v.always(),
      },
    ],
    nextLessonId: 'practical-log',
  };
}

export const urlLesson = createUrlLesson();

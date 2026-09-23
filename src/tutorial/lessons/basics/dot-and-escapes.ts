import type { Locale } from '@/paraglide/runtime';
import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Dot and escapes: `.` is not the dot you think',
    summary:
      'Understand what `.` really means, escape metacharacters with `\\`, and learn the `s` flag.',
    s1_title: '`.` matches any single character',
    s1_body: [
      '`.` is a metacharacter that by default matches any single character **except newline**.',
      '',
      'Change the pattern to `c.t` so it catches `cat`, `cot`, and `cut` at once.',
    ].join('\n'),
    s1_hint: '`.` occupies one position and matches anything.',
    s2_title: 'Want a literal dot? Escape it',
    s2_body: [
      'When you truly want to match a "." character, write `\\.`. Otherwise it stays "any character".',
      '',
      'In the new text, use `\\d\\.\\d` to match version-number fragments like "digit.digit".',
    ].join('\n'),
    s2_hints: [
      '`\\.` is the literal dot; `\\d` is a digit.',
      'Note: in `1.2.3` the first match consumes `1.2`, leaving the search to resume from `.3`.',
    ],
    s3_title: '`s` flag lets `.` cross newlines',
    s3_body: [
      'By default `.` does not match newlines. Turn on the `s` flag (dotAll) and `.` will match `\\n` too.',
      '',
      'With multi-line test text, see how `a.b` matches differently with `s` off vs on.',
      '',
      'Goal: turn on the `s` flag.',
    ].join('\n'),
    s3_hint: 'Click `s` in the flag area.',
    s4_title: 'Recap',
    s4_body: [
      'Key points:',
      '',
      '- `.` matches **any single character** (not newline by default)',
      '- Prefix a metacharacter with `\\` to make it literal',
      '- Common metacharacters: `. ^ $ * + ? ( ) [ ] { } \\ |`',
      '- The `s` flag lets `.` consume newlines',
      '',
      'Next up: **anchors** — make a regex match only at specific positions.',
    ].join('\n'),
  },
  zh: {
    title: '点号与转义：`.` 不是你以为的那个点',
    summary: '理解 `.` 真实语义、用 `\\` 转义元字符、`s` flag 的影响。',
    s1_title: '`.` 匹配任意单个字符',
    s1_body: [
      '`.` 是元字符，**默认**匹配除换行符外的任意单个字符。',
      '',
      '把 pattern 改成 `c.t`，让它一次匹配 `cat`、`cot`、`cut`。',
    ].join('\n'),
    s1_hint: '`.` 占一个位置，匹配任何字符。',
    s2_title: '想匹配字面点号？转义它',
    s2_body: [
      '当你确实想匹配一个 "."，必须用 `\\.` 转义，否则它会当成"任意字符"。',
      '',
      '在新的文本里，用 `\\d\\.\\d` 匹配类似 "数字.数字" 的版本号片段。',
    ].join('\n'),
    s2_hints: [
      '`\\.` 是字面的点号；`\\d` 是数字。',
      '注意：`1.2.3` 中第一个匹配会消耗 `1.2`，剩下从 `.3` 继续找。',
    ],
    s3_title: '`s` flag 让 `.` 跨行',
    s3_body: [
      '默认情况下 `.` 不匹配换行符。打开 `s` flag（dotAll）后，`.` 也会匹配 `\\n`。',
      '',
      '换一段带换行的测试文本，看看 pattern `a.b` 在 `s` 关闭和打开下分别匹配几次。',
      '',
      '目标：把 `s` flag 打开。',
    ].join('\n'),
    s3_hint: 'flag 区域里点 `s` 即可。',
    s4_title: '小结',
    s4_body: [
      '本课要点：',
      '',
      '- `.` 匹配**任意单个字符**（默认不含换行）',
      '- 想匹配字面元字符，前面加 `\\` 转义',
      '- 常见元字符：`. ^ $ * + ? ( ) [ ] { } \\ |`',
      '- `s` flag 让 `.` 也吃换行',
      '',
      '下一课讲**锚点**：让正则只在特定位置匹配。',
    ].join('\n'),
  },
  ja: {
    title: 'ドットとエスケープ: `.` は普通の点ではない',
    summary: '`.` の意味、`\\` による特殊文字のエスケープ、`s` フラグを学びます。',
    s1_title: '`.` は任意の 1 文字に一致',
    s1_body:
      '`.` は特殊文字で、通常は**改行以外**の任意の 1 文字に一致します。\n\nパターンを `c.t` に変え、`cat`、`cot`、`cut` にまとめて一致させましょう。',
    s1_hint: '`.` は 1 文字分の位置を占め、改行以外の文字に一致します。',
    s2_title: '普通のドットにはエスケープを使う',
    s2_body:
      '「.」そのものに一致させるには `\\.` と書きます。そのままでは「任意の文字」です。\n\n新しいテキストで `\\d\\.\\d` を使い、「数字.数字」というバージョン番号の一部を見つけましょう。',
    s2_hints: [
      '`\\.` は普通のドット、`\\d` は数字です。',
      '`1.2.3` では最初の一致が `1.2` を消費し、残りの `.3` から検索が再開します。',
    ],
    s3_title: '`s` フラグで `.` を改行にも一致させる',
    s3_body:
      '通常、`.` は改行に一致しません。`s`（dotAll）フラグを有効にすると `\\n` にも一致します。\n\n複数行のテキストで、`a.b` が `s` の有無によってどう変わるか確認しましょう。\n\n目標: `s` フラグを有効にする。',
    s3_hint: 'フラグ欄の `s` をクリックしてください。',
    s4_title: 'まとめ',
    s4_body:
      '要点:\n\n- `.` は**任意の 1 文字**（通常は改行を除く）\n- 特殊文字の前に `\\` を付けると通常の文字として扱える\n- 主な特殊文字: `. ^ $ * + ? ( ) [ ] { } \\ |`\n- `s` フラグで `.` が改行にも一致\n\n次は**アンカー**で一致する位置を指定します。',
  },
};

export function createDotAndEscapesLesson(locale?: Locale): Lesson {
  const t = pickLocale(TEXTS, locale);
  return {
    id: 'basics-dot-and-escapes',
    trackId: 'basics',
    title: t.title,
    summary: t.summary,
    difficulty: 'beginner',
    estimatedMinutes: 4,
    initialState: {
      engine: 'javascript',
      pattern: '',
      flags: 'g',
      testText: 'cat cot cut bat sit',
    },
    steps: [
      {
        id: 's1',
        title: t.s1_title,
        body: t.s1_body,
        validate: v.all(v.patternEquals('c.t'), v.matchesExactly(3)),
        hints: [t.s1_hint],
        spotlight: {
          patternSubstrings: ['.'],
          openPanel: 'explanation',
          scrollExplanation: true,
        },
      },
      {
        id: 's2',
        title: t.s2_title,
        body: t.s2_body,
        setup: { testText: 'version 1.2.3 build 4.5' },
        validate: v.all(v.patternEquals('\\d\\.\\d'), v.matchesExactly(2)),
        hints: t.s2_hints,
        solution: { pattern: '\\d\\.\\d' },
        spotlight: {
          patternSubstrings: ['\\.'],
          openPanel: 'explanation',
          scrollExplanation: true,
        },
      },
      {
        id: 's3',
        title: t.s3_title,
        body: t.s3_body,
        setup: {
          pattern: 'a.b',
          flags: 'g',
          testText: 'a\nb a b axb',
        },
        validate: v.all(v.patternEquals('a.b'), v.flagEnabled('s'), v.matchesAtLeast(3)),
        hints: [t.s3_hint],
      },
      {
        id: 's4',
        title: t.s4_title,
        body: t.s4_body,
        validate: v.always(),
      },
    ],
    nextLessonId: 'basics-anchors',
  };
}

export const dotAndEscapesLesson = createDotAndEscapesLesson();

import type { Locale } from '@/paraglide/runtime';
import { TAG_SAMPLE } from '@/content/regexExamples';
import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Lazy: append `?` to a quantifier',
    summary:
      'Make the quantifier consume **as little as possible** so each tag matches on its own.',
    s1_title: 'Change `+` to `+?`',
    s1_body: [
      'Append `?` to a quantifier to make it **lazy**: start with the smallest count and stop as soon as the match succeeds.',
      '',
      'Change the pattern to `<.+?>` — you should get **4** independent tag matches.',
    ].join('\n'),
    s1_hint: '`+?`, `*?`, `??` are the lazy counterparts.',
    s1_explanation: '`.+?` stops as soon as it sees a `>`, so each tag is matched separately.',
    s2_title: 'Recap',
    s2_body: [
      'Remember:',
      '',
      '- Default **greedy**: as much as possible',
      '- Append `?` for **lazy**: as little as possible',
      '- For HTML / quoted strings, lazy is often what you want',
      '',
      'But a more robust approach is **negated character classes**, e.g. `<[^>]+>` simply forbids crossing `>`. Next lesson: precise counts.',
    ].join('\n'),
  },
  zh: {
    title: '懒惰：在量词后加 `?`',
    summary: '让量词尽可能**少**吃，每个标签独立匹配。',
    s1_title: '把 `+` 改成 `+?`',
    s1_body: [
      '在量词后追加 `?` 把它变成**懒惰**模式：从最少的次数开始尝试，能成功就停。',
      '',
      '把 pattern 改成 `<.+?>`，应该会得到 **4** 个独立的标签匹配。',
    ].join('\n'),
    s1_hint: '`+?` `*?` `??` 都是对应的懒惰版本。',
    s1_explanation: '`.+?` 一旦遇到 `>` 就停止，于是每个标签独立。',
    s2_title: '小结',
    s2_body: [
      '记忆要点：',
      '',
      '- 默认**贪婪**：吃尽量多',
      '- 加 `?` 变**懒惰**：吃尽量少',
      '- 解析 HTML / 引号字符串等场景里，懒惰常常是你想要的',
      '',
      '不过更稳的做法其实是**字符类取反**：比如 `<[^>]+>`，根本不让它跨过 `>`。下一课讲量词的精确控制。',
    ].join('\n'),
  },
  ja: {
    title: '最短一致: 量指定子に `?` を付ける',
    summary: '量指定子ができるだけ少ない文字に一致するようにして、タグを個別に取り出します。',
    s1_title: '`+` を `+?` に変える',
    s1_body:
      '量指定子に `?` を付けると**最短一致**になります。最小の回数から試し、パターン全体が成功した時点で止まります。\n\nパターンを `<.+?>` に変えましょう。タグが個別に **4** 件一致します。',
    s1_hint: '`+?`、`*?`、`??` が最短一致の形です。',
    s1_explanation: 'この入力では `.+?` が次の `>` で止まるため、各タグに個別に一致します。',
    s2_title: 'まとめ',
    s2_body:
      '覚えておくこと:\n\n- 標準の**貪欲一致**は多い回数を優先\n- `?` を付けた**最短一致**は少ない回数を優先\n- 形式を限定したタグや引用符付き文字列では最短一致が役立つ\n\n区切りを明確にするには**否定文字クラス**も使えます。たとえば `<[^>]+>` は `>` をまたぐことを禁止します。次は回数の指定です。',
  },
};

const READING = {
  en: {
    introduction:
      'Greedy and lazy quantifiers differ in the order they try repetition counts. Adding a question mark after a quantifier makes it lazy: `+?`, `*?`, `??` and `{n,m}?` try smaller counts first. Both forms must still satisfy the rest of the pattern.',
    s1: {
      title: 'Four separate matches with a lazy quantifier',
      body: 'In `<.+?>`, the `+?` starts by matching one character after `<`. The engine then tries the closing `>`. If it is not there, the dot consumes another character and the closing bracket is tried again.\n\nFor this input, each tag reaches a `>` before the next tag begins. With `g`, the search continues after each closing bracket, producing exactly four matches. Without `g`, a first-match search returns only `<b>`.\n\nThe `?` here modifies `+`; it does not make the closing bracket optional. By contrast, a standalone `?` in `colou?r` makes the preceding `u` optional.',
    },
    s2: {
      title: 'A delimiter rule is different from a lazy preference',
      body: 'The pattern `<[^>]+>` says that the characters between the brackets cannot include `>`. On this controlled input it produces the same four matches, even though its `+` is greedy. A character class constrains what may match; laziness only changes which length is attempted first.\n\nA lazy match can also grow longer. In `<.+?>$`, the final `$` requires the match to reach the end of this one-line input. Stopping at the first `>` would fail that requirement, so the match expands through the closing tag.\n\nNeither form is a general HTML parser: a `>` inside a quoted attribute can make the simple delimiter rule stop too soon. Also, `.` does not match line terminators unless the `s` flag is enabled; `[^>]` can include them. Choose a pattern based on the actual format, not just whether the first example looks right.',
    },
  },
  zh: {
    introduction:
      '贪婪和惰性的区别，是尝试重复次数的顺序。在量词后加问号，就得到惰性形式：`+?`、`*?`、`??`、`{n,m}?` 会先尝试较少的次数。无论哪一种，后面的表达式都必须匹配成功。',
    s1: {
      title: '惰性量词怎样得到四个独立匹配',
      body: '在 `<.+?>` 中，`+?` 先让点号匹配 `<` 后面的一个字符，然后尝试匹配 `>`。如果当前位置不是 `>`，点号就再多匹配一个字符，然后继续尝试。\n\n对这段输入，每个标签都能在下一个标签开始前遇到 `>`。配合 `g`，搜索会在每个结束括号之后继续，因此恰好得到四个匹配。不加 `g` 的首次匹配搜索只会返回 `<b>`。\n\n这里的 `?` 修饰的是 `+`，并不是让末尾尖括号变成可选。相对地，`colou?r` 中单独使用的 `?` 表示前面的 `u` 可以出现零次或一次。',
    },
    s2: {
      title: '禁止跨过分隔符，与优先少匹配的区别',
      body: '`<[^>]+>` 明确规定：尖括号之间的字符不能包含 `>`。它的 `+` 虽然是贪婪的，在这段受控输入上也得到相同的四个匹配。字符类限制“允许匹配什么”，惰性只改变“先尝试匹配多长”。\n\n惰性匹配也可能变长。例如 `<.+?>$` 末尾的 `$` 要求匹配到达这段单行输入的结尾。如果遇到第一个 `>` 就停下，会无法满足这个要求，因此匹配会延伸到结束标签。\n\n这两种写法都不能通用地解析 HTML：属性引号内的 `>` 会让简单的分隔符规则提前停止。另外，`.` 默认不匹配换行符，启用 `s` 才会匹配；`[^>]` 则可以包含换行。选择模式时要根据输入格式判断，而不是只看第一个示例是否正确。',
    },
  },
  ja: {
    introduction:
      '貪欲一致と最短一致の違いは、繰り返し回数を試す順序です。量指定子の後に疑問符を付けた `+?`、`*?`、`??`、`{n,m}?` は少ない回数から試します。どちらもパターンの残りを満たす必要があります。',
    s1: {
      title: '最短一致で 4 つのタグを個別に取り出す',
      body: '`<.+?>` の `+?` は、まず `<` の後の 1 文字に一致します。続いて `>` を試し、なければドットがもう 1 文字消費して、再び閉じ括弧を試します。\n\nこの入力では、各タグは次のタグが始まる前に `>` に到達します。`g` があると各閉じ括弧の後から検索を続け、ちょうど 4 件一致します。`g` がない最初の一致だけの検索では `<b>` だけを返します。\n\nここでの `?` は `+` を修飾しています。閉じ括弧を省略可能にするものではありません。一方、`colou?r` の単独の `?` は直前の `u` を省略可能にします。',
    },
    s2: {
      title: '区切りの制約と最短一致の優先順位は別のもの',
      body: '`<[^>]+>` は、括弧の間に `>` を含められないと指定します。この入力では `+` が貪欲でも同じ 4 件に一致します。文字クラスは一致できる文字を制限し、最短一致は試す長さの順序だけを変えます。\n\n最短一致でも長く伸びることがあります。`<.+?>$` の最後の `$` は、この 1 行の末尾まで一致するよう要求します。最初の `>` で止まると満たせないため、終了タグまで一致が広がります。\n\nどちらも一般的な HTML パーサーではありません。引用符付き属性内の `>` で早く止まる場合があります。また `.` は `s` フラグなしでは改行に一致しませんが、`[^>]` は改行を含められます。最初の例だけで判断せず、実際の形式に合わせて選びましょう。',
    },
  },
};

export function createLazyLesson(locale?: Locale): Lesson {
  const t = pickLocale(TEXTS, locale);
  const reading = pickLocale(READING, locale);
  return {
    id: 'quantifiers-lazy',
    trackId: 'quantifiers',
    title: t.title,
    summary: t.summary,
    reading: {
      introduction: reading.introduction,
      references: [
        {
          title: 'MDN: Quantifiers',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions/Quantifiers',
        },
      ],
    },
    difficulty: 'intermediate',
    estimatedMinutes: 3,
    initialState: {
      engine: 'javascript',
      pattern: '<.+>',
      flags: 'g',
      testText: TAG_SAMPLE,
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
              pattern: '<.+?>',
              flags: 'g',
              testText: TAG_SAMPLE,
              matches: [{ text: '<b>' }, { text: '</b>' }, { text: '<i>' }, { text: '</i>' }],
            },
          ],
        },
        validate: v.all(v.patternEquals('<.+?>'), v.matchesExactly(4)),
        hints: [t.s1_hint],
        solution: { pattern: '<.+?>', explanation: t.s1_explanation },
        spotlight: {
          patternSubstrings: ['.+?'],
          openPanel: 'explanation',
          scrollExplanation: true,
        },
      },
      {
        id: 's2',
        title: t.s2_title,
        body: t.s2_body,
        reading: {
          ...reading.s2,
          examples: [
            {
              pattern: '<[^>]+>',
              flags: 'g',
              testText: TAG_SAMPLE,
              matches: [{ text: '<b>' }, { text: '</b>' }, { text: '<i>' }, { text: '</i>' }],
            },
            {
              pattern: '<.+?>$',
              flags: 'g',
              testText: '<b>one</b>',
              matches: [{ text: '<b>one</b>' }],
            },
            {
              pattern: '<[^>]+>',
              flags: 'g',
              testText: '<a title="1 > 0">',
              matches: [{ text: '<a title="1 >' }],
            },
          ],
        },
        validate: v.always(),
      },
    ],
    nextLessonId: 'quantifiers-counted',
  };
}

export const lazyLesson = createLazyLesson();

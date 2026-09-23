import type { Locale } from '@/paraglide/runtime';
import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXT = [
  'Reach out: hello@example.com or sales@example.org.',
  'Engineering: alice+filter@mail.sub.example.io',
  'Phone (no email): 555-1234, see you soon!',
  'Bad ones: bob@host (no TLD), @nope.com, user@.com',
].join('\n');

const TEXTS = {
  en: {
    title: 'Extract emails from text',
    summary: 'Combine character classes, `+`, escaping, and `\\b` to extract email-like strings.',
    s1_title: 'The naive approach',
    s1_body: [
      'Seeing "email", the natural first try is `\\S+@\\S+` — non-whitespace + `@` + non-whitespace.',
      '',
      'Type it into the pattern and see how many matches you get.',
    ].join('\n'),
    s1_hint: '`\\S` matches "any non-whitespace character".',
    s2_title: 'Problem: it grabs punctuation',
    s2_body: [
      'Look at the first line — the trailing `.` after `sales@example.org` was eaten too. `\\S+` is too greedy.',
      '',
      'Use stricter character classes: local part allows `[\\w.+-]`, host allows `[\\w-]`, joined by `\\.`.',
      '',
      'Change the pattern to `[\\w.+-]+@[\\w-]+\\.\\w+`. You should get **3** matches, but the subdomain address is still truncated to `alice+filter@mail.sub`.',
    ].join('\n'),
    s2_hints: ['Local part: `[\\w.+-]+`', 'Host: `[\\w-]+`', 'Then `\\.\\w+` for "dot + TLD".'],
    s3_title: 'Stricter TLD',
    s3_body: [
      '`\\w+` lets the TLD be anything; this simplified pattern will require at least 2 ASCII **letters** there.',
      '',
      'Replace the trailing `\\w+` with `[a-zA-Z]{2,}`.',
    ].join('\n'),
    s3_hint: '`[a-zA-Z]{2,}` = at least 2 letters.',
    s4_title: 'Add word boundaries',
    s4_body: [
      'Add `\\b` on both sides to require word boundaries: `\\b...\\b`. These are not email boundaries; they do not fix the subdomain truncation.',
      '',
      'Final pattern: `\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b`.',
    ].join('\n'),
    s4_explanation:
      'Boundary + local + `@` + host + `.TLD` + boundary — a simplified teaching pattern that can truncate subdomains.',
    s5_title: 'Recap',
    s5_body: [
      'Key points:',
      '',
      '- In real text `\\S+` is almost always too broad — use specific character classes',
      '- Express "at least N occurrences" with `{n,}`',
      '- `\\b` asserts word boundaries; it does not validate an address',
      '',
      '⚠️ Note: real RFC 5322 email syntax is **extremely** complex; this pattern is a practical extractor, not a 100% RFC-compliant validator.',
    ].join('\n'),
  },
  zh: {
    title: '从段落里抓邮箱',
    summary: '把字符类、`+`、转义和 `\\b` 组合起来提取形似邮箱的字符串。',
    s1_title: '最朴素的写法',
    s1_body: [
      '看到 "邮箱"，最直觉的写法是 `\\S+@\\S+`——非空白 + `@` + 非空白。',
      '',
      '把它写进 pattern，看看会抓到几个匹配。',
    ].join('\n'),
    s1_hint: '`\\S` 是"任意非空白字符"。',
    s2_title: '问题：吃了标点',
    s2_body: [
      '注意第一行的匹配——`sales@example.org` 后面那个 `.` 也被抓进去了。`\\S+` 太贪了。',
      '',
      '改用更精确的字符类：本地段允许 `[\\w.+-]`，主机段允许 `[\\w-]`，中间再用 `\\.` 串起来。',
      '',
      '把 pattern 改成 `[\\w.+-]+@[\\w-]+\\.\\w+`，应该得到 **3** 个匹配，但子域名邮箱仍会被截成 `alice+filter@mail.sub`。',
    ].join('\n'),
    s2_hints: ['本地段：`[\\w.+-]+`', '主机段：`[\\w-]+`', '后面再 `\\.\\w+` 表示"点 + TLD"。'],
    s3_title: '更严格的 TLD',
    s3_body: [
      '`\\w+` 让 TLD 任意长度，本例把该位置限制为至少 2 个 ASCII **字母**。',
      '',
      '把末尾的 `\\w+` 换成 `[a-zA-Z]{2,}`。',
    ].join('\n'),
    s3_hint: '`[a-zA-Z]{2,}` ＝ 至少 2 个字母。',
    s4_title: '加上词边界',
    s4_body: [
      '最后在两端添加词边界 `\\b`：`\\b...\\b`。词边界并不是邮箱边界，也不能解决子域名被截短的问题。',
      '',
      '完整 pattern：`\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b`。',
    ].join('\n'),
    s4_explanation:
      '边界 + 本地段 + `@` + 主机 + `.TLD` + 边界，是一个可能截短子域名的简化教学模式。',
    s5_title: '小结',
    s5_body: [
      '本课要点：',
      '',
      '- 真实场景里 `\\S+` 几乎总是太宽——用具体字符类',
      '- 想表达"至少 N 次某种字符"用 `{n,}`',
      '- `\\b` 断言词边界，并不验证邮箱是否合法',
      '',
      '⚠️ 注意：RFC 5322 真正的邮箱语法**非常**复杂，这里这种 pattern 只是工程实践里的"够用"版本，不是 100% 合规验证器。',
    ].join('\n'),
  },
  ja: {
    title: 'テキストからメールアドレスを抽出する',
    summary:
      '文字クラス・`+`・エスケープ・`\\b` を組み合わせ、メールアドレスらしい文字列を取り出します。',
    s1_title: 'まずは単純な方法で試す',
    s1_body:
      '最初に `\\S+@\\S+`、つまり空白以外の文字 + `@` + 空白以外の文字を試してみましょう。\n\nパターンを入力して、一致件数を確認してください。',
    s1_hint: '`\\S` は空白以外の文字に一致します。',
    s2_title: '問題: 句読点まで取ってしまう',
    s2_body:
      '最初の行では `sales@example.org` の後の `.` まで取っています。`\\S+` の許可範囲が広すぎます。\n\nローカル部に `[\\w.+-]`、ホストに `[\\w-]` を使い、`\\.` でつなぎましょう。\n\n`[\\w.+-]+@[\\w-]+\\.\\w+` に変えると **3** 件一致しますが、サブドメイン付きアドレスは `alice+filter@mail.sub` で切れたままです。',
    s2_hints: [
      'ローカル部は `[\\w.+-]+`。',
      'ホストは `[\\w-]+`。',
      '最後に `\\.\\w+` でドットと末尾部分を指定します。',
    ],
    s3_title: 'ドメインの末尾を厳しくする',
    s3_body:
      '`\\w+` は数字やアンダースコアも許可します。この簡略化したパターンでは、末尾に 2 文字以上の ASCII **英字**を要求します。\n\n最後の `\\w+` を `[a-zA-Z]{2,}` に変えましょう。',
    s3_hint: '`[a-zA-Z]{2,}` は英字 2 文字以上です。',
    s4_title: '単語境界を追加する',
    s4_body:
      '両側に `\\b` を付け、`\\b...\\b` とします。これはメールアドレスの境界ではなく単語境界なので、サブドメインの途中で切れる問題は解決しません。\n\n最終パターン: `\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b`。',
    s4_explanation:
      '境界 + ローカル部 + `@` + ホスト + `.TLD` + 境界という学習用パターンです。サブドメインを途中で切る場合があります。',
    s5_title: 'まとめ',
    s5_body:
      '要点:\n\n- 実際のテキストでは `\\S+` の範囲が広すぎることが多く、具体的な文字クラスが必要\n- 「n 回以上」は `{n,}`\n- `\\b` は単語境界の確認であり、アドレスの検証ではない\n\nRFC 5322 のメール構文は非常に複雑です。このパターンは簡略化した抽出例で、完全な検証器ではありません。',
  },
};

const READING = {
  en: {
    introduction:
      'Extracting email-like text, validating an entire form field and proving that a mailbox exists are different tasks. This lesson builds an extractor in stages and shows the actual output at each stage. A match is a candidate string, not evidence that an address is valid or can receive mail.',
    s1: {
      title: 'Non-whitespace is too broad a rule',
      body: 'The pattern `\\S+@\\S+` requires non-whitespace on both sides of `@`. It makes no distinction between address characters and punctuation. In the sample, it includes the sentence-ending dot after `sales@example.org`, accepts `bob@host` without a domain suffix, and also accepts `user@.com`.\n\nThere are five matches, including two clearly unsuitable candidates. The input `@nope.com,` is not matched because it has no local part before the at sign. A larger match count does not mean better extraction.',
    },
    s2: {
      title: 'Character classes remove punctuation, but can truncate an address',
      body: 'In `[\\w.+-]+@[\\w-]+\\.\\w+`, the local part permits word characters, dots, plus signs and hyphens. The host before the dot permits word characters and hyphens. The escaped dot requires an actual period.\n\nThe trailing punctuation is gone, but there is still a problem: `alice+filter@mail.sub.example.io` becomes `alice+filter@mail.sub`. The pattern describes just one host label followed by one suffix. Finding three matches does not mean that all three addresses were extracted completely.',
    },
    s3: {
      title: 'An alphabetic suffix is a deliberate simplification',
      body: 'Replacing the final `\\w+` with `[a-zA-Z]{2,}` requires at least two ASCII letters at that point. This avoids treating a run of digits or underscores as the suffix. It is a limited rule for this example, not a complete description of every possible domain.\n\nThe subdomain problem remains: the regex can treat `sub` as the suffix and stop there. Also, an unanchored search can match only a prefix of a longer token. Each result must be checked for its content, not only counted.',
    },
    s4: {
      title: 'What a word boundary does—and does not—guarantee',
      body: 'A `\\b` asserts a position between a word character and a non-word character, or a string edge next to a word character. It consumes no characters. In these examples, word characters are the ones matched by `\\w`.\n\nAdding boundaries does not solve the truncated address: a dot is a non-word character, so a boundary exists between `sub` and the following dot. Nor does a boundary mean “valid email boundary”. For example, the leading `+` in `+tag@example.com` is dropped because there is no word boundary before that plus sign.',
    },
    s5: {
      title: 'Support subdomains, and keep extraction separate from validation',
      body: 'The group `(?:[\\w-]+\\.)+` repeats a domain label and its following dot. Combining it with an alphabetic suffix extracts the full subdomain address in the original sample. This improvement handles this specific format; it still accepts values such as `bad..dots@example.com` and underscores in host labels.\n\nFor a form field, an unanchored extraction regex is the wrong check: it may accept a substring surrounded by unrelated text. HTML `type="email"` provides a browser-level syntax check; application rules and server-side validation still need to match the product’s requirements. Confirming mailbox access requires a verification message or another ownership check.\n\nThe practical lesson is to test successful cases, rejected cases and partial matches separately. This extractor intentionally does not cover quoted local parts, internationalized addresses or the full email syntax.',
    },
  },
  zh: {
    introduction:
      '从文章里找出邮箱样子的文本、校验整个表单字段、确认邮箱真实存在，是三个不同的问题。本课逐步构造一个提取式，并展示每一步的实际结果。匹配到的只是候选字符串，不代表地址合法，也不代表它能接收邮件。',
    s1: {
      title: '“非空白”这个条件太宽了',
      body: '`\\S+@\\S+` 要求 `@` 两侧各有至少一个非空白字符。它分不清邮箱字符和标点：示例中会带上 `sales@example.org` 后面的句号，也会接受没有域名后缀的 `bob@host` 和 `user@.com`。\n\n实际结果有五个匹配，其中包含两个明显不符合预期的片段。`@nope.com,` 因为 `@` 前缺少本地部分，没有被匹配。可见匹配数多，并不代表提取得好。',
    },
    s2: {
      title: '字符类去掉了标点，却可能截短邮箱',
      body: '在 `[\\w.+-]+@[\\w-]+\\.\\w+` 中，本地部分允许单词字符、点号、加号和连字符；点号前的主机部分允许单词字符和连字符；转义后的 `\\.` 要求出现真正的点号。\n\n这次句末标点不再被包含，但 `alice+filter@mail.sub.example.io` 被截成了 `alice+filter@mail.sub`。原因是表达式只描述了一段主机名加一段后缀。虽然恰好得到三个匹配，也不能说明三个邮箱都提取完整了。',
    },
    s3: {
      title: '字母后缀是本例主动选择的简化规则',
      body: '把末尾的 `\\w+` 改成 `[a-zA-Z]{2,}`，表示该位置至少需要两个 ASCII 字母，避免把一串数字或下划线当作后缀。这是本例采用的限制，不是对所有域名形式的完整描述。\n\n子域名的问题依然存在：表达式可以把 `sub` 当作后缀，并在那里停止。另外，没有锚定整个输入的搜索可能只匹配较长字符串的前半段。因此除了计数，还要检查每一段结果的具体内容。',
    },
    s4: {
      title: '词边界能保证什么，不能保证什么',
      body: '`\\b` 断言单词字符与非单词字符之间的位置，或者字符串端点与单词字符相邻的位置，本身不消耗字符。这里的单词字符，就是 `\\w` 所匹配的字符。\n\n加词边界也无法修复子域名截断：点号不是单词字符，所以 `sub` 和后面的点号之间恰好存在词边界。词边界也不等于“合法的邮箱边界”：例如输入 `+tag@example.com` 时，开头加号前没有词边界，结果会漏掉这个加号。',
    },
    s5: {
      title: '支持子域名，并区分提取与校验',
      body: '分组 `(?:[\\w-]+\\.)+` 表示重复一段域名标签和后面的点号。把它与字母后缀组合起来，就能在原始样本中提取完整的子域名邮箱。这个改进针对的是当前格式，它仍然会接受 `bad..dots@example.com`，也允许主机名标签包含下划线。\n\n对于表单字段，没有锚定整个输入的提取式并不适合直接校验：即使前后夹着无关文字，中间的子串也可能匹配成功。HTML 的 `type="email"` 可以提供浏览器端的语法检查，应用规则和服务端校验仍需按产品要求制定。确认用户能访问收件箱，需要验证邮件或其他所有权验证。\n\n实际使用时，应分别检查成功案例、应拒绝的案例以及只匹配到一部分的案例。这里的提取式没有覆盖带引号的本地部分、国际化地址或完整邮箱语法。',
    },
  },
  ja: {
    introduction:
      'メールらしいテキストの抽出、フォームの入力全体の検証、メールボックスの存在確認はそれぞれ別の作業です。このレッスンでは抽出パターンを段階的に作り、各段階の実際の出力を示します。一致することは、アドレスが有効でメールを受信できる証明にはなりません。',
    s1: {
      title: '「空白以外」では許可範囲が広すぎる',
      body: '`\\S+@\\S+` は `@` の両側に空白以外の文字を要求するだけで、アドレスの文字と句読点を区別しません。この例では `sales@example.org` の文末のドットを含め、末尾のドメインがない `bob@host` や `user@.com` も許可します。\n\n一致は 5 件で、不適切な候補も含まれます。`@nope.com,` は @ の前にローカル部がないため一致しません。一致件数が多いことと、正確に抽出できることは別です。',
    },
    s2: {
      title: '文字クラスで句読点を除いても、アドレスが途中で切れる',
      body: '`[\\w.+-]+@[\\w-]+\\.\\w+` のローカル部は単語構成文字・ドット・プラス・ハイフンを許可します。ドットの前のホストは単語構成文字とハイフンです。エスケープしたドットは実際の句点を要求します。\n\n末尾の句読点は除けましたが、`alice+filter@mail.sub.example.io` が `alice+filter@mail.sub` で切れます。パターンがホストのラベル 1 個と末尾部分 1 個しか表していないためです。3 件一致しても、3 つとも完全に抽出できたとは限りません。',
    },
    s3: {
      title: '英字の末尾は意図的な簡略化',
      body: '最後の `\\w+` を `[a-zA-Z]{2,}` に変えると、その位置に 2 文字以上の ASCII 英字が必要になります。数字やアンダースコアだけの末尾を避けられますが、あらゆるドメインを表す規則ではありません。\n\nサブドメインの問題は残ります。`sub` を末尾とみなして止まれるからです。また、アンカーのない検索は長い文字列の一部だけに一致する場合があります。件数だけでなく各一致の内容を確認しましょう。',
    },
    s4: {
      title: '単語境界が保証すること・しないこと',
      body: '`\\b` は単語構成文字とそれ以外の文字の境目、または単語構成文字に接する文字列の端を確認します。文字は消費しません。この例での単語構成文字は `\\w` の対象です。\n\nドットは単語構成文字ではないため、`sub` と次のドットの間にも境界があります。したがって、境界を付けてもアドレスの切断は直りません。また「有効なメールアドレスの境界」を表すものでもありません。`+tag@example.com` の先頭の `+` は、その前に単語境界がないため一致から落ちます。',
    },
    s5: {
      title: 'サブドメインに対応し、抽出と検証を分ける',
      body: '`(?:[\\w-]+\\.)+` はドメインのラベルとドットを繰り返します。英字の末尾と組み合わせると、元のサンプルのサブドメイン付きアドレスを最後まで取り出せます。ただし `bad..dots@example.com` やホスト内のアンダースコアも許可するため、対応できるのは限定した形式です。\n\nフォームの入力全体を検証する場合、アンカーのない抽出用パターンでは、無関係な文字に囲まれた一部分だけが一致しても成功してしまいます。HTML の `type="email"` はブラウザーで構文を確認できますが、アプリの規則とサーバー側の検証も要件に合わせる必要があります。メールボックスを利用できるかは、確認メールなどで別途確かめます。\n\n成功例・拒否すべき例・部分一致を分けてテストしましょう。この抽出例は、引用符付きローカル部、国際化アドレス、メール構文全体には対応していません。',
    },
  },
};

export function createEmailLesson(locale?: Locale): Lesson {
  const t = pickLocale(TEXTS, locale);
  const reading = pickLocale(READING, locale);
  return {
    id: 'practical-email',
    trackId: 'practical',
    title: t.title,
    summary: t.summary,
    reading: {
      introduction: reading.introduction,
      references: [
        {
          title: 'MDN: Word boundary assertion',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion',
        },
        {
          title: 'MDN: <input type="email">',
          url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/email',
        },
      ],
    },
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
        reading: {
          ...reading.s1,
          examples: [
            {
              pattern: '\\S+@\\S+',
              flags: 'g',
              testText: TEXT,
              matches: [
                { text: 'hello@example.com' },
                { text: 'sales@example.org.' },
                { text: 'alice+filter@mail.sub.example.io' },
                { text: 'bob@host' },
                { text: 'user@.com' },
              ],
            },
          ],
        },
        validate: v.all(v.patternEquals('\\S+@\\S+'), v.matchesAtLeast(3)),
        hints: [t.s1_hint],
        spotlight: { patternSubstrings: ['\\S+'], openPanel: 'matches' },
      },
      {
        id: 's2',
        title: t.s2_title,
        body: t.s2_body,
        reading: {
          ...reading.s2,
          examples: [
            {
              pattern: '[\\w.+-]+@[\\w-]+\\.\\w+',
              flags: 'g',
              testText: TEXT,
              matches: [
                { text: 'hello@example.com' },
                { text: 'sales@example.org' },
                { text: 'alice+filter@mail.sub' },
              ],
            },
          ],
        },
        validate: v.all(v.patternEquals('[\\w.+-]+@[\\w-]+\\.\\w+'), v.matchesExactly(3)),
        hints: t.s2_hints,
        solution: { pattern: '[\\w.+-]+@[\\w-]+\\.\\w+' },
        spotlight: { patternSubstrings: ['[\\w.+-]+', '[\\w-]+'], openPanel: 'matches' },
      },
      {
        id: 's3',
        title: t.s3_title,
        body: t.s3_body,
        reading: {
          ...reading.s3,
          examples: [
            {
              pattern: '[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}',
              flags: 'g',
              testText: TEXT,
              matches: [
                { text: 'hello@example.com' },
                { text: 'sales@example.org' },
                { text: 'alice+filter@mail.sub' },
              ],
            },
          ],
        },
        validate: v.all(v.patternEquals('[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}'), v.matchesExactly(3)),
        hints: [t.s3_hint],
        spotlight: { patternSubstrings: ['[a-zA-Z]{2,}'] },
      },
      {
        id: 's4',
        title: t.s4_title,
        body: t.s4_body,
        reading: {
          ...reading.s4,
          examples: [
            {
              pattern: '\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b',
              flags: 'g',
              testText: 'alice+filter@mail.sub.example.io\n+tag@example.com',
              matches: [{ text: 'alice+filter@mail.sub' }, { text: 'tag@example.com' }],
            },
          ],
        },
        validate: v.all(
          v.patternEquals('\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b'),
          v.matchesExactly(3),
        ),
        solution: {
          pattern: '\\b[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}\\b',
          explanation: t.s4_explanation,
        },
        spotlight: { patternSubstrings: ['\\b'] },
      },
      {
        id: 's5',
        title: t.s5_title,
        body: t.s5_body,
        reading: {
          ...reading.s5,
          examples: [
            {
              pattern: '[\\w.+-]+@(?:[\\w-]+\\.)+[a-zA-Z]{2,}',
              flags: 'g',
              testText: TEXT,
              matches: [
                { text: 'hello@example.com' },
                { text: 'sales@example.org' },
                { text: 'alice+filter@mail.sub.example.io' },
              ],
            },
            {
              pattern: '[\\w.+-]+@(?:[\\w-]+\\.)+[a-zA-Z]{2,}',
              flags: 'g',
              testText: 'bad..dots@example.com',
              matches: [{ text: 'bad..dots@example.com' }],
            },
          ],
        },
        validate: v.always(),
      },
    ],
    nextLessonId: 'practical-url',
  };
}

export const emailLesson = createEmailLesson();

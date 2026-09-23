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

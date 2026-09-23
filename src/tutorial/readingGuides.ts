import type { Locale } from '@/paraglide/runtime';
import type { Lesson, ReadingExample } from './types';
import { pickLocale } from './i18n';

type Translation = Record<Locale, string>;
interface Guide {
  introduction: Translation;
  steps: Array<{ body: Translation; title?: Translation; examples: ReadingExample[] }>;
}
// Expected outputs are authored explicitly and checked against the execution engine.
const guides: Record<string, Guide> = {
  'basics-literals': {
    introduction: {
      en: 'A literal regex finds an exact sequence of characters. Word boundaries and flags change where that sequence is accepted.',
      zh: '字面量正则查找完全相同的字符序列。单词边界和标志决定哪些位置、哪些大小写可以匹配。',
      ja: 'リテラルは同じ文字列に一致します。単語境界とフラグで、一致する位置や大文字・小文字の扱いを調整できます。',
    },
    steps: [
      {
        body: {
          en: 'The pattern cat searches for three adjacent letters. It can also match inside a longer word; spaces are not implied.',
          zh: 'cat 查找连续的三个字母，也会匹配较长单词内部，不会自动要求空格或单词边界。',
          ja: 'cat は連続した3文字を探します。長い単語の内部にも一致し、空白や単語境界は暗黙に追加されません。',
        },
        examples: [
          {
            pattern: 'cat',
            flags: 'g',
            testText: 'cat sat on the mat. The cat was black. Concatenate.',
            matches: [
              {
                text: 'cat',
              },
              {
                text: 'cat',
              },
              {
                text: 'cat',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The g flag continues after each match. The third cat is inside Concatenate; three matches do not mean three standalone words.',
          zh: 'g 标志让搜索在每次匹配后继续。第三个 cat 位于 Concatenate 内，因此三次匹配不等于三个独立单词。',
          ja: 'g は各一致の後も検索を続けます。3件目は Concatenate の内部であり、3件一致しても独立した単語が3個あるとは限りません。',
        },
        examples: [
          {
            pattern: 'cat',
            flags: 'g',
            testText: 'cat sat on the mat. The cat was black. Concatenate.',
            matches: [
              {
                text: 'cat',
              },
              {
                text: 'cat',
              },
              {
                text: 'cat',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '\\b checks a word boundary without consuming text. Putting it on both sides rejects the interior of Concatenate. This is a word-character boundary, not a language-aware word tokenizer.',
          zh: '\\b 检查单词字符与非单词字符之间的位置，不消耗字符。两侧都加边界即可排除 Concatenate 内部的 cat；它不是自然语言分词器。',
          ja: '\\b は文字を消費せず単語文字の境界を確認します。両端に置くと Concatenate 内部を除外できますが、自然言語の単語分割ではありません。',
        },
        examples: [
          {
            pattern: '\\bcat\\b',
            flags: 'g',
            testText: 'cat sat on the mat. The cat was black. Concatenate.',
            matches: [
              {
                text: 'cat',
              },
              {
                text: 'cat',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'With i, cat also matches Cat. The returned text keeps its original spelling; case-insensitive matching does not rewrite input.',
          zh: 'i 让 cat 也能匹配 Cat。返回的匹配文本保留原始大小写，不会改写输入。',
          ja: 'i を付けると cat は Cat にも一致します。返される文字列の表記は入力のままで、書き換えは行いません。',
        },
        examples: [
          {
            pattern: '\\bcat\\b',
            flags: 'gi',
            testText: 'cat Cat Concatenate',
            matches: [
              {
                text: 'cat',
              },
              {
                text: 'Cat',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Combine literals, boundaries and flags deliberately: g selects every occurrence, i ignores case, and boundaries restrict position.',
          zh: '组合字面量、边界与标志时要区分职责：g 搜索全部匹配，i 忽略大小写，边界约束位置。',
          ja: 'リテラル・境界・フラグは役割が異なります。g は全件検索、i は大文字小文字の無視、境界は位置の制限です。',
        },
        examples: [],
      },
    ],
  },
  'basics-classes': {
    introduction: {
      en: 'Character classes match one character from a set. A range is shorthand for a set, while a negated class excludes its members.',
      zh: '字符类一次匹配集合中的一个字符。范围是集合的简写，取反字符类则排除集合中的字符。',
      ja: '文字クラスは集合に含まれる1文字に一致します。範囲は集合の省略表記で、否定クラスは集合内の文字を除外します。',
    },
    steps: [
      {
        body: {
          en: '[abc] consumes one a, b or c. Repetition requires a separate quantifier; the brackets alone do not match a whole word.',
          zh: '[abc] 一次只消耗一个 a、b 或 c。若需连续匹配多个字符，还要加量词，方括号本身并不代表整个单词。',
          ja: '[abc] が消費するのは a・b・c のどれか1文字です。連続した文字には量指定子が必要で、角括弧だけで単語全体には一致しません。',
        },
        examples: [
          {
            pattern: '[abc]',
            flags: 'g',
            testText: 'apple banana cherry',
            matches: [
              {
                text: 'a',
              },
              {
                text: 'b',
              },
              {
                text: 'a',
              },
              {
                text: 'a',
              },
              {
                text: 'a',
              },
              {
                text: 'c',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '[a-e] includes the endpoints and is equivalent to [abcde]. For this input it adds the two e characters to the previous six matches.',
          zh: '[a-e] 包含两端，等价于 [abcde]。本例比上一式多匹配两个 e，共八项。',
          ja: '[a-e] は両端を含み [abcde] と同じです。この入力では e が2件増え、合計8件になります。',
        },
        examples: [
          {
            pattern: '[a-e]',
            flags: 'g',
            testText: 'apple banana cherry',
            matches: [
              {
                text: 'a',
              },
              {
                text: 'e',
              },
              {
                text: 'b',
              },
              {
                text: 'a',
              },
              {
                text: 'a',
              },
              {
                text: 'a',
              },
              {
                text: 'c',
              },
              {
                text: 'e',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'In JavaScript, \\d means ASCII digits 0–9. Without a quantifier, a multi-digit number produces separate one-character matches.',
          zh: 'JavaScript 中 \\d 表示 ASCII 数字 0–9。不加量词时，一个多位数会产生多项单字符匹配。',
          ja: 'JavaScript の \\d は ASCII の0〜9です。量指定子がなければ、複数桁の数値は1文字ずつ一致します。',
        },
        examples: [
          {
            pattern: '\\d',
            flags: 'g',
            testText: 'Order #2025-001 ships on day 7.',
            matches: [
              {
                text: '2',
              },
              {
                text: '0',
              },
              {
                text: '2',
              },
              {
                text: '5',
              },
              {
                text: '0',
              },
              {
                text: '0',
              },
              {
                text: '1',
              },
              {
                text: '7',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '[^aeiou] accepts anything except those five lowercase vowels, including punctuation or digits if present. It means consonants only when the input itself contains lowercase letters alone.',
          zh: '[^aeiou] 接受五个小写元音之外的任意字符，也可能包含数字或标点。只有输入限定为小写字母时，结果才等同于辅音。',
          ja: '[^aeiou] は5つの小文字母音以外を許可し、数字や記号も含みます。入力が小文字の英字だけの場合に限り、結果を子音とみなせます。',
        },
        examples: [
          {
            pattern: '[^aeiou]',
            flags: 'g',
            testText: 'education',
            matches: [
              {
                text: 'd',
              },
              {
                text: 'c',
              },
              {
                text: 't',
              },
              {
                text: 'n',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'A class specifies allowed characters; a quantifier specifies how many. Keep ranges and exclusions explicit when validating a restricted alphabet.',
          zh: '字符类定义允许哪些字符，量词定义出现多少次。校验限定字符集时，应明确范围和排除项。',
          ja: '文字クラスは許可する文字、量指定子は回数を決めます。限定した文字集合の検証では範囲と除外条件を明確にします。',
        },
        examples: [],
      },
    ],
  },
  'basics-dot-and-escapes': {
    introduction: {
      en: 'A dot is a wildcard, not a literal period. Escaping and dotAll let you choose between literal punctuation and a broader match.',
      zh: '点号是通配符，不是普通句点。转义与 dotAll 标志分别用于匹配字面标点和跨越换行。',
      ja: 'ドットは通常の句点ではなくワイルドカードです。エスケープで句点自体を指定し、dotAll で改行も対象にできます。',
    },
    steps: [
      {
        body: {
          en: 'c.t accepts any intervening character except a line terminator by default. The surrounding c and t remain literal.',
          zh: 'c.t 默认接受 c 与 t 之间的一个非行终止字符，两端的 c、t 仍是字面量。',
          ja: 'c.t は標準では c と t の間の改行以外の1文字を許可します。c と t はそのままの文字です。',
        },
        examples: [
          {
            pattern: 'c.t',
            flags: 'g',
            testText: 'cat cot cut bat sit',
            matches: [
              {
                text: 'cat',
              },
              {
                text: 'cot',
              },
              {
                text: 'cut',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '\\d\\.\\d requires a literal period between two digits. Global matches do not overlap: matching 1.2 consumes the 2, so 2.3 is not a second match.',
          zh: '\\d\\.\\d 要求两个数字之间是字面点号。全局匹配不重叠：1.2 消耗了 2，因此不会再匹配 2.3。',
          ja: '\\d\\.\\d は数字の間に句点を要求します。全件検索でも一致は重ならず、1.2 が 2 を消費するため 2.3 は次の一致になりません。',
        },
        examples: [
          {
            pattern: '\\d\\.\\d',
            flags: 'g',
            testText: 'version 1.2.3 build 4.5',
            matches: [
              {
                text: '1.2',
              },
              {
                text: '4.5',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 's makes the dot accept line terminators. It is separate from m, which changes the meaning of line anchors.',
          zh: 's 让点号接受行终止字符；它不同于 m，后者改变行首行尾锚点的行为。',
          ja: 's はドットに改行を許可します。行頭・行末のアンカーを変更する m とは別の機能です。',
        },
        examples: [
          {
            pattern: 'a.b',
            flags: 'g',
            testText: 'a\nb a b axb',
            matches: [
              {
                text: 'a b',
              },
              {
                text: 'axb',
              },
            ],
          },
          {
            pattern: 'a.b',
            flags: 'gs',
            testText: 'a\nb a b axb',
            matches: [
              {
                text: 'a\nb',
              },
              {
                text: 'a b',
              },
              {
                text: 'axb',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Escape punctuation when it has regex meaning. In a JavaScript string passed to RegExp, a backslash also needs string-level escaping.',
          zh: '当标点具有正则语义时，需要转义。若通过 JavaScript 字符串传入 RegExp，还要处理字符串层面的反斜杠转义。',
          ja: '正規表現で意味を持つ記号はエスケープします。RegExp に JavaScript の文字列を渡す場合は、文字列側のバックスラッシュもエスケープします。',
        },
        examples: [],
      },
    ],
  },
  'basics-anchors': {
    introduction: {
      en: 'Anchors constrain positions without consuming characters. The multiline flag changes line boundaries, while word boundaries inspect adjacent character types.',
      zh: '锚点限制位置而不消耗字符。多行标志改变行边界，单词边界则检查相邻字符的类型。',
      ja: 'アンカーは文字を消費せず位置を制限します。複数行フラグは行境界を変え、単語境界は隣接する文字の種類を確認します。',
    },
    steps: [
      {
        body: {
          en: '^\\w+ without m starts only at the beginning of the whole input. g alone does not make it match every line.',
          zh: '^\\w+ 不带 m 时只能从整个输入开头开始。单独使用 g 不会让它匹配每一行。',
          ja: 'm のない ^\\w+ は入力全体の先頭だけに一致します。g だけでは各行の先頭になりません。',
        },
        examples: [
          {
            pattern: '^\\w+',
            flags: 'g',
            testText: 'hello world\nfoo bar\nbaz qux',
            matches: [
              {
                text: 'hello',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'With m, ^ can match after a line terminator. Combining g and m finds the first word on each line.',
          zh: 'm 使 ^ 也能匹配行终止字符之后的位置，结合 g 可提取每一行的首词。',
          ja: 'm により ^ は改行直後にも一致できます。g と併用すると各行の最初の単語を取得できます。',
        },
        examples: [
          {
            pattern: '^\\w+',
            flags: 'gm',
            testText: 'hello world\nfoo bar\nbaz qux',
            matches: [
              {
                text: 'hello',
              },
              {
                text: 'foo',
              },
              {
                text: 'baz',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '\\w+$ with m finds the last run of word characters at each line end. Trailing spaces would need separate treatment.',
          zh: '带 m 的 \\w+$ 查找每行末尾连续的单词字符；若行末有空格，需要另行处理。',
          ja: 'm 付きの \\w+$ は各行末の単語文字列を探します。末尾の空白は別途扱う必要があります。',
        },
        examples: [
          {
            pattern: '\\w+$',
            flags: 'gm',
            testText: 'hello world\nfoo bar\nbaz qux',
            matches: [
              {
                text: 'world',
              },
              {
                text: 'bar',
              },
              {
                text: 'qux',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '\\B requires a position that is not a word boundary. Two \\B assertions select cat surrounded by word characters, excluding the start of catalog.',
          zh: '\\B 要求当前位置不是单词边界。两侧使用 \\B 可选择两边都有单词字符的 cat，排除 catalog 开头的 cat。',
          ja: '\\B は単語境界ではない位置を要求します。両端に置くと両側が単語文字の cat を選び、catalog の先頭を除外します。',
        },
        examples: [
          {
            pattern: '\\Bcat\\B',
            flags: 'g',
            testText: 'the cat is in concatenation. catalog. a cat.',
            matches: [
              {
                text: 'cat',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'For whole-input validation, use start and end anchors without m, and decide explicitly whether line terminators are allowed in the input.',
          zh: '整串校验时不要开启 m，并明确输入是否允许行终止字符，再使用首尾锚点。',
          ja: '入力全体の検証では m を使わず、改行を許可するかを明確にして先頭と末尾を制限します。',
        },
        examples: [],
      },
    ],
  },
  'basics-quantifiers': {
    introduction: {
      en: 'Quantifiers repeat the token immediately before them. + requires one or more, ? allows zero or one, and * permits zero or more.',
      zh: '量词重复紧邻的前一项：+ 表示至少一次，? 表示零次或一次，* 表示零次或多次。',
      ja: '量指定子は直前の要素を繰り返します。+ は1回以上、? は0〜1回、* は0回以上です。',
    },
    steps: [
      {
        body: {
          en: '\\d+ keeps adjacent digits in one match. Spaces and letters terminate each run.',
          zh: '\\d+ 把相邻数字放在同一个匹配中，空格和字母会结束数字串。',
          ja: '\\d+ は連続した数字を1件にまとめます。空白や英字で数字列が終わります。',
        },
        examples: [
          {
            pattern: '\\d+',
            flags: 'g',
            testText: 'Order 2025 has 42 items.',
            matches: [
              {
                text: '2025',
              },
              {
                text: '42',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'In colou?r, only u is optional. The other letters are required, so color and colour both match.',
          zh: 'colou?r 中只有 u 可选，其余字母仍然必需，因此 color 与 colour 都能匹配。',
          ja: 'colou?r で省略できるのは u だけです。他の文字は必要なので color と colour の両方に一致します。',
        },
        examples: [
          {
            pattern: 'colou?r',
            flags: 'g',
            testText: 'color or colour',
            matches: [
              {
                text: 'color',
              },
              {
                text: 'colour',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'colou*r also accepts repeated u characters. The entire pattern still requires color, so it does not produce empty matches here.',
          zh: 'colou*r 还接受重复的 u。整个表达式仍要求 col 和 r，因此本例不会产生空匹配。',
          ja: 'colou*r は u の繰り返しも許可します。全体には col と r が必要なので、この例では空の一致は発生しません。',
        },
        examples: [
          {
            pattern: 'colou*r',
            flags: 'g',
            testText: 'color colour colouur',
            matches: [
              {
                text: 'color',
              },
              {
                text: 'colour',
              },
              {
                text: 'colouur',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Quantifiers apply to one preceding token. Use a group when a whole sequence must repeat; zero allowed repetitions can matter when the rest of a pattern is also optional.',
          zh: '量词作用于前一个元素。若需重复整个序列，应先分组；当表达式其余部分也可选时，零次重复可能产生空匹配。',
          ja: '量指定子の対象は直前の要素です。文字列全体の繰り返しにはグループを使います。他の部分も省略可能なら空の一致に注意が必要です。',
        },
        examples: [],
      },
    ],
  },
  'quantifiers-counted': {
    introduction: {
      en: 'Braces express exact, bounded and open-ended repetition counts. A count alone does not ensure that the entire number is matched.',
      zh: '花括号表达固定、有上下界和无上界的重复次数。仅有次数限制并不保证匹配整个数字。',
      ja: '波括弧は固定回数・範囲・下限のみの回数を表します。回数の指定だけでは数値全体の一致は保証されません。',
    },
    steps: [
      {
        body: {
          en: '\\d{3} consumes three digits, even at the start of a longer number. It finds 123 inside 1234 and 567 inside 56789.',
          zh: '\\d{3} 消耗三个数字，即使它们位于更长数字的开头。因此会从 1234 取出 123，从 56789 取出 567。',
          ja: '\\d{3} は長い数値の先頭からも3桁を取得します。1234 から123、56789 から567を取り出します。',
        },
        examples: [
          {
            pattern: '\\d{3}',
            flags: 'g',
            testText: 'Phone: 555-1234, code 56789, ext 78',
            matches: [
              {
                text: '555',
              },
              {
                text: '123',
              },
              {
                text: '567',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'A greedy bounded repetition takes up to five available digits. Some matches become longer, but 555 remains three digits because the next character is a hyphen.',
          zh: '贪婪的有界量词最多取五个可用数字。部分匹配变长，但 555 后面是短横线，因此仍为三位。',
          ja: '貪欲な範囲指定は可能なら5桁まで取ります。一部は長くなりますが、555 の次はハイフンなので3桁のままです。',
        },
        examples: [
          {
            pattern: '\\d{3,5}',
            flags: 'g',
            testText: 'Phone: 555-1234, code 56789, ext 78',
            matches: [
              {
                text: '555',
              },
              {
                text: '1234',
              },
              {
                text: '56789',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Removing the upper bound accepts every run of at least two digits, including 78. It does not limit the maximum length.',
          zh: '省略上界后，所有至少两位的数字串都可匹配，包括 78；此时没有最大长度限制。',
          ja: '上限を省略すると78を含む2桁以上の数字列に一致します。最大長の制限はありません。',
        },
        examples: [
          {
            pattern: '\\d{2,}',
            flags: 'g',
            testText: 'Phone: 555-1234, code 56789, ext 78',
            matches: [
              {
                text: '555',
              },
              {
                text: '1234',
              },
              {
                text: '56789',
              },
              {
                text: '78',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Counts and boundaries solve different problems. Add boundaries or anchors when the task requires a complete token rather than a substring.',
          zh: '次数与边界解决不同问题。需要完整字段而非子串时，应另加边界或锚点。',
          ja: '回数と境界は別の条件です。部分文字列ではなく完全な項目が必要なら、境界やアンカーも指定します。',
        },
        examples: [
          {
            pattern: '\\b\\d{3}\\b',
            flags: 'g',
            testText: 'Phone: 555-1234, code 56789, ext 78',
            matches: [
              {
                text: '555',
              },
            ],
          },
        ],
      },
    ],
  },
  'quantifiers-backtracking': {
    introduction: {
      en: 'Ambiguous nested repetitions can make failed matches expensive. Compare a successful input, a small failing input and a simpler equivalent pattern.',
      zh: '有歧义的嵌套重复可能让失败匹配代价很高。对照成功输入、小规模失败输入和更简单的等价模式，可以看出原因。',
      ja: '曖昧な繰り返しの入れ子は、失敗時の処理を重くする場合があります。成功例、小さな失敗例、単純化したパターンを比較します。',
    },
    steps: [
      {
        body: {
          en: '(a+)+b succeeds when a trailing b exists. The outer group allows many ways to partition the same run of a characters.',
          zh: '尾部存在 b 时，(a+)+b 可以成功；但外层重复允许把同一串 a 以多种方式划分。',
          ja: '末尾に b があれば (a+)+b は成功します。ただし外側の繰り返しにより、同じ a の列を多くの方法で分割できます。',
        },
        examples: [
          {
            pattern: '(a+)+b',
            flags: 'g',
            testText: 'aaaaab',
            matches: [
              {
                text: 'aaaaab',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Without b, a backtracking engine may explore many partitions before failing. The short example is deliberately bounded; runtime depends on engine optimizations and input length, so a fixed length is not a universal safety threshold.',
          zh: '没有 b 时，回溯引擎可能反复尝试不同划分才宣告失败。示例刻意保持很短；耗时取决于引擎优化与输入长度，某个固定长度不是通用安全阈值。',
          ja: 'b がないと回り道を多数試してから失敗する場合があります。例は意図的に短くしています。所要時間は実装と長さによるため、特定の文字数を万能な安全基準にはできません。',
        },
        examples: [
          {
            pattern: '(a+)+b',
            flags: 'g',
            testText: 'aaaaaa',
            matches: [],
          },
        ],
      },
      {
        body: {
          en: 'a+b removes the nested partitioning while recognizing the same sequences of a followed by b. This removes this exponential ambiguity, not every possible performance cost in unanchored searches.',
          zh: 'a+b 保留“若干 a 后接 b”的含义并消除嵌套划分。它消除了此处的指数级歧义，但不意味着所有未锚定搜索都没有额外代价。',
          ja: 'a+b は a の列に b が続く条件を保ちながら、入れ子の分割を除きます。この指数的な曖昧さを除くもので、非固定位置の検索コスト全般がなくなるとは限りません。',
        },
        examples: [
          {
            pattern: 'a+b',
            flags: 'g',
            testText: 'aaaaab aaaaaa',
            matches: [
              {
                text: 'aaaaab',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Avoid overlapping alternatives and nested repetitions when a simpler expression has the same meaning. Atomic groups and possessive quantifiers depend on the execution engine; they are not ordinary JavaScript regex syntax.',
          zh: '能用简单结构表达时，应避免重叠分支与嵌套重复。原子组和占有量词取决于执行引擎，不能当作普通 JavaScript 正则语法直接使用。',
          ja: '同じ意味の単純な式があるなら、重なる選択肢や入れ子を避けます。アトミックグループと所有的量指定子は実行エンジンに依存し、通常の JavaScript 構文としては使えません。',
        },
        examples: [],
      },
    ],
  },
  'groups-alternation': {
    introduction: {
      en: 'Alternation selects one branch. Grouping controls which tokens belong to that choice and which suffixes or anchors apply to all branches.',
      zh: '分支选择让多个模式择一匹配。分组控制哪些字符参与选择，以及哪些后缀或锚点对全部分支生效。',
      ja: '選択は複数の分岐から1つを選びます。グループ化で選択の範囲を決め、接尾辞やアンカーを全分岐に適用できます。',
    },
    steps: [
      {
        body: {
          en: 'cat|dog|bird searches for any of the three sequences. Branches are tried in order at each candidate position.',
          zh: 'cat|dog|bird 搜索三个序列中的任意一个。在每个候选位置，引擎按分支顺序尝试。',
          ja: 'cat|dog|bird は3つの文字列のいずれかを探します。各候補位置で分岐を左から試します。',
        },
        examples: [
          {
            pattern: 'cat|dog|bird',
            flags: 'g',
            testText: 'I have a cat, a dog, and a bird.',
            matches: [
              {
                text: 'cat',
              },
              {
                text: 'dog',
              },
              {
                text: 'bird',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '(cat|dog)s? applies the optional s to either animal. Without the group, cat|dogs? makes only the dog branch optionally plural.',
          zh: '(cat|dog)s? 让两个动物名都可以带 s。没有括号的 cat|dogs? 只让 dog 分支可带复数后缀。',
          ja: '(cat|dog)s? はどちらにも任意の s を適用します。cat|dogs? では dog 側だけが複数形になります。',
        },
        examples: [
          {
            pattern: '(cat|dog)s?',
            flags: 'g',
            testText: 'I love cats and dogs equally.',
            matches: [
              {
                text: 'cats',
                groups: ['cat'],
              },
              {
                text: 'dogs',
                groups: ['dog'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'For whole-string alternatives use ^(?:cat|dog)$, not ^cat|dog$. The latter anchors the two branches at different ends.',
          zh: '整串择一匹配应写 ^(?:cat|dog)$，而非 ^cat|dog$；后者两个分支分别只约束一端。',
          ja: '文字列全体を選択する場合は ^(?:cat|dog)$ を使います。^cat|dog$ は各分岐の片側しか固定しません。',
        },
        examples: [
          {
            pattern: '^(?:cat|dog)$',
            flags: 'g',
            testText: 'catnap',
            matches: [],
          },
        ],
      },
    ],
  },
  'groups-backreferences': {
    introduction: {
      en: 'A backreference matches the text captured earlier in the same match. It can detect repeated words or enforce matching quotation marks.',
      zh: '反向引用匹配本次匹配中先前捕获到的实际文本，可用于发现重复单词或要求引号配对。',
      ja: '後方参照は同じ一致の中で先にキャプチャした文字列を要求します。単語の重複や引用符の対応に利用できます。',
    },
    steps: [
      {
        body: {
          en: '(\\w+) \\1 captures a word-character run and then requires the same text after one space. For general text, add boundaries and choose whitespace rules deliberately.',
          zh: '(\\w+) \\1 先捕获单词字符，再要求一个空格后出现相同内容。用于一般文本时，应另行考虑边界与空白规则。',
          ja: '(\\w+) \\1 は単語文字列を保存し、1個の空白の後に同じ内容を要求します。一般的な文章には境界や空白の条件も検討します。',
        },
        examples: [
          {
            pattern: '(\\w+) \\1',
            flags: 'g',
            testText: 'the the cat sat sat down.',
            matches: [
              {
                text: 'the the',
                groups: ['the'],
              },
              {
                text: 'sat sat',
                groups: ['sat'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The first group captures a quote; .*? permits an empty or nonempty middle; \\1 requires the same closing quote. Unlike .+?, .*? accepts empty quotes. Escaped quotes need a more specific grammar.',
          zh: '第一个组捕获引号，.*? 接受空或非空的中间内容，\\1 要求同一种结束引号。与 .+? 不同，.*? 可接受空引号；带转义的引号还需要更具体的规则。',
          ja: '最初のグループが引用符を保存し、.*? が空を含む中身を許可し、\\1 が同じ終端を要求します。.+? と異なり空の引用符にも一致します。エスケープ付き引用符には別の規則が必要です。',
        },
        examples: [
          {
            pattern: '(["\'])(.*?)\\1',
            flags: 'g',
            testText: 'He said "hi" and \'bye\' and "".',
            matches: [
              {
                text: '"hi"',
                groups: ['"', 'hi'],
              },
              {
                text: "'bye'",
                groups: ["'", 'bye'],
              },
              {
                text: '""',
                groups: ['"', ''],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'In JavaScript replacement templates, $1 refers to a numbered group; \\1 is pattern syntax. Named groups use $<name> in replacements and \\k<name> inside a pattern.',
          zh: 'JavaScript 替换模板中用 $1 引用编号组；\\1 属于模式语法。命名组替换用 $<name>，模式内部引用用 \\k<name>。',
          ja: 'JavaScript の置換テンプレートでは番号付きグループを $1 で参照します。\\1 はパターン側です。名前付きは置換で $<name>、パターンで \\k<name> を使います。',
        },
        examples: [],
      },
    ],
  },
  'groups-named-and-noncapturing': {
    introduction: {
      en: 'Named groups label extracted fields. Non-capturing groups organize a pattern without adding a capture index.',
      zh: '命名组给提取字段加上名称，非捕获组则组织模式结构而不占用捕获编号。',
      ja: '名前付きグループは抽出項目に名前を付けます。非キャプチャグループは番号を追加せずパターンをまとめます。',
    },
    steps: [
      {
        body: {
          en: 'The year, month and day groups preserve the three date fields. This checks a digit layout, not whether a date exists in the calendar.',
          zh: 'year、month、day 分别保存日期的三个字段。这里识别数字布局，不判断日期在日历上是否存在。',
          ja: 'year・month・day が各項目を保存します。数字の配置を確認するもので、実在する日付かは判定しません。',
        },
        examples: [
          {
            pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})',
            flags: 'g',
            testText: 'Born 1990-05-15. Joined 2019-03-22.',
            matches: [
              {
                text: '1990-05-15',
                groups: ['1990', '05', '15'],
              },
              {
                text: '2019-03-22',
                groups: ['2019', '03', '22'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '(?:Mrs|Mr|Ms) groups title alternatives but produces no numbered captures. The period is escaped so it cannot match an arbitrary character.',
          zh: '(?:Mrs|Mr|Ms) 把称谓分支组合起来但不产生编号捕获。点号需要转义，避免匹配任意字符。',
          ja: '(?:Mrs|Mr|Ms) は敬称をまとめますが、番号付きキャプチャを作りません。句点は任意の文字にならないようエスケープします。',
        },
        examples: [
          {
            pattern: '(?:Mrs|Mr|Ms)\\. \\w+',
            flags: 'g',
            testText: 'Hi Mr. Smith, Mrs. Jones, Ms. Doe today.',
            matches: [
              {
                text: 'Mr. Smith',
                groups: [],
              },
              {
                text: 'Mrs. Jones',
                groups: [],
              },
              {
                text: 'Ms. Doe',
                groups: [],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Choose captures for data you need to read later. Use non-capturing groups for structure so adding a branch does not renumber unrelated fields.',
          zh: '需要后续读取的数据才使用捕获组；单纯控制结构时用非捕获组，避免新增分支导致其他字段编号变化。',
          ja: '後で読むデータにはキャプチャを使い、構造だけなら非キャプチャを使います。分岐を追加しても他の項目の番号がずれにくくなります。',
        },
        examples: [],
      },
    ],
  },
  'lookaround-lookahead': {
    introduction: {
      en: 'Positive lookahead requires a following pattern without adding it to the matched text. This separates the condition from the value you extract.',
      zh: '正向先行断言要求后面满足某个模式，但不会将该部分加入匹配文本，从而分离筛选条件与提取内容。',
      ja: '肯定先読みは後続の条件を確認し、その部分を一致には含めません。選ぶ条件と抽出する値を分離できます。',
    },
    steps: [
      {
        body: {
          en: '\\d+(?= dollars) returns the digits only. The space and word dollars must follow exactly, but are inspected without being consumed.',
          zh: '\\d+(?= dollars) 只返回数字。后面必须紧接一个空格和 dollars，但这些字符仅被检查而不被消耗。',
          ja: '\\d+(?= dollars) は数字だけを返します。直後に空白と dollars が必要ですが、それらは確認するだけで消費しません。',
        },
        examples: [
          {
            pattern: '\\d+(?= dollars)',
            flags: 'g',
            testText: '5 dollars and 10 euros and 50 dollars',
            matches: [
              {
                text: '5',
              },
              {
                text: '50',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The assertion is zero-width; the digits are still consumed normally. Multiple lookaheads can check independent conditions, as in the password-conditions challenge.',
          zh: '断言是零宽的，数字部分仍正常消耗字符。多个先行断言可以检查独立条件，例如密码条件检查挑战。',
          ja: 'アサーションは幅ゼロですが、数字部分は通常どおり消費します。パスワード条件の練習のように、複数の先読みで独立した条件を確認できます。',
        },
        examples: [],
      },
    ],
  },
  'lookaround-negative-lookahead': {
    introduction: {
      en: 'Negative lookahead succeeds when a following pattern fails. A quantifier before it may still backtrack, so partial numeric matches need special care.',
      zh: '否定先行断言在后续模式不匹配时成功。它之前的量词仍可能回溯，因此要注意数字被部分截取的情况。',
      ja: '否定先読みは後続パターンが失敗したときに成功します。前の量指定子は回り道を試せるため、数字の部分一致に注意が必要です。',
    },
    steps: [
      {
        body: {
          en: 'For the first input, the assertion rejects the one-digit dollar amount and keeps the euro and yen amounts. This example alone does not prove it works for longer amounts.',
          zh: '第一个输入中，断言排除了美元金额，保留欧元和日元金额。但这个样例不能证明它也能正确处理多位美元金额。',
          ja: '最初の入力ではドルを除外し、ユーロと円の数値を残します。この例だけで複数桁の金額にも正しいとは判断できません。',
        },
        examples: [
          {
            pattern: '\\d+(?! dollars)',
            flags: 'g',
            testText: '5 dollars and 10 euros and 7 yen',
            matches: [
              {
                text: '10',
              },
              {
                text: '7',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'On 50 dollars, \\d+ can give back the 0, letting the assertion pass after 5. Word boundaries on both sides prevent that digit slicing in these space-separated examples.',
          zh: '对于 50 dollars，\\d+ 可退回 0，让断言在 5 后通过。两侧单词边界可以阻止本组空格分隔样例中的这种数字截断。',
          ja: '50 dollars では \\d+ が 0 を戻すことで、5 の後の判定が成功します。この空白区切りの例では両側の単語境界で分割を防げます。',
        },
        examples: [
          {
            pattern: '\\d+(?! dollars)',
            flags: 'g',
            testText: '50 dollars',
            matches: [
              {
                text: '5',
              },
            ],
          },
          {
            pattern: '\\b\\d+\\b(?! dollars)',
            flags: 'g',
            testText: '50 dollars and 10 euros',
            matches: [
              {
                text: '10',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'An assertion checks one position, not an entire semantic token. Use explicit token boundaries when the result must be a complete number.',
          zh: '断言检查的是一个位置，而非完整语义字段。若结果必须是完整数字，应明确添加字段边界。',
          ja: 'アサーションが確認するのは位置であり、意味上の項目全体ではありません。完全な数値が必要なら境界を明示します。',
        },
        examples: [],
      },
    ],
  },
  'lookaround-lookbehind': {
    introduction: {
      en: 'Lookbehind inspects the text immediately before a position. Positive and negative forms include neither the prefix nor any other assertion text in the match.',
      zh: '后行断言检查当前位置之前的文本。无论肯定还是否定形式，匹配结果都不包含断言检查的前缀。',
      ja: '後読みは位置の直前を確認します。肯定・否定のどちらも、確認した接頭辞を一致に含めません。',
    },
    steps: [
      {
        body: {
          en: '(?<=\\$)\\d+ selects digits immediately after a literal dollar sign. The dollar sign is checked but is not returned.',
          zh: '(?<=\\$)\\d+ 选择紧邻字面美元符号之后的数字，美元符号被检查但不会返回。',
          ja: '(?<=\\$)\\d+ はドル記号の直後の数字を選びます。記号は確認されますが結果には含まれません。',
        },
        examples: [
          {
            pattern: '(?<=\\$)\\d+',
            flags: 'g',
            testText: 'Code A1, Item $5, Floor 7',
            matches: [
              {
                text: '5',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: '(?<!\\$)\\d+ rejects a position immediately after $. For multi-digit amounts it can restart inside the number: $50 can yield 0. (?<![\\d$])\\d+ prevents that specific restart.',
          zh: '(?<!\\$)\\d+ 排除紧接 $ 的位置，但多位金额可能从内部重新开始：$50 会得到 0。(?<![\\d$])\\d+ 可以阻止这种重新起始。',
          ja: '(?<!\\$)\\d+ は $ の直後を拒否しますが、数値の途中から再開でき、$50 から0を取ることがあります。(?<![\\d$])\\d+ でその再開を防げます。',
        },
        examples: [
          {
            pattern: '(?<!\\$)\\d+',
            flags: 'g',
            testText: 'Code A1, Item $5, Floor 7',
            matches: [
              {
                text: '1',
              },
              {
                text: '7',
              },
            ],
          },
          {
            pattern: '(?<!\\$)\\d+',
            flags: 'g',
            testText: '$50',
            matches: [
              {
                text: '0',
              },
            ],
          },
          {
            pattern: '(?<![\\d$])\\d+',
            flags: 'g',
            testText: '$50 and 7',
            matches: [
              {
                text: '7',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'JavaScript supports variable-length lookbehind. Python re requires fixed width; PCRE2 support depends on version and bounded length. Java support also depends on runtime and pattern. The example here runs in JavaScript; verify other engines in their target runtime.',
          zh: 'JavaScript 支持变长后行断言；Python re 要求固定宽度；PCRE2 取决于版本和长度上界；Java 也与运行时版本及模式有关。本例按 JavaScript 执行，其他引擎需要在目标运行时核验。',
          ja: 'JavaScript は可変長の後読みに対応します。Python re は固定長、PCRE2 はバージョンと長さの上限、Java は実行環境とパターンに依存します。この例は JavaScript で実行し、他のエンジンは対象環境で確認してください。',
        },
        examples: [
          {
            pattern: '(?<=foo|barbaz)\\w+',
            flags: 'g',
            testText: 'foobar barbazquux',
            matches: [
              {
                text: 'bar',
              },
              {
                text: 'quux',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Choose lookahead for a following condition and lookbehind for a preceding condition. Match only the value you need, and make boundaries explicit before relying on a negative assertion.',
          zh: '后续条件用先行断言，前置条件用后行断言。只提取需要的值，并在使用否定断言前明确边界。',
          ja: '後ろの条件には先読み、前の条件には後読みを選びます。必要な値だけを取り、否定を使う前に境界を明確にします。',
        },
        examples: [],
      },
    ],
  },
  'practical-url': {
    introduction: {
      en: 'Extract the HTTP and HTTPS links in prose while keeping domain dots and excluding the sample’s closing punctuation. These are limited teaching patterns, not complete URL validators.',
      zh: '提取段落中的 HTTP/HTTPS 链接时，要保留域名点号并排除示例中的句尾标点。这些是限定格式的教学表达式，不是完整 URL 校验器。',
      ja: '文章中の HTTP/HTTPS リンクを、ドメインのドットを保ち、例の末尾記号を除いて抽出します。限定形式の教材であり、完全な URL 検証ではありません。',
    },
    steps: [
      {
        body: {
          en: 'https?://\\S+ recognizes the scheme but takes every non-whitespace character afterwards. It includes the final period and closing parenthesis in this sample, making it a deliberately flawed starting point.',
          zh: 'https?://\\S+ 能识别协议，却会接受后续所有非空白字符。本例会连句尾点号与右括号一起抓走，这是有意展示的初始缺陷。',
          ja: 'https?://\\S+ はスキームを認識しますが、その後の空白以外をすべて取ります。例の句点や閉じ括弧まで含む、意図的に不完全な開始形です。',
        },
        examples: [
          {
            pattern: 'https?://\\S+',
            flags: 'g',
            testText:
              'Docs: https://example.com/api?token=abc.\nOld site (http://legacy.example.org)\nVisit https://blog.example.io/posts/2024-05-09 today!\nNo protocol here: example.com is not enough.',
            matches: [
              {
                text: 'https://example.com/api?token=abc.',
              },
              {
                text: 'http://legacy.example.org)',
              },
              {
                text: 'https://blog.example.io/posts/2024-05-09',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The domain is a sequence of ASCII labels separated by literal dots. The optional path may contain dots, but its final character is restricted here to a word character, slash or #. That drops sentence punctuation for this sample without truncating the domain. It does not support every legitimate URL ending.',
          zh: '域名由 ASCII 标签和字面点号组成。可选路径可以包含点号，但本例将末尾限定为单词字符、斜杠或 #，从而去掉句尾标点而不截断域名。它不覆盖合法 URL 的所有末尾形式。',
          ja: 'ドメインは ASCII ラベルをドットで連結します。任意のパス内のドットは許可し、末尾は単語文字・スラッシュ・# に限定します。例の句読点を除きつつドメインを保ちますが、正当な URL の全末尾形式は扱いません。',
        },
        examples: [
          {
            pattern: 'https?://[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+(?:/(?:[^\\s),;]*[\\w/#])?)?',
            flags: 'g',
            testText:
              'Docs: https://example.com/api?token=abc.\nOld site (http://legacy.example.org)\nVisit https://blog.example.io/posts/2024-05-09 today!\nNo protocol here: example.com is not enough.',
            matches: [
              {
                text: 'https://example.com/api?token=abc',
              },
              {
                text: 'http://legacy.example.org',
              },
              {
                text: 'https://blog.example.io/posts/2024-05-09',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Three capturing groups return the scheme, host and path. The absent path is captured as an empty string, and the parenthesis after the legacy host belongs to the surrounding prose, not the host.',
          zh: '三个捕获组返回协议、主机和路径。没有路径时捕获空字符串；legacy 主机之后的右括号属于外层文本，不属于主机名。',
          ja: '3つのグループでスキーム・ホスト・パスを取得します。パスがなければ空文字列になり、legacy の後の括弧は周囲の文章なのでホストに含みません。',
        },
        examples: [
          {
            pattern:
              '(https?)://([A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+)((?:/(?:[^\\s),;]*[\\w/#])?)?)',
            flags: 'g',
            testText:
              'Docs: https://example.com/api?token=abc.\nOld site (http://legacy.example.org)\nVisit https://blog.example.io/posts/2024-05-09 today!\nNo protocol here: example.com is not enough.',
            matches: [
              {
                text: 'https://example.com/api?token=abc',
                groups: ['https', 'example.com', '/api?token=abc'],
              },
              {
                text: 'http://legacy.example.org',
                groups: ['http', 'legacy.example.org', ''],
              },
              {
                text: 'https://blog.example.io/posts/2024-05-09',
                groups: ['https', 'blog.example.io', '/posts/2024-05-09'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Extraction boundaries are a choice about the input format. This example excludes ports, credentials, IPv6 and host-only queries. For general URL processing, first identify a candidate and parse it with a URL parser rather than extending this teaching pattern indefinitely.',
          zh: '提取边界取决于输入格式。本例不覆盖端口、凭证、IPv6 和主机后直接接查询参数的形式。通用 URL 处理应先识别候选，再使用 URL 解析器，不应无限扩展教学表达式。',
          ja: '抽出境界は入力形式によって決めます。この例はポート・認証情報・IPv6・ホスト直後のクエリーを扱いません。一般的な処理では候補を識別して URL パーサーに渡します。',
        },
        examples: [],
      },
    ],
  },
  'practical-log': {
    introduction: {
      en: 'A fixed log format can be decomposed with line anchors and named groups. Keep the format assumptions separate from timestamp validity and general log parsing.',
      zh: '固定日志格式可以用行锚点和命名组拆解，但格式假设、时间戳合法性和通用日志解析是不同问题。',
      ja: '固定形式のログは行アンカーと名前付きグループで分解できます。形式の前提と日時の妥当性、一般的なログ解析は分けて考えます。',
    },
    steps: [
      {
        body: {
          en: '^\\[ with gm finds the opening bracket of each line. The example below has two lines; the longer practice sample has six.',
          zh: '带 gm 的 ^\\[ 查找每行的左方括号。下面的阅读示例是两行，练习中的完整样例是六行。',
          ja: 'gm 付きの ^\\[ は各行の開き角括弧を探します。以下の例は2行で、練習の長い入力は6行です。',
        },
        examples: [
          {
            pattern: '^\\[',
            flags: 'gm',
            testText: '[2025-05-09 10:00:00] INFO ready\n[2025-05-09 10:00:01] ERROR failed',
            matches: [
              {
                text: '[',
              },
              {
                text: '[',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The timestamp class accepts digits, hyphens, spaces and colons. It extracts the bracketed shape without validating calendar ranges.',
          zh: '时间戳字符类接受数字、短横线、空格与冒号，仅提取括号中的格式，不验证日历范围。',
          ja: '日時のクラスは数字・ハイフン・空白・コロンを許可します。括弧内の形を抽出するだけで、暦の範囲は検証しません。',
        },
        examples: [
          {
            pattern: '^\\[([\\d\\- :]+)\\]',
            flags: 'gm',
            testText: '[2025-05-09 10:00:00] INFO ready\n[2025-05-09 10:00:01] ERROR failed',
            matches: [
              {
                text: '[2025-05-09 10:00:00]',
                groups: ['2025-05-09 10:00:00'],
              },
              {
                text: '[2025-05-09 10:00:01]',
                groups: ['2025-05-09 10:00:01'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Named groups ts, level and msg identify the output fields. The space after the timestamp is literal; the whitespace between level and message is variable. This pattern assumes the declared one-line format.',
          zh: 'ts、level、msg 标记输出字段。时间戳之后是字面空格，级别与消息之间允许多个空白。本式假设输入符合声明的单行日志布局。',
          ja: 'ts・level・msg が出力項目を示します。日時の後は1個の空白、レベルと本文の間は可変の空白です。宣言した1行形式を前提とします。',
        },
        examples: [
          {
            pattern: '^\\[(?<ts>[\\d\\- :]+)\\] (?<level>\\w+)\\s+(?<msg>.*)$',
            flags: 'gm',
            testText: '[2025-05-09 10:00:00] INFO ready\n[2025-05-09 10:00:01] ERROR failed',
            matches: [
              {
                text: '[2025-05-09 10:00:00] INFO ready',
                groups: ['2025-05-09 10:00:00', 'INFO', 'ready'],
              },
              {
                text: '[2025-05-09 10:00:01] ERROR failed',
                groups: ['2025-05-09 10:00:01', 'ERROR', 'failed'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'A lookahead requires ERROR but excludes it from the match. The returned text still includes the timestamp brackets and the space before the assertion.',
          zh: '先行断言要求 ERROR 存在，但不将其加入匹配。返回值仍然包含时间戳的方括号及断言前的那个空格。',
          ja: '先読みは ERROR を要求しますが一致に含めません。結果には日時の角括弧と、判定の直前の空白が含まれます。',
        },
        examples: [
          {
            pattern: '^\\[([\\d\\- :]+)\\] (?=ERROR)',
            flags: 'gm',
            testText: '[2025-05-09 10:00:00] INFO ready\n[2025-05-09 10:00:01] ERROR failed',
            matches: [
              {
                text: '[2025-05-09 10:00:01] ',
                groups: ['2025-05-09 10:00:01'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Anchors select lines, groups extract fields, and assertions filter without extending the match. A different log format needs different tests; a successful sample is not a universal parser.',
          zh: '锚点选行、捕获组提取字段、断言负责不扩展结果的筛选。日志格式不同就需要不同测试，通过一个样例不等于通用解析器。',
          ja: 'アンカーは行の選択、グループは項目の取得、アサーションは一致を伸ばさない絞り込みです。異なるログ形式には別のテストが必要です。',
        },
        examples: [],
      },
    ],
  },
  'practical-markdown-link': {
    introduction: {
      en: 'A constrained Markdown-link example illustrates why lazy matching may cross delimiters. Restrict the allowed characters when a delimiter must never occur inside a field.',
      zh: '简化的 Markdown 链接可以展示懒惰匹配为何仍会越过分隔符。若字段内部绝不允许某个分隔符，应限制允许的字符。',
      ja: '限定した Markdown リンクで、最短一致でも区切りを越える理由を確認します。項目内に区切りを許さないなら文字集合を制限します。',
    },
    steps: [
      {
        body: {
          en: 'Lazy quantifiers try short content first, but expand if the remaining pattern fails. The malformed second candidate demonstrates that short-first is not a delimiter guarantee.',
          zh: '懒惰量词先尝试短内容，但后续模式失败时会扩展。第二个不规范候选说明“优先短匹配”并不保证遵守分隔符。',
          ja: '最短一致は短い内容から試しますが、残りが失敗すると伸びます。2つ目の不正な候補は、短い順でも区切りを守る保証がないことを示します。',
        },
        examples: [
          {
            pattern: '\\[(.+?)\\]\\((.+?)\\)',
            flags: 'g',
            testText: '[docs](https://example.com) and [bad text]still here](url)',
            matches: [
              {
                text: '[docs](https://example.com)',
              },
              {
                text: '[bad text]still here](url)',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The second text capture includes a closing bracket because the first bracket is not followed by an opening parenthesis. The engine extends the lazy capture to a later bracket.',
          zh: '第二个文本捕获含有右方括号，因为最早的右方括号之后没有左圆括号，引擎只好将懒惰捕获扩展到更后的括号。',
          ja: '最初の閉じ角括弧の後に開き丸括弧がないため、2件目のテキストは閉じ角括弧を含んだまま後ろまで伸びます。',
        },
        examples: [
          {
            pattern: '\\[(.+?)\\]\\((.+?)\\)',
            flags: 'g',
            testText: '[docs](https://example.com) and [bad text]still here](url)',
            matches: [
              {
                text: '[docs](https://example.com)',
                groups: ['docs', 'https://example.com'],
              },
              {
                text: '[bad text]still here](url)',
                groups: ['bad text]still here', 'url'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Negated classes prevent the captures from containing their respective closing delimiters. This rejects the malformed candidate in the sample and returns the intended link.',
          zh: '取反字符类禁止捕获内容包含相应的结束分隔符，因此排除样例中的错误候选，返回预期链接。',
          ja: '否定クラスは各キャプチャに終端の区切りを含ませません。例の不正な候補を除き、意図したリンクを返します。',
        },
        examples: [
          {
            pattern: '\\[([^\\]]+)\\]\\(([^)]+)\\)',
            flags: 'g',
            testText: '[docs](https://example.com) and [bad text]still here](url)',
            matches: [
              {
                text: '[docs](https://example.com)',
                groups: ['docs', 'https://example.com'],
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'This is a simplified syntax exercise. Nested brackets, escaped delimiters, link titles and parentheses inside destinations require additional grammar; use a Markdown parser for complete documents.',
          zh: '这是简化语法练习。嵌套括号、转义分隔符、链接标题和目标内部的圆括号需要额外语法；处理完整文档应使用 Markdown 解析器。',
          ja: 'これは簡略化した構文の練習です。入れ子・エスケープ・タイトル・リンク先内部の丸括弧には追加の文法が必要で、文書全体には Markdown パーサーを使います。',
        },
        examples: [],
      },
    ],
  },
  'practical-csv': {
    introduction: {
      en: 'Quoted CSV fields can contain commas and doubled quotes. Compare exact outputs at each stage instead of trusting only a match count.',
      zh: '带引号的 CSV 字段可以包含逗号和双写引号。逐步比较完整输出，比仅查看匹配数量更可靠。',
      ja: '引用符付き CSV の項目にはカンマや二重引用符を含められます。件数だけでなく各段階の一致全体を比較します。',
    },
    steps: [
      {
        body: {
          en: '[^,]+ treats every comma as a delimiter. The sample therefore produces six matches, splitting the quoted location into two pieces.',
          zh: '[^,]+ 把每个逗号都当作分隔符，因此样例产生六个匹配，将带引号的地点拆成两段。',
          ja: '[^,]+ はすべてのカンマを区切りとみなします。この例は6件になり、引用符付きの地名を2つに分けます。',
        },
        examples: [
          {
            pattern: '[^,]+',
            flags: 'g',
            testText: 'alice,42,"Wonderland, NJ",engineer,"says ""hi"""',
            matches: [
              {
                text: 'alice',
              },
              {
                text: '42',
              },
              {
                text: '"Wonderland',
              },
              {
                text: ' NJ"',
              },
              {
                text: 'engineer',
              },
              {
                text: '"says ""hi"""',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'There are five logical fields, not six. The quoted comma belongs to Wonderland, NJ. A quoted-field alternative must be considered before the plain-field fallback.',
          zh: '逻辑上共有五个字段，而不是六个。引号内的逗号属于 Wonderland, NJ，应优先识别带引号字段，再尝试普通字段。',
          ja: '論理的な項目は6個ではなく5個です。引用符内のカンマは地名に属するため、通常項目より先に引用符付き項目を認識します。',
        },
        examples: [
          {
            pattern: '[^,]+',
            flags: 'g',
            testText: 'alice,42,"Wonderland, NJ",engineer,"says ""hi"""',
            matches: [
              {
                text: 'alice',
              },
              {
                text: '42',
              },
              {
                text: '"Wonderland',
              },
              {
                text: ' NJ"',
              },
              {
                text: 'engineer',
              },
              {
                text: '"says ""hi"""',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The quoted branch keeps Wonderland, NJ together, but stops at each quote in the final field. That final field is split into three, so this intermediate pattern produces seven matches.',
          zh: '引号分支保留了完整地点，但最后一个字段中的每个引号仍会让它停止。该字段被切成三段，因此这个中间版本产生七个匹配。',
          ja: '引用符の分岐は地名をまとめますが、最後の項目は引用符ごとに止まって3分割されます。この中間形では7件になります。',
        },
        examples: [
          {
            pattern: '"[^"]*"|[^,]+',
            flags: 'g',
            testText: 'alice,42,"Wonderland, NJ",engineer,"says ""hi"""',
            matches: [
              {
                text: 'alice',
              },
              {
                text: '42',
              },
              {
                text: '"Wonderland, NJ"',
              },
              {
                text: 'engineer',
              },
              {
                text: '"says "',
              },
              {
                text: '"hi"',
              },
              {
                text: '""',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'Inside quoted content, allow either a non-quote character or a doubled quote. The result is five complete field substrings. Quotes remain in the output; decoding CSV values is a separate step.',
          zh: '在引号内容中，允许非引号字符或双写引号，便能得到五个完整字段子串。输出仍保留引号，解码 CSV 值是另一步操作。',
          ja: '引用符の内部では引用符以外か二重引用符を許可します。結果は完全な5項目になりますが、引用符を含む文字列なので値への復号は別処理です。',
        },
        examples: [
          {
            pattern: '"(?:[^"]|"")*"|[^,]+',
            flags: 'g',
            testText: 'alice,42,"Wonderland, NJ",engineer,"says ""hi"""',
            matches: [
              {
                text: 'alice',
              },
              {
                text: '42',
              },
              {
                text: '"Wonderland, NJ"',
              },
              {
                text: 'engineer',
              },
              {
                text: '"says ""hi"""',
              },
            ],
          },
        ],
      },
      {
        body: {
          en: 'The pattern is useful for this controlled extraction, not full CSV parsing. Empty fields, record boundaries, malformed quotes and other dialect details need a CSV parser.',
          zh: '本式适合这个受控抽取示例，而非完整 CSV 解析。空字段、记录边界、错误引号和方言差异需要专门 CSV 解析器。',
          ja: 'この式は限定した抽出例向けで、完全な CSV 解析ではありません。空項目・レコード境界・不正な引用符・形式の違いには CSV パーサーが必要です。',
        },
        examples: [],
      },
    ],
  },
};
export function addStandaloneReading(lesson: Lesson, locale?: Locale): Lesson {
  const guide = guides[lesson.id];
  if (!guide) return lesson;
  if (guide.steps.length !== lesson.steps.length)
    throw new Error(`Reading steps out of sync: ${lesson.id}`);
  return {
    ...lesson,
    reading: {
      introduction: pickLocale(guide.introduction, locale),
      references: [
        {
          title: 'MDN: JavaScript regular expressions',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions',
        },
      ],
    },
    steps: lesson.steps.map((step, i) => ({
      ...step,
      reading: {
        title: guide.steps[i].title ? pickLocale(guide.steps[i].title!, locale) : step.title,
        body: pickLocale(guide.steps[i].body, locale),
        examples: guide.steps[i].examples,
      },
    })),
  };
}

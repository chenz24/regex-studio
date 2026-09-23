import type { Locale } from '@/paraglide/runtime';
import type { Challenge } from './types';
import { pickLocale } from '../tutorial/i18n';

export function getChallenges(locale?: Locale): Challenge[] {
  const TEXTS = pickLocale(
    {
      en: {
        c1_title: 'Find emails in text',
        c1_summary: 'Extract every email address from a paragraph.',
        c1_description:
          '**Goal**: extract every complete email-like address in the input, in order. The tests check both the number and full text of the matches. Use `g`. This exercise covers ASCII local parts and dot-separated domains, including subdomains; it is not complete email validation.',

        c1_cases: [
          'Two emails in a paragraph',
          'Plus alias / subdomain',
          'No email at all',
          'Missing TLD',
          'Just an @ sign',
        ],
        c1_hints: [
          'Use \\b boundaries and g for all matches.',
          'Local part [\\w.+-]+; repeat domain labels with (?:[\\w-]+\\.)+ before the final [a-zA-Z]{2,}.',
        ],

        c1_explanation:
          'Repeat the domain-label-and-dot group so subdomains remain part of the full address. Compare every complete match with the expected output.',

        c2_title: 'HTTPS URL format (ASCII domains)',

        c2_summary:
          'Check a limited HTTPS format with an ASCII domain, optional port, path, query and fragment.',

        c2_description:
          '**Goal**: match the whole string using `^...$`. This exercise accepts lowercase `https://`, ASCII domain labels without leading/trailing hyphens, a letter-only suffix of at least two letters, an optional 1–5 digit port, and an optional suffix starting with `/`, `?` or `#` without whitespace. It does not check port ranges, DNS existence, IPv6, credentials or every URL syntax rule. Use a URL parser for general URL handling.',

        c2_cases: [
          'Minimal https URL',
          'Subdomain + path + query',
          'http should fail',
          'ftp should fail',
          'https with no host',
          'Bare host',
        ],
        c2_hints: [
          'Start with ^https:\\/\\/.',
          'Repeat domain labels ending in a dot, then a letter-only suffix.',
          'Optional port: (?::\\d{1,5})?; optional suffix: (?:[/?#][^\\s]*)?.',
        ],

        c2_explanation:
          'Validate the declared ASCII-domain subset. A query or fragment may follow the host directly, without a slash; a port is optional.',

        c3_title: 'IPv4 address (lenient)',
        c3_summary: 'Match four dot-separated decimal segments (no 0–255 range check).',
        c3_description: [
          '**Goal**: validate "four 1–3 digit segments separated by `.`". You do **not** need to enforce 0–255 ranges.',
          '',
          'Use `^...$` for whole-string validation.',
        ].join('\n'),
        c3_cases: [
          'Common private IP',
          'All zeros',
          'All 255s',
          'Only 3 segments',
          'Five segments',
          'Letters in segment',
          'Segment too long',
        ],
        c3_hints: ['`\\d{1,3}` is 1 to 3 digits.', 'Four segments joined by `\\.`.'],
        c3_explanation: 'Four 1–3 digit segments; `.` must be escaped.',

        c4_title: 'Hex color',
        c4_summary: 'Accept `#abc` shorthand or `#aabbcc` long form.',
        c4_description: [
          '**Goal**: validate a CSS hex color:',
          '',
          '- starts with `#`',
          '- followed by **3** or **6** hex digits (`0-9` / `a-f` / `A-F`)',
          '',
          'Use `^...$`.',
        ].join('\n'),
        c4_cases: [
          '3-digit shorthand',
          '3-digit uppercase',
          '6-digit long form',
          'Mixed case',
          'Missing #',
          'Non-hex chars',
          '4 digits',
          '5 digits',
        ],
        c4_hints: [
          'Character class `[\\da-fA-F]`.',
          'Group + `|` to accept 3 or 6: `([\\da-fA-F]{3}|[\\da-fA-F]{6})`.',
        ],
        c4_explanation:
          'Putting `{3}` before `{6}` would let `#abc123` match only `#abc` — `^...$` plus `|` ensures the whole string is consumed.',

        c5_title: 'ISO date format',
        c5_summary: '`YYYY-MM-DD`, format only — not real-date validation.',
        c5_description: [
          '**Goal**: check if the whole string follows `YYYY-MM-DD`: 4-digit year, 2-digit month, 2-digit day.',
          '',
          'No need to validate "Feb 30" — only positions and separators.',
        ].join('\n'),
        c5_cases: [
          'Normal date',
          'Beginning of century',
          'Single-digit month',
          'Slash separators',
          'Trailing junk',
          'Empty string',
        ],
        c5_hints: ['Year `\\d{4}`, month/day `\\d{2}` each, joined by `-`.'],

        c6_title: 'Password conditions (lookahead)',

        c6_summary: 'At least 8 chars, must contain **both** a letter and a digit.',
        c6_description:
          '**Goal**: check a format rule: at least 8 characters, including at least one ASCII letter and one digit. This exercise checks those conditions only; it does not measure password strength. Each lookahead checks one condition without consuming text.',

        c6_cases: [
          'Letter + digit mix',
          'Long with digit',
          'Has special chars',
          'Too short',
          'Letters only',
          'Digits only',
          'Empty string',
        ],
        c6_hints: [
          '`(?=.*[A-Za-z])` asserts "a letter exists somewhere".',
          '`(?=.*\\d)` asserts "a digit exists somewhere".',
          'Chain both lookaheads, then `^.{8,}$` for length.',
        ],
        c6_explanation:
          'Two zero-width lookaheads check letter and digit; the body `.{8,}` enforces length — all three must hold.',

        c7_title: 'North American phone number',
        c7_summary: 'Accept the four common formats: parens, dashes, dots, optional country code.',
        c7_description:
          '**Goal**: check a simplified North American phone format: ten digits, an optional +1 prefix, optional spaces/dashes/dots between digit groups, and either a bare or fully parenthesized area code. Parentheses must be paired. Anchor the whole string. This checks formatting, not whether the number is assigned.',

        c7_cases: [
          'Parens + dashes',
          'Dash separators',
          'Dot separators',
          'Spaces + country code',
          'Bare digits',
          'Wrong middle length',
          'Last segment too long',
          'Letters',
          'Empty string',
        ],
        c7_hints: [
          'Optional prefix: (?:\\+1[ -]?)?',
          'Area code: (?:\\(\\d{3}\\)|\\d{3}) ensures paired parentheses.',
          'Optional separators: [ .-]?',
        ],

        c7_explanation:
          'Choose either a complete parenthesized area code or three bare digits. This prevents accepting a lone opening or closing parenthesis.',

        c8_title: 'URL slug',
        c8_summary:
          'Lowercase letters / digits / single `-`; no leading/trailing or doubled dashes.',
        c8_description: [
          '**Goal**: validate a URL slug:',
          '',
          '- only lowercase letters, digits, `-`',
          '- **must not** start or end with `-`',
          '- **must not** contain `--`',
          '',
          'Use `^...$` for whole-string validation.',
        ].join('\n'),
        c8_cases: [
          'Single word',
          'With dashes',
          'Mixed digits',
          'Uppercase not allowed',
          'Leading dash',
          'Trailing dash',
          'Doubled dash',
          'Contains space',
          'Empty string',
        ],
        c8_hints: [
          'Idea: `[a-z0-9]+` first segment, then repeat `(-[a-z0-9]+)*`.',
          'Encode the rules into the structure — no separate checks needed.',
        ],
        c8_explanation:
          'Structural enforcement: every `-` **must** be followed by at least one alphanumeric, ruling out leading/trailing/doubled dashes.',

        c9_title: 'Extract Markdown links',
        c9_summary: 'Find every `[text](url)` link in the text.',
        c9_description:
          '**Goal**: extract all complete `[text](url)` links, in order. Tests compare the full matched strings and count, so missing or truncated links fail. This simplified exercise excludes nested brackets, parentheses in destinations, escaped delimiters and titles; use a Markdown parser for full Markdown.',

        c9_cases: [
          'One link',
          'Two adjacent links',
          'Link in CJK text',
          'No link',
          'Just brackets',
          'Unclosed paren',
        ],
        c9_hints: [
          'Use `[^\\]]+` for text — safer than `.+?`.',
          'URL similarly: `[^)]+`, with **mandatory** closing `)`.',
        ],
        c9_explanation:
          '`[^\\]]+` clamps the text (no `]` allowed); `[^)]+` clamps the url; the surrounding `\\[ \\] \\( \\)` forces both pairs.',

        c10_title: 'CSS class name',
        c10_summary:
          'Letter/`_` start (or `-` then letter/`_`); rest may include letters, digits, `_`, `-`.',
        c10_description: [
          '**Goal**: validate a CSS class name (simplified):',
          '',
          '- first char must be a letter or `_`, **or** a `-` followed by letter/`_`',
          '- subsequent chars: letters / digits / `_` / `-`',
          '',
          '⚠️ Whole-string validation.',
        ].join('\n'),
        c10_cases: [
          'Plain word',
          'BEM style',
          'Underscore start',
          'Negative prefix',
          'Mixed case + digit',
          'Starts with digit',
          'Doubled dash start',
          'Contains space',
          'Has !',
          'Empty string',
        ],
        c10_hints: [
          'Optional leading `-?`',
          'Then required letter/underscore: `[A-Za-z_]`',
          'Then any tail: `[A-Za-z0-9_-]*`',
        ],
        c10_explanation:
          'Optional `-` + required letter/underscore + any number of legal tail characters covers most real-world names.',

        c11_title: 'UUID v4',
        c11_summary: '8-4-4-4-12 hex; version digit is `4`, variant digit is 8/9/a/b.',
        c11_description: [
          '**Goal**: validate a **v4** UUID:',
          '',
          '`xxxxxxxx-xxxx-4xxx-Yxxx-xxxxxxxxxxxx`',
          '',
          '- 5 hex segments of length 8/4/4/4/12 (any case)',
          '- segment 3 starts with `4` (version)',
          '- segment 4 starts with `8`/`9`/`a`/`b`/`A`/`B` (variant)',
          '',
          '⚠️ Whole-string validation.',
        ].join('\n'),
        c11_cases: [
          'Standard v4',
          'v4 uppercase',
          'Another v4',
          'Version digit is 1',
          'Wrong variant',
          'Wrong segment length',
          'Non-hex char',
          'Random string',
          'Empty string',
        ],
        c11_hints: [
          'Skeleton: `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`',
          'Version: replace the first char of segment 3 with literal `4`.',
          'Variant: first char of segment 4 is `[89abAB]`.',
        ],
        c11_explanation:
          'Hard-coding the version digit (`4`) and the variant digit (`[89abAB]`) is the standard pattern for quick UUID-version validation.',
      },
      zh: {
        c1_title: '在文本里抓邮箱',
        c1_summary: '从一段段落中提取所有邮箱地址。',
        c1_description:
          '**目标**：按顺序提取输入中所有完整的形似邮箱的地址。测试会核对匹配数量和完整文本，请使用 `g`。本题覆盖 ASCII 本地段和点分域名（含子域名），不代表完整邮箱合法性校验。',

        c1_cases: ['段落里两个邮箱', '加号 / 子域名', '完全没有邮箱', '缺少顶级域', '只有 @'],
        c1_hints: [
          '使用 \\b 边界和 g 标志获取全部匹配。',
          '本地段用 [\\w.+-]+；域名标签与点用 (?:[\\w-]+\\.)+ 重复，最后接 [a-zA-Z]{2,}。',
        ],

        c1_explanation: '重复“域名标签 + 点”以保留完整子域名，并核对每一项匹配的完整内容。',

        c2_title: 'HTTPS URL 格式（ASCII 域名）',

        c2_summary: '校验限定的 HTTPS 格式：ASCII 域名、可选端口、路径、查询参数与片段。',

        c2_description:
          '**目标**：使用 `^...$` 匹配整串。本题接受小写 `https://`、首尾不是短横线的 ASCII 域名标签、至少两个英文字母的域名后缀、可选的 1–5 位数字端口，以及以 `/`、`?` 或 `#` 开始且不含空白的可选后缀。不检查端口范围、域名是否存在、IPv6、用户凭证或全部 URL 语法。通用 URL 处理应使用 URL 解析器。',

        c2_cases: [
          '最简 https URL',
          '带子域 + 路径 + 查询串',
          'http 不行',
          'ftp 不行',
          'https 后面没主机',
          '裸主机',
        ],
        c2_hints: [
          '以 ^https:\\/\\/ 开始。',
          '重复以点结尾的域名标签，最后接字母后缀。',
          '可选端口为 (?::\\d{1,5})?，可选后缀为 (?:[/?#][^\\s]*)?。',
        ],

        c2_explanation:
          '按题目声明的 ASCII 域名子集验证。查询参数或片段可直接跟在主机后，不必先出现斜杠；端口可选。',

        c3_title: 'IPv4 地址（宽松版）',
        c3_summary: '识别四段点分十进制（不要求 0–255 范围）。',
        c3_description: [
          '**目标**：判断输入是不是合法的 IPv4 字面量——只要"4 段、由 `.` 分隔、每段是 1–3 位数字"即可，**不要求**每段在 0–255 范围内。',
          '',
          '使用 `^...$` 做整串校验。',
        ].join('\n'),
        c3_cases: ['常见私网 IP', '全 0', '全 255', '只有 3 段', '5 段', '段里含字母', '段太长'],
        c3_hints: ['`\\d{1,3}` 表示 1 到 3 位数字。', '4 段中间用 `\\.` 隔开。'],
        c3_explanation: '4 段 1–3 位数字，`.` 必须转义。',

        c4_title: 'Hex 颜色码',
        c4_summary: '`#abc` 短写或 `#aabbcc` 长写都接受。',
        c4_description: [
          '**目标**：判断输入是不是合法的 CSS hex 颜色码：',
          '',
          '- 必须以 `#` 开头',
          '- 后面是 **3 位**或 **6 位**十六进制（`0-9` / `a-f` / `A-F`）',
          '',
          '使用 `^...$` 锚点。',
        ].join('\n'),
        c4_cases: [
          '3 位短写',
          '3 位大写',
          '6 位长写',
          '6 位混合大小写',
          '没有 #',
          '非 hex 字符',
          '4 位',
          '5 位',
        ],
        c4_hints: [
          '字符类 `[\\da-fA-F]`。',
          '用分组 + `|` 让 3 位或 6 位都接受：`([\\da-fA-F]{3}|[\\da-fA-F]{6})`。',
        ],
        c4_explanation:
          '注意 `{3}` 在 `{6}` 之前会让 3 位先匹配，导致 `#abc123` 只匹到 `#abc`——所以必须 `^...$` 配合 `|` 让整串都对齐。',

        c5_title: 'ISO 日期格式',
        c5_summary: '`YYYY-MM-DD`，仅校验格式不校验真实日期。',
        c5_description: [
          '**目标**：判断整串是不是 `YYYY-MM-DD` 这种格式：4 位年份 - 2 位月 - 2 位日。',
          '',
          '不需要校验"2 月没有 30 号"——只校验位数和分隔符。',
        ].join('\n'),
        c5_cases: ['正常日期', '世纪初', '单位数月份', '斜杠分隔', '后面有杂物', '空串'],
        c5_hints: ['年份是 `\\d{4}`，月日各 `\\d{2}`，中间 `-`。'],

        c6_title: '密码条件检查（先行断言）',

        c6_summary: '至少 8 字符，必须**同时**含字母和数字。',
        c6_description:
          '**目标**：检查一个格式规则：至少 8 个字符，同时含有 ASCII 英文字母和数字。本题仅检查这些条件，不评估密码的实际安全强度。每个先行断言检查一个条件而不消耗文本。',

        c6_cases: [
          '字母+数字混合',
          '长串带数字',
          '带特殊字符',
          '太短',
          '只有字母',
          '只有数字',
          '空串',
        ],
        c6_hints: [
          '`(?=.*[A-Za-z])` 断言"某处有字母"。',
          '`(?=.*\\d)` 断言"某处有数字"。',
          '把两个 lookahead 串在一起，再加上 `^.{8,}$` 控制长度。',
        ],
        c6_explanation: '两个零宽 lookahead 各自检查字母和数字，主体 `.{8,}` 控制长度——三者并存。',

        c7_title: '北美电话号码',
        c7_summary: '常见 4 种格式都接受：括号、横线、点、加国家码。',
        c7_description:
          '**目标**：检查简化的北美电话号码格式：10 位数字、可选 +1 前缀、数字组间可选空格/短横线/点；区号可以不带括号，或带一对完整括号。括号必须配对，并使用锚点匹配整串。本题只检查格式，不判断号码是否已分配。',

        c7_cases: [
          '括号 + 横线',
          '横线分隔',
          '点分隔',
          '空格 + 国家码',
          '纯数字',
          '中段位数不对',
          '尾段多了一位',
          '字母',
          '空串',
        ],
        c7_hints: [
          '可选国家码为 (?:\\+1[ -]?)?。',
          '区号用 (?:\\(\\d{3}\\)|\\d{3}) 保证括号成对。',
          '可选分隔符为 [ .-]?。',
        ],

        c7_explanation: '区号只接受完整的括号分支或纯数字分支，避免单独的左括号或右括号被接受。',

        c8_title: 'URL Slug',
        c8_summary: '只能小写字母 / 数字 / 单个 `-`，不许首尾或连续短横线。',
        c8_description: [
          '**目标**：判断输入是不是合法的 URL slug：',
          '',
          '- 只能含小写字母、数字、`-`',
          '- **不能**以 `-` 开头或结尾',
          '- **不能**连续 `--`',
          '',
          '使用 `^...$` 做整串校验。',
        ].join('\n'),
        c8_cases: [
          '单词',
          '带短横',
          '混数字',
          '大写不行',
          '前导短横',
          '尾随短横',
          '连续短横',
          '含空格',
          '空串',
        ],
        c8_hints: [
          '思路：首段 `[a-z0-9]+`，可重复的"`-` + 一段"用 `(-[a-z0-9]+)*`。',
          '把规则编进结构里，就不需要单独检查首尾或连续短横。',
        ],
        c8_explanation:
          '通过结构强制：每个 `-` 后面**必须**跟着至少一个字母数字，自然就排除了前导/尾随/连续的情况。',

        c9_title: '抽取 Markdown 链接',
        c9_summary: '在文本里找出所有 `[text](url)` 形式的链接。',
        c9_description:
          '**目标**：按顺序提取所有完整的 `[text](url)` 链接。测试核对完整文本和匹配数量，遗漏或截断链接都会失败。本题是简化格式，不覆盖嵌套括号、目标中的圆括号、转义分隔符和标题；完整 Markdown 应使用专门解析器。',

        c9_cases: [
          '一条链接',
          '两条相邻',
          '中文文本里的链接',
          '没有链接',
          '只有方括号',
          '括号未闭合',
        ],
        c9_hints: [
          '文本部分用取反字符类 `[^\\]]+`，比 `.+?` 稳。',
          'URL 部分类似：`[^)]+`，并且**必须**有闭合的 `)`。',
        ],
        c9_explanation:
          '`[^\\]]+` 锁住 text（不能跨过 `]`），`[^)]+` 锁住 url（不能跨过 `)`），最外层的 `\\[ \\] \\( \\)` 强制成对出现。',

        c10_title: 'CSS 类名',
        c10_summary: '简化版：字母/`_` 开头（或 `-` + 字母/`_`），后续允许字母数字 / `_` / `-`。',
        c10_description: [
          '**目标**：判断输入是不是一个合法的 CSS 类名（简化规则）：',
          '',
          '- 第一个字符必须是字母或 `_`，**或者**一个 `-` 后再跟字母/`_`',
          '- 后续可以是字母 / 数字 / `_` / `-`',
          '',
          '⚠️ 整串校验。',
        ].join('\n'),
        c10_cases: [
          '普通单词',
          'BEM 写法',
          '下划线开头',
          '负前缀',
          '混大写数字',
          '数字开头',
          '双短横开头',
          '含空格',
          '感叹号',
          '空串',
        ],
        c10_hints: [
          '先吃可选的 `-?`',
          '然后必须是字母或 `_`：`[A-Za-z_]`',
          '后续：`[A-Za-z0-9_-]*`',
        ],
        c10_explanation:
          '前导 `-` 可选 + 必须的字母/下划线 + 任意多后续合法字符，覆盖大多数实战命名。',

        c11_title: 'UUID v4',
        c11_summary: '8-4-4-4-12 的 hex；版本位是 4，variant 位是 8/9/a/b。',
        c11_description: [
          '**目标**：判断输入是不是合法的 **v4** UUID。形式：',
          '',
          '`xxxxxxxx-xxxx-4xxx-Yxxx-xxxxxxxxxxxx`',
          '',
          '- 5 段，长度依次 8/4/4/4/12，全部 hex（大小写都可以）',
          '- 第 3 段以 `4` 开头（版本位）',
          '- 第 4 段以 `8`/`9`/`a`/`b`/`A`/`B` 开头（variant 位）',
          '',
          '⚠️ 整串校验。',
        ].join('\n'),
        c11_cases: [
          '标准 v4',
          'v4 大写',
          '另一个 v4',
          '版本位是 1',
          'variant 不对',
          '段长不对',
          '含非 hex',
          '随机字符串',
          '空串',
        ],
        c11_hints: [
          '基本骨架：`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`',
          '版本位：第 3 段第一个字符替成字面量 `4`',
          'Variant：第 4 段第一个字符是 `[89abAB]`',
        ],
        c11_explanation:
          '把版本位（`4`）和 variant 位（`[89abAB]`）当成"硬编码字面量"嵌进去，是 UUID 各版本快速校验的常用模式。',
      },
      ja: {
        c1_title: 'テキスト内のメールアドレスを探す',
        c1_summary: '段落からメールアドレスらしい文字列を抽出します。',
        c1_description:
          '**目標**: 入力中のメールアドレスらしい文字列を、順序どおりにすべて抽出します。テストは一致件数と一致全体の文字列を照合します。`g` を使用してください。ASCII のローカル部とサブドメインを含むドット区切りのドメインを扱う練習で、メールアドレスの完全な検証ではありません。',

        c1_cases: [
          '段落内に 2 つのアドレス',
          'プラスの別名 / サブドメイン',
          'アドレスなし',
          'TLD なし',
          '@ だけ',
        ],
        c1_hints: [
          '\\b と g を使ってすべての一致を取得します。',
          'ローカル部は [\\w.+-]+、ドメインは (?:[\\w-]+\\.)+、最後に [a-zA-Z]{2,} を使います。',
        ],

        c1_explanation:
          'ドメインのラベルとドットを繰り返し、サブドメインを含むアドレス全体を取得します。各一致の全文を確認します。',

        c2_title: 'HTTPS URL の形式（ASCII ドメイン）',

        c2_summary:
          'ASCII ドメインと任意のポート・パス・クエリー・フラグメントを持つ限定形式を検証します。',

        c2_description:
          '**目標**: `^...$` で文字列全体を検証します。小文字の https://、先頭と末尾がハイフンでない ASCII ドメインラベル、英字2文字以上の末尾ラベル、任意の1〜5桁のポート、/・?・# で始まる空白を含まない任意の末尾部分を許可します。ポートの範囲、ドメインの存在、IPv6、認証情報、URL の全構文は検証しません。一般的な URL 処理には URL パーサーを使ってください。',

        c2_cases: [
          '最小の HTTPS URL',
          'サブドメイン + パス + クエリ',
          'http は拒否',
          'ftp は拒否',
          'ホストのない https',
          'ホスト名だけ',
        ],
        c2_hints: [
          '^https:\\/\\/ で開始します。',
          'ドットで終わるドメインラベルを繰り返し、末尾は英字にします。',
          '任意のポートは (?::\\d{1,5})?、末尾は (?:[/?#][^\\s]*)? です。',
        ],

        c2_explanation:
          '宣言した ASCII ドメインの形式を検証します。クエリーやフラグメントはスラッシュなしでホストに続けられます。ポートは任意です。',

        c3_title: 'IPv4 アドレス（簡易版）',
        c3_summary: 'ドットで区切られた 4 つの数字列に一致させます。0〜255 の範囲は確認しません。',
        c3_description:
          '**目標**: 「1〜3 桁の数字が `.` で区切られて 4 組ある」形式を確認しましょう。0〜255 の範囲を検証する必要はありません。\n\n`^...$` で文字列全体を検証します。',
        c3_cases: [
          '一般的なプライベート IP',
          'すべて 0',
          'すべて 255',
          '3 組しかない',
          '5 組ある',
          '数字列に英字がある',
          '数字列が長すぎる',
        ],
        c3_hints: ['`\\d{1,3}` は 1〜3 桁の数字です。', '4 組を `\\.` でつなぎます。'],
        c3_explanation: '1〜3 桁の数字を 4 組つなぎます。ドットはエスケープが必要です。',
        c4_title: '16 進数カラーコード',
        c4_summary: '短縮形の `#abc` または 6 桁の `#aabbcc` を許可します。',
        c4_description:
          '**目標**: CSS の 16 進数カラーコードを検証しましょう。\n\n- `#` で始まる\n- 続く 16 進数（`0-9` / `a-f` / `A-F`）が **3** 桁または **6** 桁\n\n`^...$` を使います。',
        c4_cases: [
          '3 桁の短縮形',
          '3 桁の大文字',
          '6 桁の形式',
          '大文字・小文字の混在',
          '# がない',
          '16 進数以外の文字',
          '4 桁',
          '5 桁',
        ],
        c4_hints: [
          '文字クラスは `[\\da-fA-F]`。',
          'グループと `|` で 3 桁か 6 桁を許可します: `([\\da-fA-F]{3}|[\\da-fA-F]{6})`。',
        ],
        c4_explanation:
          'アンカーがないと `#abc123` の `#abc` だけが一致する場合があります。`^...$` と `|` で全体を消費させます。',
        c5_title: 'ISO 形式の日付',
        c5_summary: '`YYYY-MM-DD` の形式だけを確認します。実在する日付かは検証しません。',
        c5_description:
          '**目標**: 文字列全体が `YYYY-MM-DD`（年 4 桁・月 2 桁・日 2 桁）かを確認しましょう。\n\n2 月 30 日のような日付の妥当性は確認せず、桁数と区切りだけを検証します。',
        c5_cases: [
          '通常の日付',
          '世紀の始まり',
          '月が 1 桁',
          'スラッシュ区切り',
          '末尾に余分な文字',
          '空文字列',
        ],
        c5_hints: ['年は `\\d{4}`、月と日は `\\d{2}` で、`-` でつなぎます。'],
        c6_title: 'パスワードの条件チェック（先読み）',

        c6_summary: '8 文字以上で、英字と数字の両方を含むか確認します。',
        c6_description:
          '**目標**: 8文字以上で、ASCII 英字と数字をそれぞれ含むという形式条件を確認します。パスワードの実際の強度を評価するものではありません。各先読みが文字を消費せずに条件を確認します。',

        c6_cases: [
          '英字と数字の混在',
          '数字を含む長い文字列',
          '特殊文字を含む',
          '短すぎる',
          '英字だけ',
          '数字だけ',
          '空文字列',
        ],
        c6_hints: [
          '`(?=.*[A-Za-z])` で英字がどこかにあることを確認します。',
          '`(?=.*\\d)` で数字がどこかにあることを確認します。',
          '先頭の `^` の後に 2 つの先読みを並べ、`.{8,}$` で長さを指定します。',
        ],
        c6_explanation:
          '2 つの幅ゼロの先読みで英字と数字を確認し、`.{8,}` で長さを指定します。3 条件すべてが必要です。',
        c7_title: '北米の電話番号',
        c7_summary: '括弧・ハイフン・ドット・空白などの形式と、省略可能な国番号を扱います。',
        c7_description:
          '**目標**: 北米の電話番号の簡略形式を確認します。10桁の数字、任意の +1、数字群の間の任意のスペース・ハイフン・ドットを許可します。市外局番の括弧は省略するか必ず対にします。文字列全体を検証しますが、実際に割り当てられた番号かは判定しません。',

        c7_cases: [
          '括弧とハイフン',
          'ハイフン区切り',
          'ドット区切り',
          '空白と国番号',
          '数字だけ',
          '中央の桁数が違う',
          '最後の数字列が長すぎる',
          '英字を含む',
          '空文字列',
        ],
        c7_hints: [
          '任意の国番号は (?:\\+1[ -]?)? です。',
          '市外局番は (?:\\(\\d{3}\\)|\\d{3}) で括弧を対にします。',
          '任意の区切りは [ .-]? です。',
        ],

        c7_explanation:
          '市外局番は括弧が対応した分岐か数字だけの分岐に限定し、片方だけの括弧を拒否します。',

        c8_title: 'URL スラッグ',
        c8_summary: '小文字・数字・単一の `-` を許可し、先頭・末尾・連続するハイフンを禁止します。',
        c8_description:
          '**目標**: URL スラッグを検証しましょう。\n\n- 小文字の英字・数字・`-` のみ\n- `-` で始まったり終わったり**しない**\n- `--` を**含まない**\n\n`^...$` で文字列全体を検証します。',
        c8_cases: [
          '単語 1 つ',
          'ハイフンを含む',
          '数字の混在',
          '大文字は不可',
          '先頭がハイフン',
          '末尾がハイフン',
          '連続するハイフン',
          '空白を含む',
          '空文字列',
        ],
        c8_hints: [
          '最初に `[a-z0-9]+`、その後に `(-[a-z0-9]+)*` を繰り返します。',
          '構造に条件を組み込めば、別々のチェックは不要です。',
        ],
        c8_explanation:
          '最初に英数字を置き、各 `-` の後にも必ず英数字を 1 文字以上要求します。先頭・末尾・連続するハイフンを除外できます。',
        c9_title: 'Markdown リンクを抽出する',
        c9_summary: 'テキスト内の `[text](url)` 形式のリンクを探します。',
        c9_description:
          '**目標**: すべての `[text](url)` リンクを順序どおりに抽出します。テストは一致全文と件数を照合するため、途中で切れたリンクや取りこぼしは失敗します。この簡略形式は括弧の入れ子、URL 内の丸括弧、区切りのエスケープ、タイトルを扱いません。完全な Markdown には専用パーサーを使ってください。',

        c9_cases: [
          'リンク 1 つ',
          '隣り合う 2 つのリンク',
          'CJK テキスト内のリンク',
          'リンクなし',
          '角括弧だけ',
          '閉じ丸括弧がない',
        ],
        c9_hints: [
          'text 部分には、区切りをまたがない `[^\\]]+` を使います。',
          'URL 部分は `[^)]+` とし、最後の `)` を**必須**にします。',
        ],
        c9_explanation:
          '`[^\\]]+` は text 内の `]` を禁止し、`[^)]+` は URL 内の `)` を禁止します。外側の `\\[ \\] \\( \\)` で両方の括弧を要求します。',
        c10_title: 'CSS クラス名',
        c10_summary:
          '英字か `_`（またはその前に `-`）で始まり、残りは英数字・`_`・`-` を許可します。',
        c10_description:
          '**目標**: 簡略化した CSS クラス名を検証しましょう。\n\n- 英字か `_`、または `-` + 英字か `_` で始まる\n- 以降は英数字・`_`・`-`\n\n文字列全体を検証します。',
        c10_cases: [
          '通常の単語',
          'BEM 形式',
          'アンダースコアで始まる',
          'ハイフンの接頭辞',
          '大文字・小文字と数字',
          '数字で始まる',
          'ハイフン 2 個で始まる',
          '空白を含む',
          '! を含む',
          '空文字列',
        ],
        c10_hints: [
          '先頭のハイフンは `-?` で省略可能にします。',
          '次に英字かアンダースコア `[A-Za-z_]` を必須にします。',
          '残りは `[A-Za-z0-9_-]*`。',
        ],
        c10_explanation:
          '任意の `-` + 必須の英字かアンダースコア + 許可した文字の繰り返しで、この問題のクラス名の形式を表します。',
        c11_title: 'UUID v4',
        c11_summary: '16 進数の 8-4-4-4-12 桁形式で、バージョンは `4`、バリアントは 8/9/a/b です。',
        c11_description:
          '**目標**: **v4** の UUID を検証しましょう。\n\n`xxxxxxxx-xxxx-4xxx-Yxxx-xxxxxxxxxxxx`\n\n- 8/4/4/4/12 桁の 16 進数を 5 組（大文字・小文字を許可）\n- 3 組目の先頭はバージョンの `4`\n- 4 組目の先頭はバリアントの `8` / `9` / `a` / `b` / `A` / `B`\n\n文字列全体を検証します。',
        c11_cases: [
          '標準的な v4',
          '大文字の v4',
          '別の v4',
          'バージョンが 1',
          'バリアントが違う',
          '桁数が違う',
          '16 進数以外の文字',
          '無関係な文字列',
          '空文字列',
        ],
        c11_hints: [
          '骨組み: `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`',
          'バージョン: 3 組目の先頭を `4` に固定します。',
          'バリアント: 4 組目の先頭を `[89abAB]` にします。',
        ],
        c11_explanation:
          'バージョンの `4` とバリアントの `[89abAB]` を固定し、UUID v4 の形式を確認します。',
      },
    },
    locale,
  );

  const challenges: Challenge[] = [
    {
      id: 'email-find',
      title: TEXTS.c1_title,
      summary: TEXTS.c1_summary,
      description: TEXTS.c1_description,
      difficulty: 'beginner',
      starterPattern: '',
      starterFlags: 'g',
      testCases: [
        {
          label: TEXTS.c1_cases[0],
          input: 'Reach me at hello@example.com or sales@example.org.',
          expect: 'match',
        },
        {
          label: TEXTS.c1_cases[1],
          input: 'Send to alice+filter@mail.sub.example.io please.',
          expect: 'match',
        },
        {
          label: TEXTS.c1_cases[2],
          input: 'No email is mentioned in this paragraph.',
          expect: 'noMatch',
        },
        { label: TEXTS.c1_cases[3], input: 'broken: bob@host', expect: 'noMatch' },
        { label: TEXTS.c1_cases[4], input: 'just an @ sign here', expect: 'noMatch' },
      ],
      hints: TEXTS.c1_hints,
      idealSolution: {
        pattern: '\\b[\\w.+-]+@(?:[\\w-]+\\.)+[a-zA-Z]{2,}\\b',
        flags: 'g',
        explanation: TEXTS.c1_explanation,
      },
    },
    {
      id: 'https-url',
      title: TEXTS.c2_title,
      summary: TEXTS.c2_summary,
      description: TEXTS.c2_description,
      difficulty: 'intermediate',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c2_cases[0], input: 'https://example.com', expect: 'match' },
        {
          label: TEXTS.c2_cases[1],
          input: 'https://sub.example.com/api?token=abc&x=1',
          expect: 'match',
        },
        { label: TEXTS.c2_cases[2], input: 'http://example.com', expect: 'noMatch' },
        { label: TEXTS.c2_cases[3], input: 'ftp://example.com', expect: 'noMatch' },
        { label: TEXTS.c2_cases[4], input: 'https://', expect: 'noMatch' },
        { label: TEXTS.c2_cases[5], input: 'example.com', expect: 'noMatch' },
        ...[
          'https://example.com?x=1',
          'https://example.com:8443/path',
          'https://example.com#intro',
        ].map((input) => ({ label: input, input, expect: 'match' as const })),
        ...[
          'https://-bad.com',
          'https://bad-.com',
          'https://example.com:abc',
          'https://example.com/a b',
        ].map((input) => ({ label: input, input, expect: 'noMatch' as const })),
      ],
      hints: TEXTS.c2_hints,
      idealSolution: {
        pattern:
          '^https:\\/\\/(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+[A-Za-z]{2,}(?::\\d{1,5})?(?:[/?#][^\\s]*)?$',
        explanation: TEXTS.c2_explanation,
      },
    },
    {
      id: 'ipv4',
      title: TEXTS.c3_title,
      summary: TEXTS.c3_summary,
      description: TEXTS.c3_description,
      difficulty: 'beginner',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c3_cases[0], input: '192.168.1.1', expect: 'match' },
        { label: TEXTS.c3_cases[1], input: '0.0.0.0', expect: 'match' },
        { label: TEXTS.c3_cases[2], input: '255.255.255.255', expect: 'match' },
        { label: TEXTS.c3_cases[3], input: '1.2.3', expect: 'noMatch' },
        { label: TEXTS.c3_cases[4], input: '1.2.3.4.5', expect: 'noMatch' },
        { label: TEXTS.c3_cases[5], input: 'a.b.c.d', expect: 'noMatch' },
        { label: TEXTS.c3_cases[6], input: '1.2.3.4567', expect: 'noMatch' },
      ],
      hints: TEXTS.c3_hints,
      idealSolution: {
        pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',
        explanation: TEXTS.c3_explanation,
      },
    },
    {
      id: 'hex-color',
      title: TEXTS.c4_title,
      summary: TEXTS.c4_summary,
      description: TEXTS.c4_description,
      difficulty: 'beginner',
      starterPattern: '^#',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c4_cases[0], input: '#fff', expect: 'match' },
        { label: TEXTS.c4_cases[1], input: '#ABC', expect: 'match' },
        { label: TEXTS.c4_cases[2], input: '#abc123', expect: 'match' },
        { label: TEXTS.c4_cases[3], input: '#FfAa00', expect: 'match' },
        { label: TEXTS.c4_cases[4], input: 'fff', expect: 'noMatch' },
        { label: TEXTS.c4_cases[5], input: '#gggggg', expect: 'noMatch' },
        { label: TEXTS.c4_cases[6], input: '#1234', expect: 'noMatch' },
        { label: TEXTS.c4_cases[7], input: '#12345', expect: 'noMatch' },
      ],
      hints: TEXTS.c4_hints,
      idealSolution: {
        pattern: '^#([\\da-fA-F]{3}|[\\da-fA-F]{6})$',
        explanation: TEXTS.c4_explanation,
      },
    },
    {
      id: 'iso-date',
      title: TEXTS.c5_title,
      summary: TEXTS.c5_summary,
      description: TEXTS.c5_description,
      difficulty: 'beginner',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c5_cases[0], input: '2025-05-09', expect: 'match' },
        { label: TEXTS.c5_cases[1], input: '1990-01-01', expect: 'match' },
        { label: TEXTS.c5_cases[2], input: '2025-1-1', expect: 'noMatch' },
        { label: TEXTS.c5_cases[3], input: '2025/05/09', expect: 'noMatch' },
        { label: TEXTS.c5_cases[4], input: '2025-05-09extra', expect: 'noMatch' },
        { label: TEXTS.c5_cases[5], input: '', expect: 'noMatch' },
      ],
      hints: TEXTS.c5_hints,
      idealSolution: { pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    },
    {
      id: 'strong-password',
      title: TEXTS.c6_title,
      summary: TEXTS.c6_summary,
      description: TEXTS.c6_description,
      difficulty: 'advanced',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c6_cases[0], input: 'Abc12345', expect: 'match' },
        { label: TEXTS.c6_cases[1], input: 'longenoughpw1', expect: 'match' },
        { label: TEXTS.c6_cases[2], input: 'P@ssw0rd!', expect: 'match' },
        { label: TEXTS.c6_cases[3], input: 'Short1', expect: 'noMatch' },
        { label: TEXTS.c6_cases[4], input: 'alllowercase', expect: 'noMatch' },
        { label: TEXTS.c6_cases[5], input: '12345678', expect: 'noMatch' },
        { label: TEXTS.c6_cases[6], input: '', expect: 'noMatch' },
      ],
      hints: TEXTS.c6_hints,
      idealSolution: {
        pattern: '^(?=.*[A-Za-z])(?=.*\\d).{8,}$',
        explanation: TEXTS.c6_explanation,
      },
    },
    {
      id: 'phone-na',
      title: TEXTS.c7_title,
      summary: TEXTS.c7_summary,
      description: TEXTS.c7_description,
      difficulty: 'intermediate',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c7_cases[0], input: '(415) 555-2671', expect: 'match' },
        { label: TEXTS.c7_cases[1], input: '415-555-2671', expect: 'match' },
        { label: TEXTS.c7_cases[2], input: '415.555.2671', expect: 'match' },
        { label: TEXTS.c7_cases[3], input: '+1 415 555 2671', expect: 'match' },
        { label: TEXTS.c7_cases[4], input: '4155552671', expect: 'match' },
        { label: TEXTS.c7_cases[5], input: '415-55-2671', expect: 'noMatch' },
        { label: TEXTS.c7_cases[6], input: '415 555 26710', expect: 'noMatch' },
        { label: TEXTS.c7_cases[7], input: 'abc-def-ghij', expect: 'noMatch' },
        { label: TEXTS.c7_cases[8], input: '', expect: 'noMatch' },
        ...['(415 555-2671', '415) 555-2671'].map((input) => ({
          label: input,
          input,
          expect: 'noMatch' as const,
        })),
      ],
      hints: TEXTS.c7_hints,
      idealSolution: {
        pattern: '^(?:\\+1[ -]?)?(?:\\(\\d{3}\\)|\\d{3})[ .-]?\\d{3}[ .-]?\\d{4}$',
        explanation: TEXTS.c7_explanation,
      },
    },
    {
      id: 'slug-url',
      title: TEXTS.c8_title,
      summary: TEXTS.c8_summary,
      description: TEXTS.c8_description,
      difficulty: 'intermediate',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c8_cases[0], input: 'hello', expect: 'match' },
        { label: TEXTS.c8_cases[1], input: 'hello-world', expect: 'match' },
        { label: TEXTS.c8_cases[2], input: 'my-cool-post-2024', expect: 'match' },
        { label: TEXTS.c8_cases[3], input: 'Hello-World', expect: 'noMatch' },
        { label: TEXTS.c8_cases[4], input: '-leading', expect: 'noMatch' },
        { label: TEXTS.c8_cases[5], input: 'trailing-', expect: 'noMatch' },
        { label: TEXTS.c8_cases[6], input: 'foo--bar', expect: 'noMatch' },
        { label: TEXTS.c8_cases[7], input: 'with space', expect: 'noMatch' },
        { label: TEXTS.c8_cases[8], input: '', expect: 'noMatch' },
      ],
      hints: TEXTS.c8_hints,
      idealSolution: {
        pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
        explanation: TEXTS.c8_explanation,
      },
    },
    {
      id: 'extract-md-link',
      title: TEXTS.c9_title,
      summary: TEXTS.c9_summary,
      description: TEXTS.c9_description,
      difficulty: 'intermediate',
      starterPattern: '',
      starterFlags: 'g',
      testCases: [
        {
          label: TEXTS.c9_cases[0],
          input: 'See [docs](https://example.com) please.',
          expect: 'match',
        },
        { label: TEXTS.c9_cases[1], input: '[a](http://x) and [b](http://y).', expect: 'match' },
        {
          label: TEXTS.c9_cases[2],
          input: '参考[维基百科](https://wiki.example/regex)。',
          expect: 'match',
        },
        { label: TEXTS.c9_cases[3], input: 'This is just plain text.', expect: 'noMatch' },
        { label: TEXTS.c9_cases[4], input: 'See [docs] for info.', expect: 'noMatch' },
        { label: TEXTS.c9_cases[5], input: 'broken: [text](unclosed', expect: 'noMatch' },
      ],
      hints: TEXTS.c9_hints,
      idealSolution: {
        pattern: '\\[([^\\]]+)\\]\\(([^)]+)\\)',
        flags: 'g',
        explanation: TEXTS.c9_explanation,
      },
    },
    {
      id: 'css-class',
      title: TEXTS.c10_title,
      summary: TEXTS.c10_summary,
      description: TEXTS.c10_description,
      difficulty: 'intermediate',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        { label: TEXTS.c10_cases[0], input: 'hero', expect: 'match' },
        { label: TEXTS.c10_cases[1], input: 'btn-primary', expect: 'match' },
        { label: TEXTS.c10_cases[2], input: '_internal', expect: 'match' },
        { label: TEXTS.c10_cases[3], input: '-debug', expect: 'match' },
        { label: TEXTS.c10_cases[4], input: 'Section1', expect: 'match' },
        { label: TEXTS.c10_cases[5], input: '1col', expect: 'noMatch' },
        { label: TEXTS.c10_cases[6], input: '--double-dash', expect: 'noMatch' },
        { label: TEXTS.c10_cases[7], input: 'with space', expect: 'noMatch' },
        { label: TEXTS.c10_cases[8], input: 'btn!', expect: 'noMatch' },
        { label: TEXTS.c10_cases[9], input: '', expect: 'noMatch' },
      ],
      hints: TEXTS.c10_hints,
      idealSolution: {
        pattern: '^-?[A-Za-z_][A-Za-z0-9_-]*$',
        explanation: TEXTS.c10_explanation,
      },
    },
    {
      id: 'uuid-v4',
      title: TEXTS.c11_title,
      summary: TEXTS.c11_summary,
      description: TEXTS.c11_description,
      difficulty: 'advanced',
      starterPattern: '^',
      starterFlags: '',
      testCases: [
        {
          label: TEXTS.c11_cases[0],
          input: '550e8400-e29b-41d4-a716-446655440000',
          expect: 'match',
        },
        {
          label: TEXTS.c11_cases[1],
          input: '123E4567-E89B-42D3-B456-426614174000',
          expect: 'match',
        },
        {
          label: TEXTS.c11_cases[2],
          input: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          expect: 'match',
        },
        {
          label: TEXTS.c11_cases[3],
          input: '00000000-0000-1000-8000-000000000000',
          expect: 'noMatch',
        },
        {
          label: TEXTS.c11_cases[4],
          input: '550e8400-e29b-41d4-c716-446655440000',
          expect: 'noMatch',
        },
        { label: TEXTS.c11_cases[5], input: '550e8400-e29b-41d4-a716-44665544', expect: 'noMatch' },
        {
          label: TEXTS.c11_cases[6],
          input: '550e8400-e29b-41d4-a716-44665544000g',
          expect: 'noMatch',
        },
        { label: TEXTS.c11_cases[7], input: 'not-a-uuid-at-all', expect: 'noMatch' },
        { label: TEXTS.c11_cases[8], input: '', expect: 'noMatch' },
      ],
      hints: TEXTS.c11_hints,
      idealSolution: {
        pattern:
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        explanation: TEXTS.c11_explanation,
      },
    },
  ];
  const extractionOutputs: Record<string, string[][]> = {
    'email-find': [
      ['hello@example.com', 'sales@example.org'],
      ['alice+filter@mail.sub.example.io'],
      [],
      [],
      [],
    ],
    'extract-md-link': [
      ['[docs](https://example.com)'],
      ['[a](http://x)', '[b](http://y)'],
      ['[维基百科](https://wiki.example/regex)'],
      [],
      [],
      [],
    ],
  };
  return challenges.map((challenge) => ({
    ...challenge,
    testCases: challenge.testCases.map((tc, index) => {
      const texts =
        extractionOutputs[challenge.id]?.[index] ?? (tc.expect === 'match' ? [tc.input] : []);
      return { ...tc, assertions: { count: texts.length, texts } };
    }),
  }));
}

export const CHALLENGES = getChallenges();

export function findChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

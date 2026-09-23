import type { Locale } from '@/paraglide/runtime';
import { TAG_SAMPLE } from '@/content/regexExamples';
import type { Lesson } from '../../types';
import { v } from '../../validators';
import { pickLocale } from '../../i18n';

const TEXTS = {
  en: {
    title: 'Greedy: the default behavior',
    summary: 'Quantifiers consume as much as possible by default — often too much.',
    s1_title: 'See what `<.+>` matches',
    s1_body: [
      'Trying to "match every HTML tag", a beginner naturally writes `<.+>`.',
      'Set the pattern to `<.+>`, then **count** the matches.',
    ].join('\n'),
    s1_hint:
      '`.+` is greedy — it stretches as far right as possible until the whole pattern can still match.',
    s2_title: 'It overshot',
    s2_body: [
      'Only **1** match, spanning from the first `<` all the way to the last `>`.',
      '',
      'Reason: `.+` is **greedy** by default — it grabs as much as it can, then backtracks until the entire pattern succeeds. The result is one match that spans multiple tags.',
      '',
      'Click "Next" to see how to make it stop early.',
    ].join('\n'),
  },
  zh: {
    title: '贪婪：默认行为',
    summary: '量词默认尽可能多地吃，常常会"吃过头"。',
    s1_title: '看看 `<.+>` 匹配了什么',
    s1_body: [
      '想"匹配每一个 HTML 标签"的人很自然地会写 `<.+>`。',
      '把 pattern 改成 `<.+>`，然后**数一数**有几个匹配。',
    ].join('\n'),
    s1_hint: '`.+` 是贪婪的——它会尽量往右吃，直到再也找不到能让整个 pattern 匹配的位置为止。',
    s2_title: '它"吃过头"了',
    s2_body: [
      '只有 **1** 个匹配，而且这个匹配从第一个 `<` 一路吃到最后一个 `>`。',
      '',
      '原因：`.+` 默认**贪婪**——它先尝试匹配尽量多的字符，再一步一步回退，直到 pattern 整体能成功为止。结果就是它跨越了多个标签。',
      '',
      '点击"下一步"，看怎么让它克制一点。',
    ].join('\n'),
  },
};

const READING = {
  en: {
    introduction:
      'A quantifier controls how often the preceding part of a regex repeats. The default is greedy: it tries a larger repetition count first, then gives characters back if the rest of the pattern needs them. This lesson uses short tag-shaped strings to make that behavior visible.',
    s1: {
      title: 'Why one match spans several tags',
      body: 'In `<.+>`, the two angle brackets are literal characters. The dot matches a character other than a line terminator, and `+` repeats that dot one or more times. The `g` flag searches for further non-overlapping matches after the first match finishes.\n\nStarting at the first `<`, `.+` initially consumes the rest of this one-line input. The final `>` in the pattern cannot match at the end, so the engine backs up to the last `>`. The result includes both the bold and italic sections; the final word `text` is outside the match.\n\n**One match is not the same as one tag.** The global flag does not split an already successful match into smaller ones.',
    },
    s2: {
      title: 'Greedy matching still has to satisfy the whole pattern',
      body: 'Greedy means “try more repetitions first”, not “always consume every remaining character”. With `a+a` and the input `aaa`, the repeated `a+` must leave one `a` for the final literal. The complete match is still `aaa`.\n\nFor the tag-shaped example, changing `+` to `+?` reverses the order in which repetition counts are tried. The lazy-quantifier lesson shows the four resulting matches. When a delimiter is forbidden inside a field, a negated character class can express that restriction directly.\n\nThese snippets illustrate matching behavior on controlled text. They do not parse arbitrary HTML, whose quoted attributes and nested structure require an HTML parser.',
    },
  },
  zh: {
    introduction:
      '量词决定前面的字符或分组重复多少次。默认的贪婪模式会优先尝试更多次重复；如果后续部分匹配不了，再退回一些字符。本课用几段形似 HTML 标签的短文本，说明这个过程。',
    s1: {
      title: '为什么一次匹配会跨过多个标签',
      body: '在 `<.+>` 中，尖括号是普通字符；点号匹配换行符以外的字符，`+` 表示重复一次或多次。`g` 标志让搜索在本次匹配结束后继续寻找下一个不重叠的匹配。\n\n从第一个 `<` 开始，`.+` 最初会匹配这一行剩下的字符。此时模式末尾的 `>` 无法匹配，于是引擎向前退，直到最后一个 `>`。最终结果包含粗体和斜体两段内容，但不包含末尾的 `text`。\n\n**一个匹配不等于一个标签。** 加上 `g` 并不会把已经成功的大段匹配拆成几个小段。',
    },
    s2: {
      title: '贪婪仍然必须满足整个表达式',
      body: '贪婪表示“优先尝试更多次重复”，并不意味着一定吃掉剩下的全部字符。例如用 `a+a` 匹配 `aaa` 时，`a+` 必须留下一个 `a` 给后面的字面量，完整匹配仍然是 `aaa`。\n\n对于标签示例，把 `+` 改成 `+?` 就会反过来优先尝试更少次重复。惰性量词一课会展示得到的四个匹配。如果字段内部不允许出现分隔符，也可以直接用取反字符类表达这个限制。\n\n这些短文本用于说明匹配行为，不是通用 HTML 解析方案。真实 HTML 中的引号属性和嵌套结构应交给 HTML 解析器处理。',
    },
  },
};

export function createGreedyLesson(locale?: Locale): Lesson {
  const t = pickLocale(TEXTS, locale);
  const reading = pickLocale(READING, locale);
  return {
    id: 'quantifiers-greedy',
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
    estimatedMinutes: 4,
    initialState: {
      engine: 'javascript',
      pattern: '',
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
              pattern: '<.+>',
              flags: 'g',
              testText: TAG_SAMPLE,
              matches: [{ text: '<b>bold</b> and <i>italic</i>' }],
            },
          ],
        },
        validate: v.all(v.patternEquals('<.+>'), v.matchesAtLeast(1)),
        hints: [t.s1_hint],
        spotlight: {
          patternSubstrings: ['.+'],
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
          examples: [{ pattern: 'a+a', flags: 'g', testText: 'aaa', matches: [{ text: 'aaa' }] }],
        },
        validate: v.always(),
      },
    ],
    nextLessonId: 'quantifiers-lazy',
  };
}

export const greedyLesson = createGreedyLesson();

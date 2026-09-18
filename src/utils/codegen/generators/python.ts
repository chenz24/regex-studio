import type { CodeGenContext, CodeGenResult } from '../types';
import {
  contextReplacement,
  escapePattern,
  escapeTestString,
  escapeReplacement,
  pythonStringLiteral,
} from '../escaper';
import { mapFlags } from '../flagMapper';
import { translatePythonPattern } from '../pythonPattern';

export function generatePython(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'python');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in Python: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  const translated = translatePythonPattern(escapePattern(pattern, 'python'), flags);
  warnings.push(...translated.warnings);
  if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(pattern + testText)) {
    warnings.push(
      'Python uses Unicode code points for matching and offsets; JavaScript uses UTF-16 offsets and, without u/v, UTF-16 matching units. Verify astral characters.',
    );
  }
  const patternLiteral = pythonStringLiteral(translated.pattern);
  const testStr = escapeTestString(testText, 'python');
  const replaceStr = escapeReplacement(replaceText, 'python', pattern);

  const flagsArg =
    flagMapping.compileFlags.length > 0 ? `, ${flagMapping.compileFlags.join(' | ')}` : '';

  const contextual = contextReplacement(replaceText, 'python', pattern, {
    capture: (index) => `(match.group(${index}) or '')`,
    prefix: 'text[:match.start()]',
    suffix: 'text[match.end():]',
  });

  let code = `${warnings.map((warning) => `# Compatibility note: ${warning}\n`).join('')}import re\n\n`;

  if (
    operation === 'matchAll' ||
    operation === 'capture' ||
    (operation === 'replace' && flags.includes('g'))
  ) {
    code += `def iter_matches(pattern, text):
    # Like JavaScript, advance after an empty match before searching again.
    position = 0
    while position <= len(text):
        match = pattern.search(text, position)
        if match is None:
            break
        yield match
        position = match.end()
        if match.start() == match.end():
            position += 1


`;
  }

  switch (operation) {
    case 'test':
      code += `pattern = re.compile(${patternLiteral}${flagsArg})
text = ${testStr}

is_match = bool(pattern.search(text))
print(f"Match: {is_match}")`;
      break;

    case 'match':
      code += `pattern = re.compile(${patternLiteral}${flagsArg})
text = ${testStr}

match = pattern.search(text)
if match:
    print(f"Found: {match.group()}")
    print(f"Index: {match.start()}-{match.end()}")
    print(f"Groups: {match.groups()}")
    if match.groupdict():
        print(f"Named groups: {match.groupdict()}")
else:
    print("No match found")`;
      break;

    case 'matchAll':
      code += `pattern = re.compile(${patternLiteral}${flagsArg})
text = ${testStr}

matches = list(iter_matches(pattern, text))
print(f"Found {len(matches)} matches:")
for i, match in enumerate(matches):
    print(f"[{i}] \\"{match.group()}\\" at index {match.start()}")`;
      break;

    case 'capture':
      code += `pattern = re.compile(${patternLiteral}${flagsArg})
text = ${testStr}

matches = list(iter_matches(pattern, text))
for i, match in enumerate(matches):
    print(f"Match {i + 1}: \\"{match.group()}\\"")
    # Numbered groups
    for j, group in enumerate(match.groups(), 1):
        print(f"  Group {j}: \\"{group}\\"")
    # Named groups
    for name, value in match.groupdict().items():
        print(f"  Group '{name}': \\"{value}\\"")`;
      break;

    case 'replace':
      code += `pattern = re.compile(${patternLiteral}${flagsArg})
text = ${testStr}
replacement = ${replaceStr}

${
  flags.includes('g')
    ? `parts = []
last_end = 0
for match in iter_matches(pattern, text):
    parts.append(text[last_end:match.start()])
    parts.append(${contextual ?? 'match.expand(replacement)'})
    last_end = match.end()
parts.append(text[last_end:])
result = ''.join(parts)`
    : `result = pattern.sub(${contextual ? `lambda match: ${contextual}` : 'replacement'}, text, count=1)`
}
print(f"Result: {result}")`;
      break;

    case 'split':
      code += `pattern = re.compile(${patternLiteral}${flagsArg})
text = ${testStr}

# Match at each candidate position to follow JavaScript split semantics.
# Boundary-only matches do not add empty leading or trailing parts.
parts = []
if not text:
    if pattern.match(text) is None:
        parts.append(text)
else:
    last_end = position = 0
    while position < len(text):
        match = pattern.match(text, position)
        if match is None or match.end() == last_end:
            position += 1
            continue
        parts.append(text[last_end:match.start()])
        parts.extend(match.groups())
        last_end = position = match.end()
    parts.append(text[last_end:])
print(f"Split into {len(parts)} parts:")
for i, part in enumerate(parts):
    if part is None:
        part = "undefined"
    print(f"[{i}] \\"{part}\\"")`;
      break;
  }

  return { code, language: 'python', warnings };
}

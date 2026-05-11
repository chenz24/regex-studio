import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { mapFlags } from '../flagMapper';

export function generatePython(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'python');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in Python: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  const escapedPattern = escapePattern(pattern, 'python');
  const testStr = escapeTestString(testText, 'python');
  const replaceStr = escapeReplacement(replaceText, 'python');

  const flagsArg =
    flagMapping.compileFlags.length > 0 ? `, ${flagMapping.compileFlags.join(' | ')}` : '';

  let code = 'import re\n\n';

  switch (operation) {
    case 'test':
      code += `pattern = re.compile(r'${escapedPattern}'${flagsArg})
text = ${testStr}

is_match = bool(pattern.search(text))
print(f"Match: {is_match}")`;
      break;

    case 'match':
      code += `pattern = re.compile(r'${escapedPattern}'${flagsArg})
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
      code += `pattern = re.compile(r'${escapedPattern}'${flagsArg})
text = ${testStr}

matches = list(pattern.finditer(text))
print(f"Found {len(matches)} matches:")
for i, match in enumerate(matches):
    print(f"[{i}] \\"{match.group()}\\" at index {match.start()}")`;
      break;

    case 'capture':
      code += `pattern = re.compile(r'${escapedPattern}'${flagsArg})
text = ${testStr}

matches = list(pattern.finditer(text))
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
      code += `pattern = re.compile(r'${escapedPattern}'${flagsArg})
text = ${testStr}
replacement = ${replaceStr}

result = pattern.sub(replacement, text)
print(f"Result: {result}")`;
      break;

    case 'split':
      code += `pattern = re.compile(r'${escapedPattern}'${flagsArg})
text = ${testStr}

parts = pattern.split(text)
print(f"Split into {len(parts)} parts:")
for i, part in enumerate(parts):
    print(f"[{i}] \\"{part}\\"")`;
      break;
  }

  return { code, language: 'python', warnings };
}

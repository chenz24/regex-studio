import type { CodeGenContext, CodeGenResult } from '../types';
import { contextReplacement, escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { mapFlags } from '../flagMapper';

export function generateSwift(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'swift');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in Swift: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  const escapedPattern = escapePattern(pattern, 'swift');
  const testStr = escapeTestString(testText, 'swift');
  const replaceStr = escapeReplacement(replaceText, 'swift', pattern);

  const optionsArg =
    flagMapping.compileFlags.length > 0
      ? `, options: [${flagMapping.compileFlags.join(', ')}]`
      : '';

  const contextual = contextReplacement(replaceText, 'swift', pattern, {
    capture: (index) =>
      `(match.range(at: ${index}).location == NSNotFound ? "" : subject.substring(with: match.range(at: ${index})))`,
    prefix: 'subject.substring(to: match.range.location)',
    suffix: 'subject.substring(from: NSMaxRange(match.range))',
  });

  let code = `import Foundation

let pattern = try! NSRegularExpression(pattern: "${escapedPattern}"${optionsArg})
let text = ${testStr}
let range = NSRange(text.startIndex..., in: text)
`;

  switch (operation) {
    case 'test':
      code += `
let isMatch = pattern.firstMatch(in: text, range: range) != nil
print("Match: \\(isMatch)")`;
      break;

    case 'match':
      code += `
if let match = pattern.firstMatch(in: text, range: range) {
    let matchRange = Range(match.range, in: text)!
    let found = String(text[matchRange])
    print("Found: \\(found)")
    print("Index: \\(match.range.location)-\\(match.range.location + match.range.length)")
    
    for i in 1..<match.numberOfRanges {
        if let groupRange = Range(match.range(at: i), in: text) {
            print("Group \\(i): \\(text[groupRange])")
        }
    }
} else {
    print("No match found")
}`;
      break;

    case 'matchAll':
      code += `
let matches = pattern.matches(in: text, range: range)
print("Found \\(matches.count) matches:")
for (i, match) in matches.enumerated() {
    let matchRange = Range(match.range, in: text)!
    let found = String(text[matchRange])
    print("[\\(i)] \\"\\(found)\\" at index \\(match.range.location)")
}`;
      break;

    case 'capture':
      code += `
let matches = pattern.matches(in: text, range: range)
for (i, match) in matches.enumerated() {
    let matchRange = Range(match.range, in: text)!
    let found = String(text[matchRange])
    print("Match \\(i + 1): \\"\\(found)\\"")
    
    for j in 1..<match.numberOfRanges {
        if let groupRange = Range(match.range(at: j), in: text) {
            print("  Group \\(j): \\"\\(text[groupRange])\\"")
        }
    }
}`;
      break;

    case 'replace':
      if (contextual) {
        code += `
let subject = text as NSString
var result = ""
var lastEnd = 0
let matches = ${flags.includes('g') ? 'pattern.matches(in: text, range: range)' : '[pattern.firstMatch(in: text, range: range)].compactMap { $0 }'}
for match in matches {
    result += subject.substring(with: NSRange(location: lastEnd, length: match.range.location - lastEnd))
    result += ${contextual}
    lastEnd = NSMaxRange(match.range)
}
result += subject.substring(from: lastEnd)
print("Result: \\(result)")`;
        break;
      }
      code += `
let replacement = ${replaceStr}
${
  flags.includes('g')
    ? 'let result = pattern.stringByReplacingMatches(in: text, range: range, withTemplate: replacement)'
    : `var result = text
if let match = pattern.firstMatch(in: text, range: range) {
    let expanded = pattern.replacementString(for: match, in: text, offset: 0, template: replacement)
    result = (text as NSString).replacingCharacters(in: match.range, with: expanded)
}`
}
print("Result: \\(result)")`;
      break;

    case 'split':
      code += `
var parts: [String] = []
var lastEnd = text.startIndex
for match in pattern.matches(in: text, range: range) {
    let matchRange = Range(match.range, in: text)!
    parts.append(String(text[lastEnd..<matchRange.lowerBound]))
    lastEnd = matchRange.upperBound
}
parts.append(String(text[lastEnd...]))

print("Split into \\(parts.count) parts:")
for (i, part) in parts.enumerated() {
    print("[\\(i)] \\"\\(part)\\"")
}`;
      break;
  }

  return { code, language: 'swift', warnings };
}

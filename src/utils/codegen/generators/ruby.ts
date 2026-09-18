import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { getRubyFlags } from '../flagMapper';

/** Ruby's anchors and dot use different newline rules from JavaScript. */
function translatePattern(pattern: string, flags: string): string {
  const multiline = flags.includes('m');
  let result = '';
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      result += ch + (pattern[++i] ?? '');
    } else if (inClass) {
      result += ch;
      if (ch === ']') inClass = false;
    } else if (ch === '[') {
      inClass = true;
      result += ch;
    } else if (ch === '^') {
      result += multiline ? String.raw`(?:\A|(?<=[\n\r\u2028\u2029]))` : String.raw`\A`;
    } else if (ch === '$') {
      result += multiline ? String.raw`(?:\z|(?=[\n\r\u2028\u2029]))` : String.raw`\z`;
    } else if (ch === '.' && !flags.includes('s')) {
      result += String.raw`[^\n\r\u2028\u2029]`;
    } else {
      result += ch;
    }
  }
  return result;
}

export function generateRuby(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const escapedPattern = escapePattern(translatePattern(pattern, flags), 'ruby');
  const testStr = escapeTestString(testText, 'ruby');
  const replaceStr = escapeReplacement(replaceText, 'ruby', pattern);
  const rbFlags = getRubyFlags(flags);

  const patternStr = `/${escapedPattern}/${rbFlags}`;

  let code = `pattern = ${patternStr}
text = ${testStr}
`;

  switch (operation) {
    case 'test':
      code += `
is_match = !!(text =~ pattern)
puts "Match: #{is_match}"`;
      break;

    case 'match':
      code += `
match = pattern.match(text)
if match
  puts "Found: #{match[0]}"
  puts "Index: #{match.begin(0)}-#{match.end(0)}"
  match.captures.each_with_index do |group, i|
    puts "Group #{i + 1}: #{group}"
  end
  match.named_captures.each do |name, value|
    puts "Group '#{name}': #{value}"
  end
else
  puts "No match found"
end`;
      break;

    case 'matchAll':
      code += `
matches = text.to_enum(:scan, pattern).map { Regexp.last_match }
puts "Found #{matches.length} matches:"
matches.each_with_index do |match, i|
  puts "[#{i}] \\"#{match[0]}\\" at index #{match.begin(0)}"
end`;
      break;

    case 'capture':
      code += `
matches = text.to_enum(:scan, pattern).map { Regexp.last_match }
matches.each_with_index do |match, i|
  puts "Match #{i + 1}: \\"#{match[0]}\\""
  match.captures.each_with_index do |group, j|
    puts "  Group #{j + 1}: \\"#{group}\\""
  end
  match.named_captures.each do |name, value|
    puts "  Group '#{name}': \\"#{value}\\""
  end
end`;
      break;

    case 'replace':
      code += `
replacement = ${replaceStr}
result = text.${flags.includes('g') ? 'gsub' : 'sub'}(pattern, replacement)
puts "Result: #{result}"`;
      break;

    case 'split':
      code += `
parts = []
last_end = 0
if text.empty?
  parts << "" unless pattern.match(text)
else
  text.to_enum(:scan, pattern).each do
    match = Regexp.last_match
    break if match.begin(0) == text.length
    next if match.end(0) == last_end
    parts << text[last_end...match.begin(0)]
    parts.concat(match.captures)
    last_end = match.end(0)
  end
  parts << text[last_end..-1]
end
puts "Split into #{parts.length} parts:"
parts.each_with_index do |part, i|
  puts "[#{i}] \\"#{part.nil? ? 'undefined' : part}\\""
end`;
      break;
  }

  return { code, language: 'ruby', warnings };
}

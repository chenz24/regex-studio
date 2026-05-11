import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { getRubyFlags } from '../flagMapper';

export function generateRuby(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const escapedPattern = escapePattern(pattern, 'ruby');
  const testStr = escapeTestString(testText, 'ruby');
  const replaceStr = escapeReplacement(replaceText, 'ruby');
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
result = text.gsub(pattern, replacement)
puts "Result: #{result}"`;
      break;

    case 'split':
      code += `
parts = text.split(pattern)
puts "Split into #{parts.length} parts:"
parts.each_with_index do |part, i|
  puts "[#{i}] \\"#{part}\\""
end`;
      break;
  }

  return { code, language: 'ruby', warnings };
}

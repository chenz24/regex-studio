import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { getRubyFlags } from '../flagMapper';

/** Translate JS line rules and scoped flags (Ruby calls dotAll `m`). */
function translatePattern(pattern: string, flags: string): string {
  type Scope = { multiline: boolean; dotAll: boolean };
  let scope: Scope = { multiline: flags.includes('m'), dotAll: flags.includes('s') };
  const scopes: Scope[] = [];
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
    } else if (ch === '(') {
      scopes.push(scope);
      const modifier = /^\(\?([ims]*)(?:-([ims]+))?:/.exec(pattern.slice(i));
      if (modifier) {
        const enabled = modifier[1],
          disabled = modifier[2] ?? '';
        scope = {
          multiline: enabled.includes('m') || (scope.multiline && !disabled.includes('m')),
          dotAll: enabled.includes('s') || (scope.dotAll && !disabled.includes('s')),
        };
        // JS m is implemented by translating anchors within this scope.
        const rubyFlags = (value: string) => value.replace(/m/g, '').replace(/s/g, 'm');
        const off = rubyFlags(disabled);
        result += `(?${rubyFlags(enabled)}${off ? `-${off}` : ''}:`;
        i += modifier[0].length - 1;
      } else {
        result += ch;
      }
    } else if (ch === ')') {
      scope = scopes.pop() ?? scope;
      result += ch;
    } else if (ch === '^') {
      result += scope.multiline ? String.raw`(?:\A|(?<=[\n\r\u2028\u2029]))` : String.raw`\A`;
    } else if (ch === '$') {
      result += scope.multiline ? String.raw`(?:\z|(?=[\n\r\u2028\u2029]))` : String.raw`\z`;
    } else if (ch === '.' && !scope.dotAll) {
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

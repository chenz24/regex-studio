import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { mapFlags } from '../flagMapper';

export function generateKotlin(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'kotlin');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in Kotlin: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  const escapedPattern = escapePattern(pattern, 'kotlin');
  const testStr = escapeTestString(testText, 'kotlin');
  const replaceStr = escapeReplacement(replaceText, 'kotlin');

  // Kotlin uses RegexOption enum
  const kotlinOptions: string[] = [];
  if (flags.includes('i')) kotlinOptions.push('RegexOption.IGNORE_CASE');
  if (flags.includes('m')) kotlinOptions.push('RegexOption.MULTILINE');
  if (flags.includes('s')) kotlinOptions.push('RegexOption.DOT_MATCHES_ALL');
  if (flags.includes('x')) kotlinOptions.push('RegexOption.COMMENTS');

  const optionsArg = kotlinOptions.length > 0 ? `, setOf(${kotlinOptions.join(', ')})` : '';

  let code = `fun main() {
    val pattern = Regex("${escapedPattern}"${optionsArg})
    val text = ${testStr}
`;

  switch (operation) {
    case 'test':
      code += `
    val isMatch = pattern.containsMatchIn(text)
    println("Match: $isMatch")`;
      break;

    case 'match':
      code += `
    val match = pattern.find(text)
    if (match != null) {
        println("Found: \${match.value}")
        println("Index: \${match.range}")
        match.groupValues.drop(1).forEachIndexed { i, group ->
            println("Group \${i + 1}: $group")
        }
    } else {
        println("No match found")
    }`;
      break;

    case 'matchAll':
      code += `
    val matches = pattern.findAll(text).toList()
    println("Found \${matches.size} matches:")
    matches.forEachIndexed { i, match ->
        println("[$i] \\"\${match.value}\\" at index \${match.range.first}")
    }`;
      break;

    case 'capture':
      code += `
    val matches = pattern.findAll(text).toList()
    matches.forEachIndexed { i, match ->
        println("Match \${i + 1}: \\"\${match.value}\\"")
        match.groupValues.drop(1).forEachIndexed { j, group ->
            println("  Group \${j + 1}: \\"$group\\"")
        }
    }`;
      break;

    case 'replace':
      code += `
    val replacement = ${replaceStr}
    val result = pattern.replace(text, replacement)
    println("Result: $result")`;
      break;

    case 'split':
      code += `
    val parts = pattern.split(text)
    println("Split into \${parts.size} parts:")
    parts.forEachIndexed { i, part ->
        println("[$i] \\"$part\\"")
    }`;
      break;
  }

  code += `
}`;

  return { code, language: 'kotlin', warnings };
}

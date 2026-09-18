import type { CodeGenContext, CodeGenResult } from '../types';
import { contextReplacement, escapeTestString, escapeReplacement } from '../escaper';
import { mapFlags } from '../flagMapper';

export function generateGo(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'go');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in Go regexp: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  // Go uses inline flags
  const fullPattern = flagMapping.inlinePrefix + pattern;

  // Check if we can use raw string
  const useRawString = !fullPattern.includes('`');
  const patternStr = useRawString
    ? `\`${fullPattern}\``
    : `"${fullPattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

  const testStr = escapeTestString(testText, 'go');
  const replaceStr = escapeReplacement(replaceText, 'go', pattern);

  const contextual = contextReplacement(replaceText, 'go', pattern, {
    capture: (index) =>
      `func() string { if match[${index * 2}] < 0 { return "" }; return text[match[${index * 2}]:match[${index * 2 + 1}]] }()`,
    prefix: 'text[:match[0]]',
    suffix: 'text[match[1]:]',
  });

  let code = `package main

import (
	"fmt"
	"regexp"
)

func main() {
	pattern := regexp.MustCompile(${patternStr})
	text := ${testStr}
`;

  switch (operation) {
    case 'test':
      code += `
	isMatch := pattern.MatchString(text)
	fmt.Println("Match:", isMatch)`;
      break;

    case 'match':
      code += `
	match := pattern.FindStringIndex(text)
	if match != nil {
		found := text[match[0]:match[1]]
		fmt.Println("Found:", found)
		fmt.Printf("Index: %d-%d\\n", match[0], match[1])
	} else {
		fmt.Println("No match found")
	}`;
      break;

    case 'matchAll':
      code += `
	matches := pattern.FindAllStringIndex(text, -1)
	fmt.Printf("Found %d matches:\\n", len(matches))
	for i, match := range matches {
		found := text[match[0]:match[1]]
		fmt.Printf("[%d] \\"%s\\" at index %d\\n", i, found, match[0])
	}`;
      break;

    case 'capture':
      code += `
	matches := pattern.FindAllStringSubmatch(text, -1)
	for i, match := range matches {
		fmt.Printf("Match %d: \\"%s\\"\\n", i+1, match[0])
		for j := 1; j < len(match); j++ {
			fmt.Printf("  Group %d: \\"%s\\"\\n", j, match[j])
		}
	}`;
      break;

    case 'replace':
      if (contextual) {
        code += `
	result := ""
	lastEnd := 0
	for _, match := range pattern.FindAllStringSubmatchIndex(text, ${flags.includes('g') ? -1 : 1}) {
		result += text[lastEnd:match[0]] + ${contextual}
		lastEnd = match[1]
	}
	result += text[lastEnd:]
	fmt.Println("Result:", result)`;
        break;
      }
      code += `
	replacement := ${replaceStr}
${
  flags.includes('g')
    ? '\tresult := pattern.ReplaceAllString(text, replacement)'
    : `\tresult := text
	if match := pattern.FindStringSubmatchIndex(text); match != nil {
		expanded := pattern.ExpandString(nil, replacement, text, match)
		result = text[:match[0]] + string(expanded) + text[match[1]:]
	}`
}
	fmt.Println("Result:", result)`;
      break;

    case 'split':
      code += `
	parts := pattern.Split(text, -1)
	fmt.Printf("Split into %d parts:\\n", len(parts))
	for i, part := range parts {
		fmt.Printf("[%d] \\"%s\\"\\n", i, part)
	}`;
      break;
  }

  code += `
}`;

  return { code, language: 'go', warnings };
}

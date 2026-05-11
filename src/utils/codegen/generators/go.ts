import type { CodeGenContext, CodeGenResult } from '../types';
import { escapeTestString, escapeReplacement } from '../escaper';
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
  const replaceStr = escapeReplacement(replaceText, 'go');

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
      code += `
	replacement := ${replaceStr}
	result := pattern.ReplaceAllString(text, replacement)
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

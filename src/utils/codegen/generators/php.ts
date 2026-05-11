import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { getPhpFlags } from '../flagMapper';

export function generatePhp(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const escapedPattern = escapePattern(pattern, 'php');
  const testStr = escapeTestString(testText, 'php');
  const replaceStr = escapeReplacement(replaceText, 'php');
  const phpFlags = getPhpFlags(flags);

  const patternStr = `'/${escapedPattern.replace(/\//g, '\\/')}/${phpFlags}'`;

  let code = `<?php

$pattern = ${patternStr};
$text = ${testStr};
`;

  switch (operation) {
    case 'test':
      code += `
$isMatch = preg_match($pattern, $text);
echo "Match: " . ($isMatch ? "true" : "false") . "\\n";`;
      break;

    case 'match':
      code += `
if (preg_match($pattern, $text, $match, PREG_OFFSET_CAPTURE)) {
    echo "Found: " . $match[0][0] . "\\n";
    echo "Index: " . $match[0][1] . "\\n";
    for ($i = 1; $i < count($match); $i++) {
        echo "Group $i: " . $match[$i][0] . "\\n";
    }
} else {
    echo "No match found\\n";
}`;
      break;

    case 'matchAll':
      code += `
preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
echo "Found " . count($matches) . " matches:\\n";
foreach ($matches as $i => $match) {
    echo "[$i] \\"{$match[0][0]}\\" at index {$match[0][1]}\\n";
}`;
      break;

    case 'capture':
      code += `
preg_match_all($pattern, $text, $matches, PREG_SET_ORDER);
foreach ($matches as $i => $match) {
    echo "Match " . ($i + 1) . ": \\"{$match[0]}\\"\\n";
    for ($j = 1; $j < count($match); $j++) {
        echo "  Group $j: \\"{$match[$j]}\\"\\n";
    }
}`;
      break;

    case 'replace':
      code += `
$replacement = ${replaceStr};
$result = preg_replace($pattern, $replacement, $text);
echo "Result: $result\\n";`;
      break;

    case 'split':
      code += `
$parts = preg_split($pattern, $text);
echo "Split into " . count($parts) . " parts:\\n";
foreach ($parts as $i => $part) {
    echo "[$i] \\"$part\\"\\n";
}`;
      break;
  }

  code += `
?>`;

  return { code, language: 'php', warnings };
}

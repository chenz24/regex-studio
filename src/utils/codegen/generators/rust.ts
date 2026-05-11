import type { CodeGenContext, CodeGenResult } from '../types';
import { escapeTestString, escapeReplacement } from '../escaper';
import { mapFlags } from '../flagMapper';

export function generateRust(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'rust');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in Rust regex: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  // Rust uses inline flags
  const fullPattern = flagMapping.inlinePrefix + pattern;

  // Use raw string if possible
  const useRawString = !fullPattern.includes('"#');
  const patternStr = useRawString
    ? `r#"${fullPattern}"#`
    : `"${fullPattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

  const testStr = escapeTestString(testText, 'rust');
  const replaceStr = escapeReplacement(replaceText, 'rust');

  let code = `use regex::Regex;

fn main() {
    let pattern = Regex::new(${patternStr}).unwrap();
    let text = ${testStr};
`;

  switch (operation) {
    case 'test':
      code += `
    let is_match = pattern.is_match(text);
    println!("Match: {}", is_match);`;
      break;

    case 'match':
      code += `
    if let Some(m) = pattern.find(text) {
        println!("Found: {}", m.as_str());
        println!("Index: {}-{}", m.start(), m.end());
    } else {
        println!("No match found");
    }`;
      break;

    case 'matchAll':
      code += `
    let matches: Vec<_> = pattern.find_iter(text).collect();
    println!("Found {} matches:", matches.len());
    for (i, m) in matches.iter().enumerate() {
        println!("[{}] \\"{}" at index {}", i, m.as_str(), m.start());
    }`;
      break;

    case 'capture':
      code += `
    for (i, caps) in pattern.captures_iter(text).enumerate() {
        println!("Match {}: \\"{}\\"", i + 1, &caps[0]);
        for (j, cap) in caps.iter().enumerate().skip(1) {
            if let Some(c) = cap {
                println!("  Group {}: \\"{}\\"", j, c.as_str());
            }
        }
    }`;
      break;

    case 'replace':
      code += `
    let replacement = ${replaceStr};
    let result = pattern.replace_all(text, replacement);
    println!("Result: {}", result);`;
      break;

    case 'split':
      code += `
    let parts: Vec<&str> = pattern.split(text).collect();
    println!("Split into {} parts:", parts.len());
    for (i, part) in parts.iter().enumerate() {
        println!("[{}] \\"{}\\"", i, part);
    }`;
      break;
  }

  code += `
}`;

  // Add Cargo.toml note
  warnings.push('Add `regex = "1"` to your Cargo.toml dependencies');

  return { code, language: 'rust', warnings };
}

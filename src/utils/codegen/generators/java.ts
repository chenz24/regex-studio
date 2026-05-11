import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { mapFlags } from '../flagMapper';

export function generateJava(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'java');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in Java: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  const escapedPattern = escapePattern(pattern, 'java');
  const testStr = escapeTestString(testText, 'java');
  const replaceStr = escapeReplacement(replaceText, 'java');

  const flagsArg =
    flagMapping.compileFlags.length > 0 ? `, ${flagMapping.compileFlags.join(' | ')}` : '';

  let code = `import java.util.regex.*;

public class RegexDemo {
    public static void main(String[] args) {
        Pattern pattern = Pattern.compile("${escapedPattern}"${flagsArg});
        String text = ${testStr};
`;

  switch (operation) {
    case 'test':
      code += `
        Matcher matcher = pattern.matcher(text);
        boolean isMatch = matcher.find();
        System.out.println("Match: " + isMatch);`;
      break;

    case 'match':
      code += `
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            System.out.println("Found: " + matcher.group());
            System.out.println("Index: " + matcher.start() + "-" + matcher.end());
            for (int i = 1; i <= matcher.groupCount(); i++) {
                System.out.println("Group " + i + ": " + matcher.group(i));
            }
        } else {
            System.out.println("No match found");
        }`;
      break;

    case 'matchAll':
      code += `
        Matcher matcher = pattern.matcher(text);
        int count = 0;
        while (matcher.find()) {
            System.out.printf("[%d] \\"%s\\" at index %d%n", count++, matcher.group(), matcher.start());
        }
        System.out.println("Found " + count + " matches");`;
      break;

    case 'capture':
      code += `
        Matcher matcher = pattern.matcher(text);
        int matchNum = 1;
        while (matcher.find()) {
            System.out.printf("Match %d: \\"%s\\"%n", matchNum++, matcher.group());
            for (int i = 1; i <= matcher.groupCount(); i++) {
                System.out.printf("  Group %d: \\"%s\\"%n", i, matcher.group(i));
            }
        }`;
      break;

    case 'replace':
      code += `
        String replacement = ${replaceStr};
        Matcher matcher = pattern.matcher(text);
        String result = matcher.replaceAll(replacement);
        System.out.println("Result: " + result);`;
      break;

    case 'split':
      code += `
        String[] parts = pattern.split(text);
        System.out.println("Split into " + parts.length + " parts:");
        for (int i = 0; i < parts.length; i++) {
            System.out.printf("[%d] \\"%s\\"%n", i, parts[i]);
        }`;
      break;
  }

  code += `
    }
}`;

  return { code, language: 'java', warnings };
}

import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';
import { mapFlags } from '../flagMapper';

export function generateDotNet(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const flagMapping = mapFlags(flags, 'dotnet');
  if (flagMapping.unsupportedFlags.length > 0) {
    warnings.push(`Flags not supported in .NET: ${flagMapping.unsupportedFlags.join(', ')}`);
  }

  const escapedPattern = escapePattern(pattern, 'dotnet');
  const testStr = escapeTestString(testText, 'dotnet');
  const replaceStr = escapeReplacement(replaceText, 'dotnet');

  const flagsArg =
    flagMapping.compileFlags.length > 0 ? `, ${flagMapping.compileFlags.join(' | ')}` : '';

  let code = `using System;
using System.Text.RegularExpressions;

class Program
{
    static void Main()
    {
        var pattern = new Regex(@"${escapedPattern}"${flagsArg});
        var text = ${testStr};
`;

  switch (operation) {
    case 'test':
      code += `
        var isMatch = pattern.IsMatch(text);
        Console.WriteLine($"Match: {isMatch}");`;
      break;

    case 'match':
      code += `
        var match = pattern.Match(text);
        if (match.Success)
        {
            Console.WriteLine($"Found: {match.Value}");
            Console.WriteLine($"Index: {match.Index}-{match.Index + match.Length}");
            for (int i = 1; i < match.Groups.Count; i++)
            {
                Console.WriteLine($"Group {i}: {match.Groups[i].Value}");
            }
        }
        else
        {
            Console.WriteLine("No match found");
        }`;
      break;

    case 'matchAll':
      code += `
        var matches = pattern.Matches(text);
        Console.WriteLine($"Found {matches.Count} matches:");
        for (int i = 0; i < matches.Count; i++)
        {
            Console.WriteLine($"[{i}] \\"{matches[i].Value}\\" at index {matches[i].Index}");
        }`;
      break;

    case 'capture':
      code += `
        var matches = pattern.Matches(text);
        int matchNum = 1;
        foreach (Match match in matches)
        {
            Console.WriteLine($"Match {matchNum++}: \\"{match.Value}\\"");
            for (int i = 1; i < match.Groups.Count; i++)
            {
                var group = match.Groups[i];
                var name = pattern.GroupNameFromNumber(i);
                if (name != i.ToString())
                {
                    Console.WriteLine($"  Group '{name}': \\"{group.Value}\\"");
                }
                else
                {
                    Console.WriteLine($"  Group {i}: \\"{group.Value}\\"");
                }
            }
        }`;
      break;

    case 'replace':
      code += `
        var replacement = ${replaceStr};
        var result = pattern.Replace(text, replacement);
        Console.WriteLine($"Result: {result}");`;
      break;

    case 'split':
      code += `
        var parts = pattern.Split(text);
        Console.WriteLine($"Split into {parts.Length} parts:");
        for (int i = 0; i < parts.Length; i++)
        {
            Console.WriteLine($"[{i}] \\"{parts[i]}\\"");
        }`;
      break;
  }

  code += `
    }
}`;

  return { code, language: 'csharp', warnings };
}

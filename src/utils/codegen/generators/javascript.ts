import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';

function generateScript(ctx: CodeGenContext, typed: boolean): CodeGenResult {
  const declaration = (name: string, type: string) => `const ${name}${typed ? `: ${type}` : ''}`;
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const escapedPattern = escapePattern(pattern, 'javascript');
  const testStr = escapeTestString(testText, 'javascript');
  const replaceStr = escapeReplacement(replaceText, 'javascript', pattern);

  let code = '';

  switch (operation) {
    case 'test':
      code = `${declaration('pattern', 'RegExp')} = /${escapedPattern}/${flags.replace('g', '')};
${declaration('text', 'string')} = ${testStr};

${declaration('isMatch', 'boolean')} = pattern.test(text);
console.log('Match:', isMatch);`;
      break;

    case 'match':
      code = `${declaration('pattern', 'RegExp')} = /${escapedPattern}/${flags.replace('g', '')};
${declaration('text', 'string')} = ${testStr};

${declaration('match', 'RegExpMatchArray | null')} = text.match(pattern);
if (match) {
    console.log('Found:', match[0]);
    console.log('Index:', match.index);
    console.log('Groups:', match.groups || {});
} else {
    console.log('No match found');
}`;
      break;

    case 'matchAll':
      code = `${declaration('pattern', 'RegExp')} = /${escapedPattern}/${flags.includes('g') ? flags : `${flags}g`};
${declaration('text', 'string')} = ${testStr};

${declaration('matches', 'RegExpMatchArray[]')} = [...text.matchAll(pattern)];
console.log('Found', matches.length, 'matches:');
matches.forEach((match, i) => {
    console.log(\`[\${i}] "\${match[0]}" at index \${match.index}\`);
});`;
      break;

    case 'capture':
      code = `${declaration('pattern', 'RegExp')} = /${escapedPattern}/${flags.includes('g') ? flags : `${flags}g`};
${declaration('text', 'string')} = ${testStr};

${declaration('matches', 'RegExpMatchArray[]')} = [...text.matchAll(pattern)];
matches.forEach((match, i) => {
    console.log(\`Match \${i + 1}: "\${match[0]}"\`);
    // Numbered groups
    match.slice(1).forEach((group, j) => {
        console.log(\`  Group \${j + 1}: "\${group}"\`);
    });
    // Named groups
    if (match.groups) {
        Object.entries(match.groups).forEach(([name, value]) => {
            console.log(\`  Group '\${name}': "\${value}"\`);
        });
    }
});`;
      break;

    case 'replace':
      code = `${declaration('pattern', 'RegExp')} = /${escapedPattern}/${flags};
${declaration('text', 'string')} = ${testStr};
${declaration('replacement', 'string')} = ${replaceStr};

${declaration('result', 'string')} = text.replace(pattern, replacement);
console.log('Result:', result);`;
      break;

    case 'split':
      code = `${declaration('pattern', 'RegExp')} = /${escapedPattern}/${flags.replace('g', '')};
${declaration('text', 'string')} = ${testStr};

${declaration('parts', 'string[]')} = text.split(pattern);
console.log('Split into', parts.length, 'parts:');
parts.forEach((part, i) => {
    console.log(\`[\${i}] "\${part}"\`);
});`;
      break;
  }

  return { code, language: typed ? 'typescript' : 'javascript', warnings };
}

export function generateJavaScript(ctx: CodeGenContext): CodeGenResult {
  return generateScript(ctx, false);
}

export function generateTypeScript(ctx: CodeGenContext): CodeGenResult {
  return generateScript(ctx, true);
}

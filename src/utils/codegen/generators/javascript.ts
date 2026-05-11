import type { CodeGenContext, CodeGenResult } from '../types';
import { escapePattern, escapeTestString, escapeReplacement } from '../escaper';

export function generateJavaScript(ctx: CodeGenContext): CodeGenResult {
  const { pattern, flags, testText, replaceText, operation } = ctx;
  const warnings: string[] = [];

  const escapedPattern = escapePattern(pattern, 'javascript');
  const testStr = escapeTestString(testText, 'javascript');
  const replaceStr = escapeReplacement(replaceText, 'javascript');

  let code = '';

  switch (operation) {
    case 'test':
      code = `const pattern = /${escapedPattern}/${flags.replace('g', '')};
const text = ${testStr};

const isMatch = pattern.test(text);
console.log('Match:', isMatch);`;
      break;

    case 'match':
      code = `const pattern = /${escapedPattern}/${flags.replace('g', '')};
const text = ${testStr};

const match = text.match(pattern);
if (match) {
    console.log('Found:', match[0]);
    console.log('Index:', match.index);
    console.log('Groups:', match.groups || {});
} else {
    console.log('No match found');
}`;
      break;

    case 'matchAll':
      code = `const pattern = /${escapedPattern}/${flags.includes('g') ? flags : `${flags}g`};
const text = ${testStr};

const matches = [...text.matchAll(pattern)];
console.log('Found', matches.length, 'matches:');
matches.forEach((match, i) => {
    console.log(\`[\${i}] "\${match[0]}" at index \${match.index}\`);
});`;
      break;

    case 'capture':
      code = `const pattern = /${escapedPattern}/${flags.includes('g') ? flags : `${flags}g`};
const text = ${testStr};

const matches = [...text.matchAll(pattern)];
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
      code = `const pattern = /${escapedPattern}/${flags};
const text = ${testStr};
const replacement = ${replaceStr};

const result = text.replace(pattern, replacement);
console.log('Result:', result);`;
      break;

    case 'split':
      code = `const pattern = /${escapedPattern}/${flags.replace('g', '')};
const text = ${testStr};

const parts = text.split(pattern);
console.log('Split into', parts.length, 'parts:');
parts.forEach((part, i) => {
    console.log(\`[\${i}] "\${part}"\`);
});`;
      break;
  }

  return { code, language: 'javascript', warnings };
}

export function generateTypeScript(ctx: CodeGenContext): CodeGenResult {
  const result = generateJavaScript(ctx);

  // Add type annotations
  let code = result.code;

  code = code
    .replace('const pattern =', 'const pattern: RegExp =')
    .replace('const text =', 'const text: string =')
    .replace('const replacement =', 'const replacement: string =')
    .replace('const isMatch =', 'const isMatch: boolean =')
    .replace('const match =', 'const match: RegExpMatchArray | null =')
    .replace('const matches =', 'const matches: RegExpMatchArray[] =')
    .replace('const result =', 'const result: string =')
    .replace('const parts =', 'const parts: string[] =');

  return { code, language: 'typescript', warnings: result.warnings };
}

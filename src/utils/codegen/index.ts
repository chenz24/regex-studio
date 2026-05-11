import type {
  CodeGenContext,
  CodeGenResult,
  CodeGenLanguage,
  CodeGenOperation,
  LanguageConfig,
} from './types';
import { generateJavaScript, generateTypeScript } from './generators/javascript';
import { generatePython } from './generators/python';
import { generateJava } from './generators/java';
import { generateGo } from './generators/go';
import { generateDotNet } from './generators/dotnet';
import { generateRust } from './generators/rust';
import { generatePhp } from './generators/php';
import { generateRuby } from './generators/ruby';
import { generateSwift } from './generators/swift';
import { generateKotlin } from './generators/kotlin';

export type { CodeGenContext, CodeGenResult, CodeGenLanguage, CodeGenOperation };
export { OPERATION_LABELS, OPERATION_DESCRIPTIONS } from './types';

const ALL_OPERATIONS: CodeGenOperation[] = [
  'test',
  'match',
  'matchAll',
  'capture',
  'replace',
  'split',
];

export const LANGUAGE_CONFIGS: LanguageConfig[] = [
  {
    id: 'javascript',
    name: 'JavaScript',
    highlightLang: 'javascript',
    supportedOperations: ALL_OPERATIONS,
    generate: generateJavaScript,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    highlightLang: 'typescript',
    supportedOperations: ALL_OPERATIONS,
    generate: generateTypeScript,
  },
  {
    id: 'python',
    name: 'Python',
    highlightLang: 'python',
    supportedOperations: ALL_OPERATIONS,
    generate: generatePython,
  },
  {
    id: 'java',
    name: 'Java',
    highlightLang: 'java',
    supportedOperations: ALL_OPERATIONS,
    generate: generateJava,
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    highlightLang: 'kotlin',
    supportedOperations: ALL_OPERATIONS,
    generate: generateKotlin,
  },
  {
    id: 'go',
    name: 'Go',
    highlightLang: 'go',
    supportedOperations: ALL_OPERATIONS,
    generate: generateGo,
  },
  {
    id: 'rust',
    name: 'Rust',
    highlightLang: 'rust',
    supportedOperations: ALL_OPERATIONS,
    generate: generateRust,
  },
  {
    id: 'dotnet',
    name: 'C# (.NET)',
    highlightLang: 'csharp',
    supportedOperations: ALL_OPERATIONS,
    generate: generateDotNet,
  },
  {
    id: 'php',
    name: 'PHP',
    highlightLang: 'php',
    supportedOperations: ALL_OPERATIONS,
    generate: generatePhp,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    highlightLang: 'ruby',
    supportedOperations: ALL_OPERATIONS,
    generate: generateRuby,
  },
  {
    id: 'swift',
    name: 'Swift',
    highlightLang: 'swift',
    supportedOperations: ALL_OPERATIONS,
    generate: generateSwift,
  },
];

export const LANGUAGE_MAP = new Map<CodeGenLanguage, LanguageConfig>(
  LANGUAGE_CONFIGS.map((config) => [config.id, config]),
);

/**
 * Generate code for the given context
 */
export function generateCode(ctx: CodeGenContext): CodeGenResult {
  const config = LANGUAGE_MAP.get(ctx.language);
  if (!config) {
    return {
      code: `// Language "${ctx.language}" is not supported yet`,
      language: 'text',
      warnings: [`Unsupported language: ${ctx.language}`],
    };
  }

  if (!config.supportedOperations.includes(ctx.operation)) {
    return {
      code: `// Operation "${ctx.operation}" is not supported for ${config.name}`,
      language: 'text',
      warnings: [`Operation ${ctx.operation} is not supported for ${config.name}`],
    };
  }

  return config.generate(ctx);
}

/**
 * Get the default context for code generation
 */
export function getDefaultContext(): CodeGenContext {
  return {
    pattern: '',
    flags: 'g',
    testText: '',
    replaceText: '',
    operation: 'matchAll',
    language: 'javascript',
  };
}

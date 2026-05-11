import type { RegexEngine } from '../../types/engineTypes';

export type CodeGenLanguage = RegexEngine | 'typescript' | 'php' | 'ruby' | 'swift' | 'kotlin';

export type CodeGenOperation =
  | 'test' // Check if string matches
  | 'match' // Get first match
  | 'matchAll' // Get all matches
  | 'capture' // Extract capture groups
  | 'replace' // Replace matches
  | 'split'; // Split by pattern

export interface CodeGenContext {
  pattern: string;
  flags: string;
  testText: string;
  replaceText: string;
  operation: CodeGenOperation;
  language: CodeGenLanguage;
}

export interface CodeGenResult {
  code: string;
  language: string; // Language identifier for syntax highlighting
  warnings: string[]; // Compatibility warnings
}

export interface LanguageConfig {
  id: CodeGenLanguage;
  name: string;
  highlightLang: string; // CodeMirror/Prism language identifier
  supportedOperations: CodeGenOperation[];
  generate: (ctx: CodeGenContext) => CodeGenResult;
}

export const OPERATION_LABELS: Record<CodeGenOperation, string> = {
  test: 'Test Match',
  match: 'First Match',
  matchAll: 'Find All',
  capture: 'Extract Groups',
  replace: 'Replace',
  split: 'Split',
};

export const OPERATION_DESCRIPTIONS: Record<CodeGenOperation, string> = {
  test: 'Check if the string matches the pattern',
  match: 'Find the first match in the string',
  matchAll: 'Find all matches in the string',
  capture: 'Extract named and numbered capture groups',
  replace: 'Replace matches with replacement text',
  split: 'Split the string by the pattern',
};

import type { CodeGenLanguage } from './types';

export interface FlagMapping {
  inlinePrefix: string; // Inline flags like (?i)
  compileFlags: string[]; // Compile-time flags
  globalHandling: 'flag' | 'api' | 'loop'; // How global matching is handled
  unsupportedFlags: string[];
}

/**
 * Map JavaScript regex flags to target language equivalents
 */
export function mapFlags(flags: string, lang: CodeGenLanguage): FlagMapping {
  const result: FlagMapping = {
    inlinePrefix: '',
    compileFlags: [],
    globalHandling: 'flag',
    unsupportedFlags: [],
  };

  const hasFlag = (f: string) => flags.includes(f);

  switch (lang) {
    case 'javascript':
    case 'typescript':
      // JS uses flags directly
      result.globalHandling = hasFlag('g') ? 'flag' : 'flag';
      break;

    case 'python':
      if (hasFlag('i')) result.compileFlags.push('re.IGNORECASE');
      if (hasFlag('m')) result.compileFlags.push('re.MULTILINE');
      if (hasFlag('s')) result.compileFlags.push('re.DOTALL');
      if (hasFlag('x')) result.compileFlags.push('re.VERBOSE');
      if (hasFlag('u')) result.compileFlags.push('re.UNICODE');
      result.globalHandling = hasFlag('g') ? 'api' : 'api';
      if (hasFlag('d')) result.unsupportedFlags.push('d');
      if (hasFlag('v')) result.unsupportedFlags.push('v');
      break;

    case 'java':
    case 'kotlin':
      if (hasFlag('i')) result.compileFlags.push('Pattern.CASE_INSENSITIVE');
      if (hasFlag('m')) result.compileFlags.push('Pattern.MULTILINE');
      if (hasFlag('s')) result.compileFlags.push('Pattern.DOTALL');
      if (hasFlag('x')) result.compileFlags.push('Pattern.COMMENTS');
      if (hasFlag('u')) result.compileFlags.push('Pattern.UNICODE_CASE');
      result.globalHandling = hasFlag('g') ? 'loop' : 'api';
      if (hasFlag('d')) result.unsupportedFlags.push('d');
      if (hasFlag('v')) result.unsupportedFlags.push('v');
      break;

    case 'go': {
      // Go uses inline flags
      const goInline: string[] = [];
      if (hasFlag('i')) goInline.push('i');
      if (hasFlag('m')) goInline.push('m');
      if (hasFlag('s')) goInline.push('s');
      if (goInline.length > 0) {
        result.inlinePrefix = `(?${goInline.join('')})`;
      }
      result.globalHandling = hasFlag('g') ? 'api' : 'api';
      if (hasFlag('x')) result.unsupportedFlags.push('x');
      if (hasFlag('d')) result.unsupportedFlags.push('d');
      if (hasFlag('v')) result.unsupportedFlags.push('v');
      if (hasFlag('u')) result.unsupportedFlags.push('u');
      break;
    }

    case 'dotnet':
      if (hasFlag('i')) result.compileFlags.push('RegexOptions.IgnoreCase');
      if (hasFlag('m')) result.compileFlags.push('RegexOptions.Multiline');
      if (hasFlag('s')) result.compileFlags.push('RegexOptions.Singleline');
      if (hasFlag('x')) result.compileFlags.push('RegexOptions.IgnorePatternWhitespace');
      result.globalHandling = hasFlag('g') ? 'api' : 'api';
      if (hasFlag('d')) result.unsupportedFlags.push('d');
      if (hasFlag('v')) result.unsupportedFlags.push('v');
      if (hasFlag('u')) result.unsupportedFlags.push('u');
      break;

    case 'rust': {
      // Rust uses inline flags or builder
      const rustInline: string[] = [];
      if (hasFlag('i')) rustInline.push('i');
      if (hasFlag('m')) rustInline.push('m');
      if (hasFlag('s')) rustInline.push('s');
      if (hasFlag('x')) rustInline.push('x');
      if (rustInline.length > 0) {
        result.inlinePrefix = `(?${rustInline.join('')})`;
      }
      result.globalHandling = hasFlag('g') ? 'api' : 'api';
      if (hasFlag('d')) result.unsupportedFlags.push('d');
      if (hasFlag('v')) result.unsupportedFlags.push('v');
      if (hasFlag('u')) result.unsupportedFlags.push('u');
      break;
    }

    case 'pcre2':
    case 'php':
      // PHP uses flag suffixes on pattern
      result.globalHandling = hasFlag('g') ? 'api' : 'api';
      break;

    case 'ruby':
      // Ruby uses flag suffixes on regex literal
      result.globalHandling = hasFlag('g') ? 'api' : 'api';
      break;

    case 'swift':
      if (hasFlag('i')) result.compileFlags.push('.caseInsensitive');
      if (hasFlag('m')) result.compileFlags.push('.anchorsMatchLineEndings');
      if (hasFlag('s')) result.compileFlags.push('.dotMatchesLineSeparators');
      result.globalHandling = hasFlag('g') ? 'api' : 'api';
      if (hasFlag('x')) result.unsupportedFlags.push('x');
      if (hasFlag('d')) result.unsupportedFlags.push('d');
      if (hasFlag('v')) result.unsupportedFlags.push('v');
      if (hasFlag('u')) result.unsupportedFlags.push('u');
      break;
  }

  return result;
}

/**
 * Get the flags string for JavaScript regex literal
 */
export function getJsFlags(flags: string): string {
  return flags;
}

/**
 * Get the flags suffix for PHP preg_* functions
 */
export function getPhpFlags(flags: string): string {
  let phpFlags = '';
  if (flags.includes('i')) phpFlags += 'i';
  if (flags.includes('m')) phpFlags += 'm';
  if (flags.includes('s')) phpFlags += 's';
  if (flags.includes('x')) phpFlags += 'x';
  if (flags.includes('u')) phpFlags += 'u';
  return phpFlags;
}

/**
 * Get the flags suffix for Ruby regex literal
 */
export function getRubyFlags(flags: string): string {
  let rbFlags = '';
  if (flags.includes('i')) rbFlags += 'i';
  if (flags.includes('m')) rbFlags += 'm';
  if (flags.includes('x')) rbFlags += 'x';
  return rbFlags;
}

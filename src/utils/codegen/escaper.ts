import type { CodeGenLanguage } from './types';

/**
 * Escape a regex pattern for use in different languages
 */
export function escapePattern(pattern: string, lang: CodeGenLanguage): string {
  switch (lang) {
    case 'javascript':
    case 'typescript':
      // For regex literal /.../, escape forward slashes
      return pattern.replace(/\//g, '\\/');

    case 'python':
      // For raw string r'...', escape single quotes
      return pattern.replace(/'/g, "\\'");

    case 'java':
    case 'kotlin':
      // For string "...", double backslashes and escape quotes
      return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    case 'go':
      // For raw string `...`, backticks cannot be escaped, fall back to regular string
      if (pattern.includes('`')) {
        return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      }
      return pattern; // Raw string, no escaping needed

    case 'dotnet':
      // C# verbatim string @"...", double quotes need to be doubled
      return pattern.replace(/"/g, '""');

    case 'rust':
      // For raw string r#"..."#, no escaping needed unless it contains "#
      if (pattern.includes('"#')) {
        return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      }
      return pattern;

    case 'pcre2':
    case 'php':
      // For string '...', escape single quotes and backslashes
      return pattern.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    case 'ruby':
      // For regex literal /.../, escape forward slashes
      return pattern.replace(/\//g, '\\/');

    case 'swift':
      // For string "...", escape backslashes and quotes
      return pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    default:
      return pattern;
  }
}

/**
 * Escape a test string for use in different languages
 */
export function escapeTestString(text: string, lang: CodeGenLanguage): string {
  // Truncate very long strings
  const maxLength = 200;
  const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

  switch (lang) {
    case 'javascript':
    case 'typescript':
      // Use template literal for multiline
      if (truncated.includes('\n')) {
        return `\`${truncated.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\``;
      }
      return `'${truncated.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

    case 'python':
      // Use triple quotes for multiline
      if (truncated.includes('\n')) {
        return `"""${truncated.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""`;
      }
      return `'${truncated.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

    case 'java':
    case 'kotlin':
      // Use text blocks for multiline (Java 15+, Kotlin)
      if (truncated.includes('\n')) {
        const escaped = truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"""\n${escaped}"""`;
      }
      return `"${truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

    case 'go':
      // Use raw string for multiline
      if (truncated.includes('\n') && !truncated.includes('`')) {
        return `\`${truncated}\``;
      }
      return `"${truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

    case 'dotnet':
      // Use verbatim string for multiline
      if (truncated.includes('\n')) {
        return `@"${truncated.replace(/"/g, '""')}"`;
      }
      return `"${truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    case 'rust':
      // Use raw string for complex content
      if (truncated.includes('\n') && !truncated.includes('"#')) {
        return `r#"${truncated}"#`;
      }
      return `"${truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

    case 'pcre2':
    case 'php':
      // Use heredoc for multiline
      if (truncated.includes('\n')) {
        return `<<<'TEXT'\n${truncated}\nTEXT`;
      }
      return `'${truncated.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

    case 'ruby':
      // Use heredoc for multiline
      if (truncated.includes('\n')) {
        return `<<~TEXT\n${truncated}\nTEXT`;
      }
      return `'${truncated.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

    case 'swift':
      // Use multiline string
      if (truncated.includes('\n')) {
        return `"""\n${truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\n"""`;
      }
      return `"${truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    default:
      return `"${truncated.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
}

/**
 * Escape replacement string for different languages
 */
export function escapeReplacement(replacement: string, lang: CodeGenLanguage): string {
  switch (lang) {
    case 'javascript':
    case 'typescript':
      return `'${replacement.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

    case 'python': {
      // Convert $1 to \1, $<name> to \g<name>
      const pyRepl = replacement
        .replace(/\$(\d+)/g, '\\$1')
        .replace(/\$<(\w+)>/g, '\\g<$1>')
        .replace(/\$&/g, '\\g<0>');
      return `'${pyRepl.replace(/'/g, "\\'")}'`;
    }

    case 'java':
    case 'kotlin':
      // Java uses $1, $2 and ${name}
      return `"${replacement.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    case 'go':
      // Go uses $1, ${name}
      return `"${replacement.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    case 'dotnet':
      // .NET uses $1, ${name}
      return `"${replacement.replace(/"/g, '\\"')}"`;

    case 'rust':
      // Rust uses $1, $name
      return `"${replacement.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    case 'pcre2':
    case 'php':
      // PHP uses $1, ${name}
      return `'${replacement.replace(/'/g, "\\'")}'`;

    case 'ruby': {
      // Ruby uses \1, \k<name>
      const rbRepl = replacement.replace(/\$(\d+)/g, '\\\\$1').replace(/\$<(\w+)>/g, '\\k<$1>');
      return `"${rbRepl.replace(/"/g, '\\"')}"`;
    }

    case 'swift':
      // Swift uses $1, $0
      return `"${replacement.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    default:
      return `"${replacement.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
}

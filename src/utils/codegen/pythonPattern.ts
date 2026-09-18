/** Translate JS line boundaries without changing escaped literals or classes. */
export function translatePythonPattern(pattern: string, flags: string) {
  type Scope = { multiline: boolean; dotAll: boolean };
  let scope: Scope = { multiline: flags.includes('m'), dotAll: flags.includes('s') };
  const scopes: Scope[] = [];
  let inClass = false;
  let shorthand = false;
  let ignoreCase = flags.includes('i');
  let result = '';

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      const next = pattern[++i] ?? '';
      if (/[wWdDsS]/.test(next) || (!inClass && /[bB]/.test(next))) shorthand = true;
      result += ch + next;
    } else if (inClass) {
      result += ch;
      if (ch === ']') inClass = false;
    } else if (ch === '[') {
      inClass = true;
      result += ch;
    } else if (ch === '(') {
      scopes.push(scope);
      const modifier = /^\(\?([ims]*)(?:-([ims]+))?:/.exec(pattern.slice(i));
      if (modifier) {
        const enabled = modifier[1],
          disabled = modifier[2] ?? '';
        scope = {
          multiline: enabled.includes('m') || (scope.multiline && !disabled.includes('m')),
          dotAll: enabled.includes('s') || (scope.dotAll && !disabled.includes('s')),
        };
        ignoreCase ||= enabled.includes('i');
        result += modifier[0];
        i += modifier[0].length - 1;
      } else {
        result += ch;
      }
    } else if (ch === ')') {
      scope = scopes.pop() ?? scope;
      result += ch;
    } else if (ch === '^') {
      result += scope.multiline ? String.raw`(?:\A|(?<=[\n\r\u2028\u2029]))` : String.raw`\A`;
    } else if (ch === '$') {
      result += scope.multiline ? String.raw`(?:\Z|(?=[\n\r\u2028\u2029]))` : String.raw`\Z`;
    } else if (ch === '.' && !scope.dotAll) {
      result += String.raw`[^\n\r\u2028\u2029]`;
    } else {
      result += ch;
    }
  }

  const warnings: string[] = [];
  if (shorthand)
    warnings.push(
      'Python character classes and word boundaries use different Unicode rules from JavaScript; verify non-ASCII and whitespace matches.',
    );
  if (ignoreCase)
    warnings.push(
      'Python and JavaScript use different Unicode case-folding rules; verify case-insensitive matches.',
    );
  return { pattern: result, warnings };
}

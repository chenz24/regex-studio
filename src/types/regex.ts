export interface RegexFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  /**
   * Character forwarded to JavaScript's RegExp when this flag is enabled.
   * Omitted means "display only" — toggling does not affect matching preview.
   * Only the JS-safe set (g/i/m/s/u/v/d/y) is honored at runtime.
   */
  jsFlag?: string;
}

export type ASTNodeType =
  | 'literal'
  | 'dot'
  | 'characterClass'
  | 'negatedCharacterClass'
  | 'group'
  | 'nonCapturingGroup'
  | 'lookahead'
  | 'negativeLookahead'
  | 'lookbehind'
  | 'negativeLookbehind'
  | 'namedGroup'
  | 'alternation'
  | 'quantifier'
  | 'anchor'
  | 'backreference'
  | 'escape'
  | 'range'
  | 'sequence';

export interface ASTNode {
  type: ASTNodeType;
  value: string;
  children?: ASTNode[];
  quantifier?: QuantifierInfo;
  groupName?: string;
  groupIndex?: number;
  raw: string;
  id: string;
  start: number;
  end: number;
}

export interface QuantifierInfo {
  min: number;
  max: number | null;
  lazy: boolean;
  raw: string;
}

export interface MatchInfo {
  index: number;
  match: string;
  groups: GroupInfo[];
  start: number;
  end: number;
}

export interface GroupInfo {
  name: string | null;
  index: number;
  value: string | undefined;
  start: number;
  end: number;
}

export interface ExplanationToken {
  raw: string;
  description: string;
  type: 'meta' | 'literal' | 'quantifier' | 'group' | 'anchor' | 'class' | 'escape' | 'flag';
  children?: ExplanationToken[];
}

export interface DiagramNode {
  id: string;
  type: ASTNodeType;
  label: string;
  sublabel?: string;
  children?: DiagramNode[];
  quantifier?: QuantifierInfo;
  width: number;
  height: number;
  x: number;
  y: number;
}

export type TestExpectation = 'match' | 'noMatch';

export interface TestCase {
  id: string;
  label: string;
  input: string;
  expect: TestExpectation;
}

export interface TestCaseResult {
  id: string;
  pass: boolean;
  matchCount: number;
  /** True when the regex itself is invalid; result is inconclusive. */
  invalid: boolean;
}

export interface PatternTemplate {
  name: string;
  pattern: string;
  flags: string;
  description: string;
  category: string;
  /** Optional i18n keys (preferred over `name`/`description`/`category` when present). */
  nameKey?: string;
  descKey?: string;
  categoryKey?: string;
}

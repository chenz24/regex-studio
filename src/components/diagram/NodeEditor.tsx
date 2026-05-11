import { useState, useCallback, useMemo } from 'react';
import { X, Trash2, Plus, Brackets, Repeat, Type } from 'lucide-react';
import type { ASTNode } from '../../types/regex';
import {
  findNodeById,
  deleteNodeFromPattern,
  replaceNodeInPattern,
  insertBeforeNode,
  insertAfterNode,
  wrapNodeInGroup,
  changeQuantifier,
} from '../../utils/patternEditor';
import { useT, type Messages } from '@/lib/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown } from 'lucide-react';

/** Wrap any element with a tooltip (using shadcn primitives). */
function Hint({
  label,
  side = 'top',
  children,
}: {
  label: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

interface NodeEditorProps {
  ast: ASTNode;
  selectedNodeId: string | null;
  pattern: string;
  onPatternChange: (pattern: string) => void;
  onClose: () => void;
}

type Opt = { label: string; value: string; hint: string };

function buildQuantifierOptions(t: Messages): Opt[] {
  return [
    { label: t.quant_none_label(), value: '', hint: t.quant_none_hint() },
    { label: t.quant_optional_label(), value: '?', hint: t.quant_optional_hint() },
    { label: t.quant_star_label(), value: '*', hint: t.quant_star_hint() },
    { label: t.quant_plus_label(), value: '+', hint: t.quant_plus_hint() },
    { label: t.quant_star_lazy_label(), value: '*?', hint: t.quant_star_lazy_hint() },
    { label: t.quant_plus_lazy_label(), value: '+?', hint: t.quant_plus_lazy_hint() },
    { label: t.quant_optional_lazy_label(), value: '??', hint: t.quant_optional_lazy_hint() },
  ];
}

function buildInsertOptions(t: Messages): Opt[] {
  return [
    { label: t.insert_char_label(), value: 'a', hint: t.insert_char_hint() },
    { label: t.insert_dot_label(), value: '.', hint: t.insert_dot_hint() },
    { label: t.insert_digit_label(), value: '\\d', hint: t.insert_digit_hint() },
    { label: t.insert_word_label(), value: '\\w', hint: t.insert_word_hint() },
    { label: t.insert_space_label(), value: '\\s', hint: t.insert_space_hint() },
    { label: t.insert_group_label(), value: '()', hint: t.insert_group_hint() },
    { label: t.insert_set_label(), value: '[]', hint: t.insert_set_hint() },
  ];
}

function getNodeDescription(node: ASTNode, t: Messages): string {
  switch (node.type) {
    case 'literal':
      return t.node_desc_literal({ char: node.value });
    case 'dot':
      return t.node_desc_dot();
    case 'escape': {
      const map: Record<string, () => string> = {
        '\\d': () => t.node_desc_escape_d(),
        '\\D': () => t.node_desc_escape_D(),
        '\\w': () => t.node_desc_escape_w(),
        '\\W': () => t.node_desc_escape_W(),
        '\\s': () => t.node_desc_escape_s(),
        '\\S': () => t.node_desc_escape_S(),
        '\\b': () => t.node_desc_escape_b(),
        '\\B': () => t.node_desc_escape_B(),
      };
      const fn = map[node.value];
      return fn ? fn() : t.node_desc_escape_other({ value: node.value });
    }
    case 'anchor':
      return node.value === '^' ? t.node_desc_anchor_start() : t.node_desc_anchor_end();
    case 'characterClass':
      return t.node_desc_char_class({ raw: node.raw });
    case 'negatedCharacterClass':
      return t.node_desc_negated_class({ raw: node.raw });
    case 'group':
      return t.node_desc_group({ idx: String(node.groupIndex ?? '') });
    case 'nonCapturingGroup':
      return t.node_desc_noncap_group();
    case 'namedGroup':
      return t.node_desc_named_group({ name: node.groupName ?? '' });
    case 'lookahead':
      return t.node_desc_lookahead();
    case 'negativeLookahead':
      return t.node_desc_neg_lookahead();
    case 'lookbehind':
      return t.node_desc_lookbehind();
    case 'negativeLookbehind':
      return t.node_desc_neg_lookbehind();
    case 'alternation':
      return t.node_desc_alternation();
    case 'quantifier':
      return t.node_desc_quantifier({ raw: node.quantifier?.raw ?? '' });
    case 'backreference':
      return t.node_desc_backreference({ n: node.value });
    default:
      return node.raw;
  }
}

interface Suggestion {
  label: string;
  value: string;
  hint?: string;
}

/**
 * Compute context-aware Replace suggestions for the given node.
 * `pattern` is used when we need to extract inner text (e.g. group body).
 */
function getReplaceSuggestions(node: ASTNode, pattern: string): Suggestion[] {
  switch (node.type) {
    case 'literal':
      return [
        { label: '.', value: '.', hint: 'any char' },
        { label: '\\d', value: '\\d', hint: 'digit' },
        { label: '\\w', value: '\\w', hint: 'word' },
        { label: '\\s', value: '\\s', hint: 'space' },
        { label: '[a-z]', value: '[a-z]' },
        { label: '[A-Z]', value: '[A-Z]' },
        { label: '[0-9]', value: '[0-9]' },
      ];
    case 'dot':
      return [
        { label: '\\d', value: '\\d' },
        { label: '\\w', value: '\\w' },
        { label: '\\s', value: '\\s' },
        { label: '[^\\n]', value: '[^\\n]', hint: 'any except newline' },
      ];
    case 'escape': {
      const map: Record<string, string[]> = {
        '\\d': ['\\D', '[0-9]', '\\w', '.'],
        '\\D': ['\\d', '[^0-9]'],
        '\\w': ['\\W', '[a-zA-Z0-9_]', '\\d'],
        '\\W': ['\\w', '[^a-zA-Z0-9_]'],
        '\\s': ['\\S', '[ \\t\\n]'],
        '\\S': ['\\s'],
        '\\b': ['\\B'],
        '\\B': ['\\b'],
        '\\n': ['\\r', '\\t', '\\s'],
        '\\t': ['\\s', '\\n'],
      };
      const alts = map[node.value] || [];
      return alts.map((v) => ({ label: v, value: v }));
    }
    case 'anchor':
      return node.value === '^'
        ? [
            { label: '$', value: '$', hint: 'end' },
            { label: '\\b', value: '\\b', hint: 'word boundary' },
          ]
        : [
            { label: '^', value: '^', hint: 'start' },
            { label: '\\b', value: '\\b', hint: 'word boundary' },
          ];
    case 'characterClass': {
      const body = node.raw.slice(1, -1); // strip [ ]
      return [
        { label: `[^${body}]`, value: `[^${body}]`, hint: 'negate' },
        { label: '\\w', value: '\\w' },
        { label: '\\d', value: '\\d' },
        { label: '\\s', value: '\\s' },
        { label: '.', value: '.' },
      ];
    }
    case 'negatedCharacterClass': {
      const body = node.raw.slice(2, -1); // strip [^ ]
      return [{ label: `[${body}]`, value: `[${body}]`, hint: 'un-negate' }];
    }
    case 'group':
    case 'nonCapturingGroup':
    case 'namedGroup': {
      // Extract inner body (between outer parens, skipping any group prefix).
      const child = node.children?.[0];
      const inner = child
        ? pattern.slice(child.start, child.end)
        : pattern.slice(node.start + 1, node.end - 1);
      const out: Suggestion[] = [];
      if (node.type !== 'group')
        out.push({ label: `(${inner})`, value: `(${inner})`, hint: 'capturing' });
      if (node.type !== 'nonCapturingGroup')
        out.push({ label: `(?:${inner})`, value: `(?:${inner})`, hint: 'non-capturing' });
      if (node.type !== 'namedGroup')
        out.push({ label: `(?<name>${inner})`, value: `(?<name>${inner})`, hint: 'named' });
      return out;
    }
    case 'lookahead':
    case 'negativeLookahead':
    case 'lookbehind':
    case 'negativeLookbehind': {
      const child = node.children?.[0];
      const inner = child
        ? pattern.slice(child.start, child.end)
        : pattern.slice(node.start + 1, node.end - 1);
      const variants: { t: ASTNode['type']; v: string; hint: string }[] = [
        { t: 'lookahead', v: `(?=${inner})`, hint: 'lookahead' },
        { t: 'negativeLookahead', v: `(?!${inner})`, hint: 'neg lookahead' },
        { t: 'lookbehind', v: `(?<=${inner})`, hint: 'lookbehind' },
        { t: 'negativeLookbehind', v: `(?<!${inner})`, hint: 'neg lookbehind' },
      ];
      return variants
        .filter((x) => x.t !== node.type)
        .map((x) => ({ label: x.v, value: x.v, hint: x.hint }));
    }
    case 'backreference': {
      // Suggest other group indices present in the current pattern.
      const refs: Suggestion[] = [];
      const groupCount = (pattern.match(/\((?!\?)/g) || []).length;
      for (let i = 1; i <= Math.min(groupCount, 9); i++) {
        if (String(i) !== node.value) refs.push({ label: `\\${i}`, value: `\\${i}` });
      }
      return refs;
    }
    default:
      return [];
  }
}

// Global flat list used as the "Common" group inside the Combobox.
const COMMON_TOKENS: Suggestion[] = [
  { label: '.', value: '.', hint: 'any char' },
  { label: '\\d', value: '\\d', hint: 'digit' },
  { label: '\\D', value: '\\D', hint: 'non-digit' },
  { label: '\\w', value: '\\w', hint: 'word' },
  { label: '\\W', value: '\\W', hint: 'non-word' },
  { label: '\\s', value: '\\s', hint: 'space' },
  { label: '\\S', value: '\\S', hint: 'non-space' },
  { label: '\\b', value: '\\b', hint: 'word boundary' },
  { label: '\\B', value: '\\B', hint: 'non-boundary' },
  { label: '\\n', value: '\\n', hint: 'newline' },
  { label: '\\t', value: '\\t', hint: 'tab' },
  { label: '\\r', value: '\\r', hint: 'cr' },
  { label: '^', value: '^', hint: 'start' },
  { label: '$', value: '$', hint: 'end' },
  { label: '[a-z]', value: '[a-z]' },
  { label: '[A-Z]', value: '[A-Z]' },
  { label: '[0-9]', value: '[0-9]' },
  { label: '[a-zA-Z]', value: '[a-zA-Z]' },
  { label: '[a-zA-Z0-9_]', value: '[a-zA-Z0-9_]' },
  { label: '()', value: '()', hint: 'group' },
  { label: '(?:)', value: '(?:)', hint: 'non-capturing' },
  { label: '(?<name>)', value: '(?<name>)', hint: 'named group' },
  { label: '(?=)', value: '(?=)', hint: 'lookahead' },
  { label: '(?!)', value: '(?!)', hint: 'neg lookahead' },
  { label: '(?<=)', value: '(?<=)', hint: 'lookbehind' },
  { label: '(?<!)', value: '(?<!)', hint: 'neg lookbehind' },
];

export function NodeEditor({
  ast,
  selectedNodeId,
  pattern,
  onPatternChange,
  onClose,
}: NodeEditorProps) {
  const t = useT();
  const [editValue, setEditValue] = useState('');
  const [replacePopoverOpen, setReplacePopoverOpen] = useState(false);
  const [showInsertBefore, setShowInsertBefore] = useState(false);
  const [showInsertAfter, setShowInsertAfter] = useState(false);
  const [customInsertBefore, setCustomInsertBefore] = useState('');
  const [customInsertAfter, setCustomInsertAfter] = useState('');
  const QUANTIFIER_OPTIONS = useMemo(() => buildQuantifierOptions(t), [t]);
  const INSERT_OPTIONS = useMemo(() => buildInsertOptions(t), [t]);

  const node = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeById(ast, selectedNodeId);
  }, [ast, selectedNodeId]);

  const handleDelete = useCallback(() => {
    if (!node) return;
    const newPattern = deleteNodeFromPattern(pattern, node);
    onPatternChange(newPattern);
    onClose();
  }, [node, pattern, onPatternChange, onClose]);

  const handleReplace = useCallback(() => {
    if (!node || !editValue) return;
    const newPattern = replaceNodeInPattern(pattern, node, editValue);
    onPatternChange(newPattern);
    setEditValue('');
  }, [node, editValue, pattern, onPatternChange]);

  const handleReplaceWith = useCallback(
    (value: string) => {
      if (!node || !value) return;
      const newPattern = replaceNodeInPattern(pattern, node, value);
      onPatternChange(newPattern);
      setEditValue('');
      setReplacePopoverOpen(false);
    },
    [node, pattern, onPatternChange],
  );

  const handleInsertBefore = useCallback(
    (text: string) => {
      if (!node || !text) return;
      const newPattern = insertBeforeNode(pattern, node, text);
      onPatternChange(newPattern);
      setShowInsertBefore(false);
      setCustomInsertBefore('');
    },
    [node, pattern, onPatternChange],
  );

  const handleInsertAfter = useCallback(
    (text: string) => {
      if (!node || !text) return;
      const newPattern = insertAfterNode(pattern, node, text);
      onPatternChange(newPattern);
      setShowInsertAfter(false);
      setCustomInsertAfter('');
    },
    [node, pattern, onPatternChange],
  );

  const handleWrapInGroup = useCallback(
    (type: 'capturing' | 'nonCapturing' | 'named') => {
      if (!node) return;
      const newPattern = wrapNodeInGroup(pattern, node, type);
      onPatternChange(newPattern);
    },
    [node, pattern, onPatternChange],
  );

  const handleQuantifier = useCallback(
    (q: string) => {
      if (!node) return;
      const newPattern = changeQuantifier(pattern, node, q);
      onPatternChange(newPattern);
    },
    [node, pattern, onPatternChange],
  );

  if (!node) return null;

  const currentRaw = pattern.slice(node.start, node.end);
  const desc = getNodeDescription(node, t);
  const isGroupType = ['group', 'nonCapturingGroup', 'namedGroup'].includes(node.type);
  const hasQuantifier = node.type === 'quantifier';
  const canHaveQuantifier =
    !['anchor', 'alternation', 'sequence'].includes(node.type) && !hasQuantifier;
  const replaceSuggestions = getReplaceSuggestions(node, pattern);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              {t.node_editor_title()}
            </span>
          </div>
          <Hint label={t.node_editor_close_hint()}>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </Hint>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{desc}</div>
              <code className="text-xs font-mono text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                {currentRaw}
              </code>
            </div>
            <Hint label={t.node_editor_delete_hint()} side="left">
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Hint>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Type className="w-3.5 h-3.5" />
              {t.node_editor_replace_label()}
            </div>
            <Popover open={replacePopoverOpen} onOpenChange={setReplacePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 text-sm font-mono px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 hover:border-teal-400 dark:hover:border-teal-500 transition-colors"
                >
                  <span
                    className={editValue ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}
                  >
                    {editValue || t.node_editor_replace_placeholder({ raw: currentRaw })}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
              >
                <Command
                  shouldFilter
                  filter={(value, search) => {
                    if (!search) return 1;
                    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                  }}
                >
                  <CommandInput
                    placeholder={t.node_editor_input_placeholder()}
                    value={editValue}
                    onValueChange={setEditValue}
                    onKeyDown={(e) => {
                      // If the user typed something that doesn't match any item,
                      // Enter applies the raw typed value as a free-form replacement.
                      if (e.key === 'Enter') {
                        const list = e.currentTarget
                          .closest('[data-slot=command]')
                          ?.querySelector('[data-slot=command-item][data-selected=true]');
                        if (!list && editValue) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReplaceWith(editValue);
                        }
                      }
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {editValue ? (
                        <>
                          {t.node_editor_press_enter_prefix()}
                          <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                            Enter
                          </kbd>
                          {t.node_editor_press_enter_suffix()}
                          <code className="font-mono text-teal-600 dark:text-teal-400">
                            {editValue}
                          </code>
                        </>
                      ) : (
                        t.node_editor_no_results()
                      )}
                    </CommandEmpty>
                    {replaceSuggestions.length > 0 && (
                      <CommandGroup heading={t.node_editor_suggested_heading()}>
                        {replaceSuggestions.map((s) => (
                          <CommandItem
                            key={`ctx-${s.value}`}
                            value={`${s.value} ${s.label} ${s.hint ?? ''}`}
                            onSelect={() => handleReplaceWith(s.value)}
                          >
                            <code className="font-mono text-teal-600 dark:text-teal-400">
                              {s.label}
                            </code>
                            {s.hint && (
                              <span className="ml-auto text-[10px] text-gray-400">{s.hint}</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    <CommandGroup heading={t.node_editor_common_heading()}>
                      {COMMON_TOKENS.map((s) => (
                        <CommandItem
                          key={`common-${s.value}`}
                          value={`${s.value} ${s.label} ${s.hint ?? ''}`}
                          onSelect={() => handleReplaceWith(s.value)}
                        >
                          <code className="font-mono">{s.label}</code>
                          {s.hint && (
                            <span className="ml-auto text-[10px] text-gray-400">{s.hint}</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {editValue && (
              <button
                onClick={handleReplace}
                className="w-full text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors"
              >
                {t.node_editor_apply()} <code className="font-mono ml-1 opacity-90">{editValue}</code>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Hint label={t.node_editor_insert_before_hint()}>
                <button
                  onClick={() => setShowInsertBefore(!showInsertBefore)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Plus className="w-3 h-3" /> {t.node_editor_insert_before_label()}
                </button>
              </Hint>
              {showInsertBefore && (
                <div className="space-y-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  {INSERT_OPTIONS.map((opt) => (
                    <Hint key={opt.value} label={opt.hint} side="right">
                      <button
                        onClick={() => handleInsertBefore(opt.value)}
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 text-gray-600 dark:text-gray-300 font-mono transition-colors"
                      >
                        {opt.label}
                      </button>
                    </Hint>
                  ))}
                  <div className="flex gap-1 mt-1">
                    <input
                      value={customInsertBefore}
                      onChange={(e) => setCustomInsertBefore(e.target.value)}
                      placeholder={t.node_editor_custom_placeholder()}
                      className="flex-1 text-xs font-mono px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
                    />
                    <Hint label={t.node_editor_insert_before_apply_hint()}>
                      <button
                        onClick={() => handleInsertBefore(customInsertBefore)}
                        disabled={!customInsertBefore}
                        className="text-xs px-2 py-1 rounded bg-teal-500 text-white disabled:opacity-40"
                      >
                        {t.node_editor_go_btn()}
                      </button>
                    </Hint>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Hint label={t.node_editor_insert_after_hint()}>
                <button
                  onClick={() => setShowInsertAfter(!showInsertAfter)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Plus className="w-3 h-3" /> {t.node_editor_insert_after_label()}
                </button>
              </Hint>
              {showInsertAfter && (
                <div className="space-y-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  {INSERT_OPTIONS.map((opt) => (
                    <Hint key={opt.value} label={opt.hint} side="left">
                      <button
                        onClick={() => handleInsertAfter(opt.value)}
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 text-gray-600 dark:text-gray-300 font-mono transition-colors"
                      >
                        {opt.label}
                      </button>
                    </Hint>
                  ))}
                  <div className="flex gap-1 mt-1">
                    <input
                      value={customInsertAfter}
                      onChange={(e) => setCustomInsertAfter(e.target.value)}
                      placeholder={t.node_editor_custom_placeholder()}
                      className="flex-1 text-xs font-mono px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
                    />
                    <Hint label={t.node_editor_insert_after_apply_hint()}>
                      <button
                        onClick={() => handleInsertAfter(customInsertAfter)}
                        disabled={!customInsertAfter}
                        className="text-xs px-2 py-1 rounded bg-teal-500 text-white disabled:opacity-40"
                      >
                        {t.node_editor_go_btn()}
                      </button>
                    </Hint>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isGroupType && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <Brackets className="w-3.5 h-3.5" />
                {t.node_editor_wrap_in_group()}
              </div>
              <div className="flex gap-1.5">
                <Hint label={t.node_editor_wrap_capturing_hint()}>
                  <button
                    onClick={() => handleWrapInGroup('capturing')}
                    className="flex-1 text-xs font-medium px-2 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    (...)
                  </button>
                </Hint>
                <Hint label={t.node_editor_wrap_noncap_hint()}>
                  <button
                    onClick={() => handleWrapInGroup('nonCapturing')}
                    className="flex-1 text-xs font-medium px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    (?:...)
                  </button>
                </Hint>
              </div>
            </div>
          )}

          {(canHaveQuantifier || hasQuantifier) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <Repeat className="w-3.5 h-3.5" />
                {t.node_editor_quantifier()}
              </div>
              <div className="flex flex-wrap gap-1">
                {QUANTIFIER_OPTIONS.map((opt) => (
                  <Hint key={opt.value} label={opt.hint}>
                    <button
                      onClick={() => handleQuantifier(opt.value)}
                      className="text-xs font-mono px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                    >
                      {opt.label}
                    </button>
                  </Hint>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-gray-400 dark:text-gray-500 pt-1">
            {t.node_editor_position({ start: String(node.start), end: String(node.end) })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

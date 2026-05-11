import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useT, type Messages } from '@/lib/i18n';

interface RefItem {
  token: string;
  descKey: keyof Messages;
}
interface RefSection {
  id: string;
  titleKey: keyof Messages;
  items: RefItem[];
}

const REFERENCE: RefSection[] = [
  {
    id: 'char_classes',
    titleKey: 'qref_section_char_classes',
    items: [
      { token: '.', descKey: 'qref_cc_dot' },
      { token: '\\w', descKey: 'qref_cc_word' },
      { token: '\\W', descKey: 'qref_cc_nonword' },
      { token: '\\d', descKey: 'qref_cc_digit' },
      { token: '\\D', descKey: 'qref_cc_nondigit' },
      { token: '\\s', descKey: 'qref_cc_space' },
      { token: '\\S', descKey: 'qref_cc_nonspace' },
      { token: '[abc]', descKey: 'qref_cc_set' },
      { token: '[^abc]', descKey: 'qref_cc_negset' },
      { token: '[a-z]', descKey: 'qref_cc_range' },
    ],
  },
  {
    id: 'anchors',
    titleKey: 'qref_section_anchors',
    items: [
      { token: '^', descKey: 'qref_an_start' },
      { token: '$', descKey: 'qref_an_end' },
      { token: '\\b', descKey: 'qref_an_wb' },
      { token: '\\B', descKey: 'qref_an_nwb' },
    ],
  },
  {
    id: 'quantifiers',
    titleKey: 'qref_section_quantifiers',
    items: [
      { token: '*', descKey: 'qref_qt_star' },
      { token: '+', descKey: 'qref_qt_plus' },
      { token: '?', descKey: 'qref_qt_optional' },
      { token: '{n}', descKey: 'qref_qt_exact' },
      { token: '{n,}', descKey: 'qref_qt_min' },
      { token: '{n,m}', descKey: 'qref_qt_minmax' },
      { token: '*?', descKey: 'qref_qt_starlazy' },
      { token: '+?', descKey: 'qref_qt_pluslazy' },
    ],
  },
  {
    id: 'groups_refs',
    titleKey: 'qref_section_groups_refs',
    items: [
      { token: '(abc)', descKey: 'qref_gr_capture' },
      { token: '(?:abc)', descKey: 'qref_gr_noncap' },
      { token: '(?<name>abc)', descKey: 'qref_gr_named' },
      { token: '\\1', descKey: 'qref_gr_backref' },
      { token: '(?=abc)', descKey: 'qref_gr_la' },
      { token: '(?!abc)', descKey: 'qref_gr_nla' },
      { token: '(?<=abc)', descKey: 'qref_gr_lb' },
      { token: '(?<!abc)', descKey: 'qref_gr_nlb' },
    ],
  },
  {
    id: 'escaped',
    titleKey: 'qref_section_escaped',
    items: [
      { token: '\\n', descKey: 'qref_es_newline' },
      { token: '\\t', descKey: 'qref_es_tab' },
      { token: '\\r', descKey: 'qref_es_cr' },
      { token: '\\\\.', descKey: 'qref_es_special' },
    ],
  },
  {
    id: 'flags',
    titleKey: 'qref_section_flags',
    items: [
      { token: 'g', descKey: 'qref_fl_g' },
      { token: 'i', descKey: 'qref_fl_i' },
      { token: 'm', descKey: 'qref_fl_m' },
      { token: 's', descKey: 'qref_fl_s' },
      { token: 'u', descKey: 'qref_fl_u' },
    ],
  },
];

function getMsg(t: Messages, key: keyof Messages): string {
  const fn = t[key] as unknown as () => string;
  return fn();
}

export function QuickReference() {
  const t = useT();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    char_classes: true,
    quantifiers: true,
  });

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-1">
      {REFERENCE.map((section) => (
        <div key={section.id}>
          <button
            onClick={() => toggle(section.id)}
            className="w-full flex items-center gap-2 py-2 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md transition-colors"
          >
            {expanded[section.id] ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )}
            {getMsg(t, section.titleKey)}
          </button>

          {expanded[section.id] && (
            <div className="ml-2 mb-2">
              {section.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <code className="shrink-0 w-20 text-right font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                    {item.token}
                  </code>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getMsg(t, item.descKey)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

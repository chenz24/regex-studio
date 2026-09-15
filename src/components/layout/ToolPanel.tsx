import { lazy, Suspense } from 'react';
import { BookOpen, Bug, ArrowRightLeft, FileJson, List, Code2, FlaskConical } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useT } from '@/lib/i18n';
import { DebuggerPanel } from '../tools/DebuggerPanel';
import { EngineCapabilityNotice } from '../EngineCapabilityNotice';

// Only the debugger is on screen at startup. Radix unmounts the inactive
// panels, so the rest cost nothing until their tab is opened — including the
// code generator, which carries a generator for each of ten languages.
const ExplanationPanel = lazy(() =>
  import('../tools/ExplanationPanel').then((m) => ({ default: m.ExplanationPanel })),
);
const ReplacePanel = lazy(() =>
  import('../tools/ReplacePanel').then((m) => ({ default: m.ReplacePanel })),
);
const MatchDetails = lazy(() =>
  import('../tools/MatchDetails').then((m) => ({ default: m.MatchDetails })),
);
const CodeGeneratorPanel = lazy(() =>
  import('../tools/CodeGeneratorPanel').then((m) => ({ default: m.CodeGeneratorPanel })),
);
const TestCasesPanel = lazy(() =>
  import('../tools/TestCasesPanel').then((m) => ({ default: m.TestCasesPanel })),
);

function PanelFallback() {
  return <div className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/60" />;
}
import type { ASTNode, MatchInfo, TestCase, TestCaseResult } from '../../types/regex';
import type { ToolPanelTab } from '@/tutorial/types';

interface ToolPanelProps {
  visualizationSupported?: boolean;
  visualizationReason?: string;
  executionEngine: 'javascript' | 'pcre2';
  replacementError?: string;
  pending?: boolean;
  ast: ASTNode;
  pattern: string;
  testText: string;
  flagString: string;
  /** Flags actually forwarded to the engine (JS-safe subset). */
  jsFlagString: string;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  replacement: string;
  onReplacementChange: (value: string) => void;
  replacedText: string;
  matchCount: number;
  matches: MatchInfo[];
  selectedMatch: number | null;
  onSelectMatch: (index: number | null) => void;
  testCases: TestCase[];
  testResults: TestCaseResult[];
  testsPassed: number;
  onAddTestCase: (init?: Partial<Omit<TestCase, 'id'>>) => void;
  onUpdateTestCase: (id: string, patch: Partial<Omit<TestCase, 'id'>>) => void;
  onRemoveTestCase: (id: string) => void;
  onLoadTestCaseInput: (input: string) => void;
  /** Controlled active tab — used by the tutorial to force-open a panel. */
  activeTab?: ToolPanelTab;
  onActiveTabChange?: (tab: ToolPanelTab) => void;
  /** Tutorial spotlight forwarded to ExplanationPanel. */
  spotlightNodeIds?: Set<string>;
  spotlightFirstNodeId?: string | null;
}

export function ToolPanel({
  visualizationSupported = true,
  visualizationReason,
  executionEngine,
  replacementError,
  pending,
  ast,
  pattern,
  testText,
  flagString,
  jsFlagString,
  hoveredNodeId,
  onHoverNode,
  replacement,
  onReplacementChange,
  replacedText,
  matchCount,
  matches,
  selectedMatch,
  onSelectMatch,
  testCases,
  testResults,
  testsPassed,
  onAddTestCase,
  onUpdateTestCase,
  onRemoveTestCase,
  onLoadTestCaseInput,
  activeTab,
  onActiveTabChange,
  spotlightNodeIds,
  spotlightFirstNodeId,
}: ToolPanelProps) {
  const t = useT();
  const totalTests = testCases.length;
  const allPass = totalTests > 0 && testsPassed === totalTests;
  // Controlled when consumer passes activeTab; otherwise fall back to default.
  const tabsProps = activeTab
    ? { value: activeTab, onValueChange: (v: string) => onActiveTabChange?.(v as ToolPanelTab) }
    : { defaultValue: 'debugger' as const };
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 overflow-hidden shadow-sm h-full">
      <Tabs {...tabsProps} className="h-full gap-0 flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-700/80 px-3 p-1.5">
          <TabsList className="bg-gray-100 dark:bg-gray-800 h-8 rounded-lg">
            <TabsTrigger
              value="debugger"
              className="text-xs gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-md px-2.5"
            >
              <Bug className="w-3 h-3" />
              {t.tab_debugger()}
            </TabsTrigger>
            <TabsTrigger
              value="matches"
              className="text-xs gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-md px-2.5"
            >
              <List className="w-3 h-3" />
              {t.tab_matches()}
              <span className="px-1.5 py-0 text-[10px] font-medium rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                {matchCount}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="explanation"
              className="text-xs gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-md px-2.5"
            >
              <BookOpen className="w-3 h-3" />
              {t.tab_explanation()}
            </TabsTrigger>
            <TabsTrigger
              value="tests"
              className="text-xs gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-md px-2.5"
            >
              <FlaskConical className="w-3 h-3" />
              {t.tab_tests()}
              {totalTests > 0 && (
                <span
                  className={`px-1.5 py-0 text-[10px] font-medium rounded-full ${
                    allPass
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}
                >
                  {testsPassed}/{totalTests}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="replace"
              className="text-xs gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-md px-2.5"
            >
              <ArrowRightLeft className="w-3 h-3" />
              {t.tab_replace()}
            </TabsTrigger>
            <TabsTrigger
              value="codegen"
              className="text-xs gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-md px-2.5"
            >
              <Code2 className="w-3 h-3" />
              {t.tab_codegen()}
            </TabsTrigger>
            <TabsTrigger
              value="ast"
              className="text-xs gap-1 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm rounded-md px-2.5"
            >
              <FileJson className="w-3 h-3" />
              {t.tab_ast()}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[200px]">
          <TabsContent value="debugger" className="p-3 mt-0">
            {executionEngine === 'pcre2' ? (
              <EngineCapabilityNotice debuggerOnly />
            ) : (
              <DebuggerPanel
                ast={ast}
                pattern={pattern}
                testText={testText}
                flagString={jsFlagString}
              />
            )}
          </TabsContent>

          <TabsContent value="matches" className="p-3 mt-0">
            <Suspense fallback={<PanelFallback />}>
              <MatchDetails
                matches={matches}
                selectedMatch={selectedMatch}
                onSelectMatch={onSelectMatch}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="explanation" className="p-3 mt-0">
            <Suspense fallback={<PanelFallback />}>
              {!visualizationSupported ? (
                <EngineCapabilityNotice reason={visualizationReason} />
              ) : (
                <ExplanationPanel
                  ast={ast}
                  hoveredNodeId={hoveredNodeId}
                  onHoverNode={onHoverNode}
                  spotlightNodeIds={spotlightNodeIds}
                  spotlightFirstNodeId={spotlightFirstNodeId}
                />
              )}
            </Suspense>
          </TabsContent>

          <TabsContent value="tests" className="p-3 mt-0">
            <Suspense fallback={<PanelFallback />}>
              <TestCasesPanel
                testCases={testCases}
                testResults={testResults}
                currentTestText={testText}
                onAdd={onAddTestCase}
                onUpdate={onUpdateTestCase}
                onRemove={onRemoveTestCase}
                onLoadIntoEditor={onLoadTestCaseInput}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="replace" className="p-3 mt-0">
            <Suspense fallback={<PanelFallback />}>
              <ReplacePanel
                executionEngine={executionEngine}
                error={replacementError}
                pending={pending}
                replacement={replacement}
                onReplacementChange={onReplacementChange}
                replacedText={replacedText}
                matchCount={matchCount}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="codegen" className="p-3 mt-0">
            {executionEngine === 'pcre2' && (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
                {t.pcre2_codegen_notice()}
              </p>
            )}
            <Suspense fallback={<PanelFallback />}>
              <CodeGeneratorPanel
                pattern={pattern}
                flags={flagString}
                testText={testText}
                replacement={replacement}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="ast" className="p-3 mt-0">
            {!visualizationSupported ? (
              <EngineCapabilityNotice reason={visualizationReason} />
            ) : (
              <pre className="text-xs font-mono text-teal-700 dark:text-teal-300 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto custom-scrollbar leading-relaxed max-h-[600px]">
                {JSON.stringify(ast, null, 2)}
              </pre>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Library, FileText, X } from 'lucide-react';
import { useRegexStore, useRegexDerived } from './stores/regexStore';
import { useTheme } from './hooks/useTheme';
import { RegexInput } from './components/editor/RegexInput';
import { TestArea } from './components/layout/TestArea';
import { Footer } from './components/layout/Footer';
import { RailroadBanner } from './components/diagram/RailroadBanner';
import { ToolPanel } from './components/layout/ToolPanel';
import { QuickReference } from './components/sidebar/QuickReference';
import { PatternLibrary } from './components/sidebar/PatternLibrary';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ShareButton } from './components/ShareButton';
import { readShareFromLocation, writeShareToLocation, type SharePayload } from './lib/share';
import type { RegexEngine } from './types/engineTypes';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { TutorialLauncher, TutorialDrawer } from './components/tutorial';
import { useTutorialStore } from './stores/tutorialStore';
import { findLesson } from './tutorial/registry';
import { resolveSpotlight } from './tutorial/spotlight';
import type { ToolPanelTab } from './tutorial/types';
import { ChallengesLauncher, ChallengesDrawer } from './components/challenges';
import { useChallengeStore } from './stores/challengeStore';
import { useT } from '@/lib/i18n';

type SidebarTab = 'reference' | 'library';

function App() {
  const t = useT();
  // Zustand store
  const store = useRegexStore();
  const derived = useRegexDerived();

  const { isDark, toggle: toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('reference');
  const hydratedRef = useRef(false);

  // Tutorial state
  const tutorialView = useTutorialStore((s) => s.view);
  const hydrateTutorial = useTutorialStore((s) => s.hydrate);
  const startLesson = useTutorialStore((s) => s.startLesson);
  const closeTutorial = useTutorialStore((s) => s.close);
  const tutorialOpen = tutorialView !== 'closed';

  // ── Tutorial spotlight ───────────────────────────────────────────────
  // Resolve the current step's spotlight (substring → AST node ids) so we
  // can pulse-highlight matching nodes in the diagram + explanation, and
  // optionally force-open a Tool panel tab.
  const tutorialLessonId = useTutorialStore((s) => s.currentLessonId);
  const tutorialStepIndex = useTutorialStore((s) => s.currentStepIndex);
  const currentStep = useMemo(() => {
    if (tutorialView !== 'lesson' || !tutorialLessonId) return undefined;
    return findLesson(tutorialLessonId)?.steps[tutorialStepIndex];
  }, [tutorialView, tutorialLessonId, tutorialStepIndex]);

  const spotlight = useMemo(
    () => resolveSpotlight(currentStep?.spotlight, store.pattern, derived.ast),
    [currentStep?.spotlight, store.pattern, derived.ast],
  );

  // Controlled Tool panel tab. Defaults to 'debugger'; the tutorial can
  // request a specific tab via `step.spotlight.openPanel`. The user can
  // still click tabs manually — that just updates the same state.
  const [activeToolPanelTab, setActiveToolPanelTab] = useState<ToolPanelTab>('debugger');
  const requestedPanel = currentStep?.spotlight?.openPanel;
  useEffect(() => {
    if (requestedPanel) setActiveToolPanelTab(requestedPanel);
  }, [requestedPanel]);

  // Only request a scroll-into-view when the step explicitly asks for it.
  const explanationScrollId = currentStep?.spotlight?.scrollExplanation
    ? spotlight.firstNodeId
    : null;

  // Challenges state
  const challengeView = useChallengeStore((s) => s.view);
  const hydrateChallenges = useChallengeStore((s) => s.hydrate);
  const startChallenge = useChallengeStore((s) => s.startChallenge);
  const openChallengeCatalog = useChallengeStore((s) => s.openCatalog);
  const closeChallenges = useChallengeStore((s) => s.close);
  const challengesOpen = challengeView !== 'closed';

  // Mutex: only one drawer open at a time. When tutorial opens, close
  // challenges; vice versa.
  useEffect(() => {
    if (tutorialOpen && challengesOpen) closeChallenges();
  }, [tutorialOpen, challengesOpen, closeChallenges]);
  // We only react to challengesOpen flipping on; tutorial side handled above.
  // Keeping a single dependency avoids ping-pong with the other effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional single-trigger
  useEffect(() => {
    if (challengesOpen && tutorialOpen) closeTutorial();
  }, [challengesOpen]);

  // Hydrate tutorial + challenges progress + parse URL params once on mount.
  useEffect(() => {
    hydrateTutorial();
    hydrateChallenges();
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get('challenge');
    if (challengeId) {
      startChallenge(challengeId);
      // If the challenge id was invalid, fall back to the catalog so the
      // user at least sees the list.
      if (useChallengeStore.getState().view === 'closed') {
        openChallengeCatalog();
      }
      return;
    }
    const lessonId = params.get('lesson');
    const stepParam = params.get('step');
    if (lessonId) {
      const stepIndex = stepParam ? Math.max(0, parseInt(stepParam, 10) - 1) : 0;
      startLesson(lessonId, Number.isFinite(stepIndex) ? stepIndex : 0);
    }
  }, [hydrateTutorial, hydrateChallenges, startLesson, startChallenge, openChallengeCatalog]);

  // Hydrate state from `#s=...` once on mount. Doing this in an effect keeps
  // SSR clean — the server still renders the default state, and the client
  // applies the share payload after hydration.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    // If a tutorial is being launched via ?lesson=, don't apply the share payload —
    // the lesson's initialState owns the editor.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // Lessons / challenges own the editor when launched via URL params.
      if (params.get('lesson') || params.get('challenge')) return;
    }
    const payload = readShareFromLocation();
    if (!payload) return;
    store.setEngine(payload.e as RegexEngine);
    store.loadPattern(payload.p, payload.f);
    if (payload.t !== undefined) store.setTestText(payload.t);
    if (payload.r !== undefined) store.setReplacement(payload.r);
    if (payload.sr !== undefined) store.setShowReplace(payload.sr);
    if (payload.tc) store.setTestCases(payload.tc);
    // We intentionally only run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    store.setTestCases,
    store.setEngine,
    store.setTestText,
    store.setShowReplace,
    store.setReplacement,
    store.loadPattern,
  ]);

  // Keep the URL hash in sync with the current state. Debounced and using
  // replaceState so we don't pollute history on every keystroke.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const payload: SharePayload = {
      v: 1,
      p: store.pattern,
      f: derived.flagString,
      e: store.engine,
      t: store.testText,
      r: store.replacement || undefined,
      sr: store.showReplace || undefined,
      tc: store.testCases.length > 0 ? store.testCases : undefined,
    };
    const handle = setTimeout(() => writeShareToLocation(payload), 400);
    return () => clearTimeout(handle);
  }, [
    store.pattern,
    derived.flagString,
    store.engine,
    store.testText,
    store.replacement,
    store.showReplace,
    store.testCases,
  ]);

  const openSidebar = (tab: SidebarTab) => {
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
    } else {
      setSidebarTab(tab);
      setSidebarOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="currentColor"
                viewBox="0 0 16 16"
                className="w-5 h-5 text-white"
              >
                <path
                  fillRule="evenodd"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                  d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 1 1 .707.707m9.9-.707a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.314.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707M6 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0m5-6.5a.5.5 0 0 0-1 0v2.117L8.257 5.57a.5.5 0 0 0-.514.858L9.528 7.5 7.743 8.571a.5.5 0 1 0 .514.858L10 8.383V10.5a.5.5 0 1 0 1 0V8.383l1.743 1.046a.5.5 0 0 0 .514-.858L11.472 7.5l1.785-1.071a.5.5 0 1 0-.514-.858L11 6.617z"
                />
              </svg>
            </div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              RegexStudio
            </h1>
            <span className="hidden sm:inline-block text-xs text-gray-400 dark:text-gray-500 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
              {t.header_tagline()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openSidebar('library')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                sidebarOpen && sidebarTab === 'library'
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.header_patterns()}</span>
            </button>
            <button
              onClick={() => openSidebar('reference')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                sidebarOpen && sidebarTab === 'reference'
                  ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.header_reference()}</span>
            </button>
            <TutorialLauncher
              onOpen={() => setSidebarOpen(false)}
            />
            <ChallengesLauncher
              onOpen={() => setSidebarOpen(false)}
            />
            <ShareButton
              payload={{
                v: 1,
                p: store.pattern,
                f: derived.flagString,
                e: store.engine,
                t: store.testText,
                r: store.replacement || undefined,
                sr: store.showReplace || undefined,
                tc: store.testCases.length > 0 ? store.testCases : undefined,
              }}
            />
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
            <LanguageSwitcher />
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex">
        <main
          className={`flex-1 min-w-0 transition-all duration-300 ${
            tutorialOpen || challengesOpen ? '2xl:mr-[460px]' : sidebarOpen ? 'lg:mr-80' : ''
          }`}
        >
          <div className="px-4 sm:px-6 py-5 space-y-4">
            {/* Regex Input */}
            <RegexInput
              pattern={store.pattern}
              onPatternChange={store.setPattern}
              flags={store.flags}
              flagString={derived.flagString}
              onToggleFlag={store.toggleFlag}
              validation={derived.validation}
              matchCount={derived.matches.length}
              ast={derived.ast}
              hoveredNodeId={store.hoveredNodeId}
              onHoverNode={store.setHoveredNodeId}
              engine={store.engine}
              onEngineChange={store.setEngine}
              compatibilityWarnings={derived.compatibilityWarnings}
            />

            {/* Railroad Banner — full width */}
            <RailroadBanner
              diagram={derived.diagram}
              ast={derived.ast}
              pattern={store.pattern}
              onPatternChange={store.setPattern}
              hoveredNodeId={store.hoveredNodeId}
              onHoverNode={store.setHoveredNodeId}
              spotlightNodeIds={spotlight.nodeIds}
            />

            {/* Two-column: Test Area + Match Details | Tool Panel */}
            <ResizablePanelGroup orientation="horizontal" className="min-h-[400px] rounded-xl">
              {/* Left: Test String */}
              <ResizablePanel defaultSize={45} minSize={30}>
                <div className="pr-2 h-full">
                  <TestArea
                    text={store.testText}
                    onTextChange={store.setTestText}
                    matches={derived.matches}
                    selectedMatch={store.selectedMatch}
                    onSelectMatch={store.setSelectedMatch}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="mx-1" />

              {/* Right: Tool Panel (Tabs) */}
              <ResizablePanel defaultSize={55} minSize={30}>
                <div className="pl-2 h-full">
                  <ToolPanel
                    ast={derived.ast}
                    pattern={store.pattern}
                    testText={store.testText}
                    flagString={derived.flagString}
                    hoveredNodeId={store.hoveredNodeId}
                    onHoverNode={store.setHoveredNodeId}
                    replacement={store.replacement}
                    onReplacementChange={store.setReplacement}
                    replacedText={derived.replacedText}
                    matchCount={derived.matches.length}
                    matches={derived.matches}
                    selectedMatch={store.selectedMatch}
                    onSelectMatch={store.setSelectedMatch}
                    testCases={store.testCases}
                    testResults={derived.testResults}
                    testsPassed={derived.testsPassed}
                    onAddTestCase={store.addTestCase}
                    onUpdateTestCase={store.updateTestCase}
                    onRemoveTestCase={store.removeTestCase}
                    onLoadTestCaseInput={store.setTestText}
                    activeTab={activeToolPanelTab}
                    onActiveTabChange={setActiveToolPanelTab}
                    spotlightNodeIds={spotlight.nodeIds}
                    spotlightFirstNodeId={explanationScrollId}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          <Footer />
        </main>

        <aside
          className={`fixed right-0 top-14 bottom-0 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 transform transition-transform duration-300 z-20 overflow-y-auto custom-scrollbar ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {sidebarTab === 'reference' ? (
                  <BookOpen className="w-4 h-4 text-teal-500" />
                ) : (
                  <Library className="w-4 h-4 text-teal-500" />
                )}
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {sidebarTab === 'reference' ? 'Quick Reference' : 'Pattern Library'}
                </h2>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 mb-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <button
                onClick={() => setSidebarTab('reference')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sidebarTab === 'reference'
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <FileText className="w-3 h-3" />
                Reference
              </button>
              <button
                onClick={() => setSidebarTab('library')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sidebarTab === 'library'
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <Library className="w-3 h-3" />
                Patterns
              </button>
            </div>

            {sidebarTab === 'reference' ? (
              <QuickReference />
            ) : (
              <PatternLibrary onSelect={store.loadPattern} />
            )}
          </div>
        </aside>
      </div>

      <TutorialDrawer />
      <ChallengesDrawer />
    </div>
  );
}

export default App;

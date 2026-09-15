import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Library, FileText, X } from 'lucide-react';
import { useRegexStore, useRegexActions, useRegexDerived } from './stores/regexStore';
import { useTheme } from './hooks/useTheme';
import { RegexInput } from './components/editor/RegexInput';
import { TestArea } from './components/layout/TestArea';
import { Footer } from './components/layout/Footer';
import { RailroadBanner } from './components/diagram/RailroadBanner';
import { ToolPanel } from './components/layout/ToolPanel';
import { EngineCapabilityNotice } from './components/EngineCapabilityNotice';
import { ThemeToggle } from './components/ThemeToggle';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ShareButton } from './components/ShareButton';
import { readShareFromLocation, writeShareToLocation, type SharePayload } from './lib/share';
import type { RegexEngine } from './types/engineTypes';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { TutorialLauncher } from './components/tutorial/TutorialLauncher';
import { useTutorialStore } from './stores/tutorialStore';
import { findLoadedLesson } from './tutorial/content';
import { useLazyMount } from './hooks/useLazyMount';
import { resolveSpotlight } from './tutorial/spotlight';
import type { ToolPanelTab } from './tutorial/types';
import { ChallengesLauncher } from './components/challenges/ChallengesLauncher';
import { useChallengeStore } from './stores/challengeStore';
import { useT } from '@/lib/i18n';

// The drawers pull in all lesson and challenge content, which nobody sees
// until they open one. They are fetched on demand — or during idle time, so
// that the first open still animates instead of appearing already open.
// The reference and pattern-library panels live in a slide-in sidebar that
// starts closed, so they are fetched the same way as the drawers.
const loadQuickReference = () => import('./components/sidebar/QuickReference');
const loadPatternLibrary = () => import('./components/sidebar/PatternLibrary');
const QuickReference = lazy(() =>
  loadQuickReference().then((m) => ({ default: m.QuickReference })),
);
const PatternLibrary = lazy(() =>
  loadPatternLibrary().then((m) => ({ default: m.PatternLibrary })),
);

const loadTutorialDrawer = () => import('./components/tutorial/TutorialDrawer');
const loadChallengesDrawer = () => import('./components/challenges/ChallengesDrawer');
const TutorialDrawer = lazy(() =>
  loadTutorialDrawer().then((m) => ({ default: m.TutorialDrawer })),
);
const ChallengesDrawer = lazy(() =>
  loadChallengesDrawer().then((m) => ({ default: m.ChallengesDrawer })),
);

type SidebarTab = 'reference' | 'library';

function App() {
  const t = useT();
  // Subscribe field by field: reading the whole store re-rendered the entire
  // app on every hover over a diagram node.
  const engine = useRegexStore((s) => s.engine);
  const pattern = useRegexStore((s) => s.pattern);
  const flags = useRegexStore((s) => s.flags);
  const testText = useRegexStore((s) => s.testText);
  const replacement = useRegexStore((s) => s.replacement);
  const showReplace = useRegexStore((s) => s.showReplace);
  const testCases = useRegexStore((s) => s.testCases);
  const selectedMatch = useRegexStore((s) => s.selectedMatch);
  const hoveredNodeId = useRegexStore((s) => s.hoveredNodeId);
  const actions = useRegexActions();
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
    return findLoadedLesson(tutorialLessonId)?.steps[tutorialStepIndex];
  }, [tutorialView, tutorialLessonId, tutorialStepIndex]);

  const spotlight = useMemo(
    () => resolveSpotlight(currentStep?.spotlight, pattern, derived.ast),
    [currentStep?.spotlight, pattern, derived.ast],
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

  // Mutex: only one drawer open at a time — whichever opened most recently
  // wins. This has to be a single effect that knows which side just flipped
  // on: two effects each reacting to "both are open" fire in the same commit
  // and close both drawers.
  // Fetching the drawer pulls its content in with it, so one wait covers both
  // and the drawer is already resolved by the time it mounts.
  const referenceMounted = useLazyMount(loadQuickReference, sidebarOpen);
  const libraryMounted = useLazyMount(loadPatternLibrary, sidebarOpen);
  const tutorialMounted = useLazyMount(loadTutorialDrawer, tutorialOpen);
  const challengesMounted = useLazyMount(loadChallengesDrawer, challengesOpen);

  const prevDrawersRef = useRef({ tutorial: tutorialOpen, challenges: challengesOpen });
  useEffect(() => {
    const prev = prevDrawersRef.current;
    prevDrawersRef.current = { tutorial: tutorialOpen, challenges: challengesOpen };
    if (!tutorialOpen || !challengesOpen) return;
    if (!prev.tutorial) closeChallenges();
    else if (!prev.challenges) closeTutorial();
  }, [tutorialOpen, challengesOpen, closeChallenges, closeTutorial]);

  // Hydrate tutorial + challenges progress + parse URL params once on mount.
  useEffect(() => {
    hydrateTutorial();
    hydrateChallenges();
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get('challenge');
    if (challengeId) {
      // Starting waits on the challenge content chunk, so the fallback has to
      // wait with it: if the id was invalid, show the catalogue instead.
      void startChallenge(challengeId).then(() => {
        if (useChallengeStore.getState().view === 'closed') {
          openChallengeCatalog();
        }
      });
      return;
    }
    const lessonId = params.get('lesson');
    const stepParam = params.get('step');
    if (lessonId) {
      const stepIndex = stepParam ? Math.max(0, parseInt(stepParam, 10) - 1) : 0;
      void startLesson(lessonId, Number.isFinite(stepIndex) ? stepIndex : 0);
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
    actions.setEngine(payload.e as RegexEngine);
    actions.loadPattern(payload.p, payload.f);
    if (payload.t !== undefined) actions.setTestText(payload.t);
    if (payload.r !== undefined) actions.setReplacement(payload.r);
    if (payload.sr !== undefined) actions.setShowReplace(payload.sr);
    if (payload.tc) actions.setTestCases(payload.tc);
    // Runs once: the ref above guards against a second pass.
  }, [actions]);

  // Keep the URL hash in sync with the current state. Debounced and using
  // replaceState so we don't pollute history on every keystroke.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const payload: SharePayload = {
      v: 1,
      p: pattern,
      f: derived.flagString,
      e: engine,
      t: testText,
      r: replacement || undefined,
      sr: showReplace || undefined,
      tc: testCases.length > 0 ? testCases : undefined,
    };
    const handle = setTimeout(() => writeShareToLocation(payload), 400);
    return () => clearTimeout(handle);
  }, [pattern, derived.flagString, engine, testText, replacement, showReplace, testCases]);

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
            <TutorialLauncher onOpen={() => setSidebarOpen(false)} />
            <ChallengesLauncher onOpen={() => setSidebarOpen(false)} />
            <ShareButton
              payload={{
                v: 1,
                p: pattern,
                f: derived.flagString,
                e: engine,
                t: testText,
                r: replacement || undefined,
                sr: showReplace || undefined,
                tc: testCases.length > 0 ? testCases : undefined,
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
              pattern={pattern}
              onPatternChange={actions.setPattern}
              flags={flags}
              flagString={derived.flagString}
              onToggleFlag={actions.toggleFlag}
              validation={derived.validation}
              matchCount={derived.matches.length}
              timedOut={derived.timedOut}
              pending={derived.pending}
              executionError={derived.executionError}
              onRetry={derived.retry}
              ast={derived.ast}
              hoveredNodeId={hoveredNodeId}
              onHoverNode={actions.setHoveredNodeId}
              engine={engine}
              onEngineChange={actions.setEngine}
              compatibilityWarnings={derived.compatibilityWarnings}
            />

            {/* Railroad Banner — full width */}
            {!derived.visualizationSupported ? (
              <EngineCapabilityNotice reason={derived.visualizationReason} />
            ) : (
              <RailroadBanner
                key={derived.executionEngine}
                flags={derived.flagString}
                diagram={derived.diagram}
                ast={derived.ast}
                pattern={pattern}
                onPatternChange={actions.setPattern}
                hoveredNodeId={hoveredNodeId}
                onHoverNode={actions.setHoveredNodeId}
                spotlightNodeIds={spotlight.nodeIds}
              />
            )}

            {/* Two-column: Test Area + Match Details | Tool Panel */}
            <ResizablePanelGroup orientation="horizontal" className="min-h-[400px] rounded-xl">
              {/* Left: Test String */}
              <ResizablePanel defaultSize={45} minSize={30}>
                <div className="pr-2 h-full">
                  <TestArea
                    text={testText}
                    onTextChange={actions.setTestText}
                    matches={derived.matches}
                    selectedMatch={selectedMatch}
                    onSelectMatch={actions.setSelectedMatch}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="mx-1" />

              {/* Right: Tool Panel (Tabs) */}
              <ResizablePanel defaultSize={55} minSize={30}>
                <div className="pl-2 h-full">
                  <ToolPanel
                    executionEngine={derived.executionEngine}
                    visualizationSupported={derived.visualizationSupported}
                    visualizationReason={derived.visualizationReason}
                    replacementError={derived.replacementError}
                    pending={derived.pending}
                    ast={derived.ast}
                    pattern={pattern}
                    testText={testText}
                    flagString={derived.flagString}
                    jsFlagString={derived.jsFlagString}
                    hoveredNodeId={hoveredNodeId}
                    onHoverNode={actions.setHoveredNodeId}
                    replacement={replacement}
                    onReplacementChange={actions.setReplacement}
                    replacedText={derived.replacedText}
                    matchCount={derived.matches.length}
                    matches={derived.matches}
                    selectedMatch={selectedMatch}
                    onSelectMatch={actions.setSelectedMatch}
                    testCases={testCases}
                    testResults={derived.testResults}
                    testsPassed={derived.testsPassed}
                    onAddTestCase={actions.addTestCase}
                    onUpdateTestCase={actions.updateTestCase}
                    onRemoveTestCase={actions.removeTestCase}
                    onLoadTestCaseInput={actions.setTestText}
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
                  {sidebarTab === 'reference'
                    ? t.sidebar_quick_reference()
                    : t.sidebar_pattern_library()}
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
                {t.header_reference()}
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
                {t.header_patterns()}
              </button>
            </div>

            <Suspense fallback={null}>
              {sidebarTab === 'reference'
                ? referenceMounted && <QuickReference />
                : libraryMounted && <PatternLibrary onSelect={actions.loadPattern} />}
            </Suspense>
          </div>
        </aside>
      </div>

      {tutorialMounted && (
        <Suspense fallback={null}>
          <TutorialDrawer />
        </Suspense>
      )}
      {challengesMounted && (
        <Suspense fallback={null}>
          <ChallengesDrawer />
        </Suspense>
      )}
    </div>
  );
}

export default App;

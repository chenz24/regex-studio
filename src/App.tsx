import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { TutorialLauncher } from './components/tutorial/TutorialLauncher';
import { useTutorialStore } from './stores/tutorialStore';
import { findLoadedLesson } from './tutorial/content';
import { useLazyMount } from './hooks/useLazyMount';
import { resolveSpotlight } from './tutorial/spotlight';
import type { ToolPanelTab } from './tutorial/types';
import { ChallengesLauncher } from './components/challenges/ChallengesLauncher';
import { useChallengeStore } from './stores/challengeStore';
import { localizedPath, useLocale, useT } from '@/lib/i18n';
import { useNarrowLayout } from './hooks/useNarrowLayout';
import {
  inspectMatch,
  inspectSource,
  inspectStep,
  validRange,
  type SourceRange,
  type ResultInspection,
} from './utils/resultInspection';
import { findNodeById } from './lib/ast';
import type { DebugStep } from './utils/steppingMatcher';

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
  const locale = useLocale();
  // Subscribe field by field: reading the whole store re-rendered the entire
  // app on every hover over a diagram node.
  const engine = useRegexStore((s) => s.engine);
  const compatibilityTarget = useRegexStore((s) => s.compatibilityTarget);
  const legacyTargetFlags = useRegexStore((s) => s.legacyTargetFlags);
  const pattern = useRegexStore((s) => s.pattern);
  const flags = useRegexStore((s) => s.flags);
  const testText = useRegexStore((s) => s.testText);
  const replacement = useRegexStore((s) => s.replacement);
  const showReplace = useRegexStore((s) => s.showReplace);
  const testCases = useRegexStore((s) => s.testCases);
  const hoveredNodeId = useRegexStore((s) => s.hoveredNodeId);
  const actions = useRegexActions();
  const derived = useRegexDerived();

  const [activeToolPanelTab, setActiveToolPanelTab] = useState<ToolPanelTab>('debugger');
  const narrow = useNarrowLayout();
  const patternSectionRef = useRef<HTMLDivElement>(null);
  const textSectionRef = useRef<HTMLDivElement>(null);
  const toolsSectionRef = useRef<HTMLDivElement>(null);
  const contextKey = JSON.stringify([engine, pattern, derived.flagString, testText]);
  const [inspectionEntry, setInspectionEntry] = useState<{
    key: string;
    value: ResultInspection;
  } | null>(null);
  const resultsReady =
    !derived.pending && !derived.timedOut && !derived.executionError && derived.validation.valid;
  const inspection =
    inspectionEntry?.key === contextKey &&
    (inspectionEntry.value.origin !== 'match' || resultsReady)
      ? inspectionEntry.value
      : null;
  const selectedMatch = inspection?.matchIndex ?? null;
  const selectedGroup = inspection?.groupIndex;
  const inspectedNodeIds = useMemo(() => new Set(inspection?.nodeIds ?? []), [inspection]);
  const [revealRequest, setRevealRequest] = useState<{
    key: string;
    target: 'pattern' | 'text' | 'tools';
  }>();
  const currentReveal = revealRequest?.key === contextKey ? revealRequest : undefined;
  useEffect(() => {
    setInspectionEntry((entry) => (entry?.key === contextKey ? entry : null));
  }, [contextKey]);
  const selectMatch = useCallback(
    (index: number | null, group?: number) => {
      const value =
        index !== null && resultsReady
          ? inspectMatch(
              derived.matches,
              index,
              group,
              derived.ast,
              pattern.length,
              testText.length,
              derived.visualizationSupported,
            )
          : null;
      setInspectionEntry(value ? { key: contextKey, value } : null);
      if (value) setActiveToolPanelTab('matches');
    },
    [
      resultsReady,
      derived.matches,
      derived.ast,
      derived.visualizationSupported,
      pattern.length,
      testText.length,
      contextKey,
    ],
  );
  const selectSource = useCallback(
    (range: SourceRange) => {
      if (!validRange(range, pattern.length)) return;
      setInspectionEntry({
        key: contextKey,
        value: inspectSource(derived.ast, range, derived.visualizationSupported),
      });
    },
    [contextKey, derived.ast, derived.visualizationSupported, pattern.length],
  );
  const selectNode = useCallback(
    (id: string | null) => {
      const node = id ? findNodeById(derived.ast, id) : null;
      if (node) selectSource({ start: node.start, end: node.end });
      else setInspectionEntry(null);
    },
    [derived.ast, selectSource],
  );
  const selectStep = useCallback(
    (step: DebugStep | null) => {
      if (!step) {
        setInspectionEntry((entry) => (entry?.value.origin === 'debugger' ? null : entry));
        return;
      }
      const value = inspectStep(
        derived.ast,
        step,
        pattern.length,
        testText.length,
        derived.visualizationSupported,
      );
      setInspectionEntry(value ? { key: contextKey, value } : null);
    },
    [contextKey, derived.ast, derived.visualizationSupported, pattern.length, testText.length],
  );
  const revealSection = useCallback(
    (target: 'pattern' | 'text' | 'tools') => {
      const element = (
        target === 'pattern'
          ? patternSectionRef
          : target === 'text'
            ? textSectionRef
            : toolsSectionRef
      ).current;
      element?.scrollIntoView({ block: 'start', behavior: 'instant' });
      element?.focus({ preventScroll: true });
      setRevealRequest({ key: contextKey, target });
    },
    [contextKey],
  );

  const { isDark, toggle: toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('reference');
  const hydratedRef = useRef(false);
  const shareWriteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastShareUrl = useRef<string | undefined>(undefined);

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
    // A saved workspace takes precedence over leftover entry parameters in
    // older links. Starting a lesson here would overwrite its restored text.
    if (readShareFromLocation()) return;
    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get('challenge');
    if (challengeId) {
      // Starting waits on the challenge content chunk, so the fallback has to
      // wait with it: if the id was invalid, show the catalogue instead.
      void startChallenge(challengeId).then((result) => {
        if (result === 'missing' && useChallengeStore.getState().view === 'closed') {
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
    } else if (params.get('catalog') === 'tutorial') {
      useTutorialStore.getState().openCatalog();
    } else if (params.get('catalog') === 'challenges') {
      openChallengeCatalog();
    }
  }, [hydrateTutorial, hydrateChallenges, startLesson, startChallenge, openChallengeCatalog]);

  // Hash-only navigation keeps this component mounted. Restore each visited
  // share, including browser back/forward, without treating our own saves as loads.
  useEffect(() => {
    const restore = () => {
      if (lastShareUrl.current === window.location.href) return;
      const payload = readShareFromLocation();
      if (!payload) return;
      clearTimeout(shareWriteTimer.current);
      lastShareUrl.current = window.location.href;
      // Discard exercise snapshots before loading so closing a drawer cannot
      // subsequently overwrite the newly opened workspace.
      useTutorialStore.getState().exitLesson();
      useTutorialStore.getState().close();
      useChallengeStore.getState().close();
      actions.loadShare(payload);
    };
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      restore();
    }
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
    };
  }, [actions]);

  // Keep the URL hash in sync with the current state. Debounced and using
  // replaceState so we don't pollute history on every keystroke.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const payload: SharePayload = {
      v: 3,
      p: pattern,
      f: derived.flagString,
      e: engine,
      c: compatibilityTarget ?? undefined,
      lf: legacyTargetFlags || undefined,
      t: testText,
      r: replacement || undefined,
      sr: showReplace || undefined,
      tc: testCases.length > 0 ? testCases : undefined,
    };
    const sourceUrl = window.location.href;
    const handle = setTimeout(() => {
      // Navigation wins over a save queued for the workspace being left.
      if (window.location.href !== sourceUrl) return;
      writeShareToLocation(payload);
      lastShareUrl.current = window.location.href;
    }, 400);
    shareWriteTimer.current = handle;
    return () => clearTimeout(handle);
  }, [
    pattern,
    derived.flagString,
    engine,
    compatibilityTarget,
    legacyTargetFlags,
    testText,
    replacement,
    showReplace,
    testCases,
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
    <div className="min-h-screen overflow-x-clip bg-gray-50 dark:bg-gray-950 transition-colors">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 shrink-0">
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
            <h1 className="sr-only sm:not-sr-only text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              RegexStudio
            </h1>
            <span className="hidden sm:inline-block text-xs text-gray-400 dark:text-gray-500 border-l border-gray-200 dark:border-gray-700 pl-3 ml-1">
              {t.header_tagline()}
            </span>
          </div>

          <div className="flex items-center min-w-0 gap-1 sm:gap-2 overflow-x-auto [&>button]:shrink-0 [&>button]:px-2 sm:[&>button]:px-3">
            <button
              aria-label={t.header_patterns()}
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
              aria-label={t.header_reference()}
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
                v: 3,
                p: pattern,
                f: derived.flagString,
                e: engine,
                c: compatibilityTarget ?? undefined,
                lf: legacyTargetFlags || undefined,
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
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs sm:text-sm">
              <p className="text-gray-600 dark:text-gray-400">{t.home_intro()}</p>
              <a
                href={localizedPath('/learn', locale)}
                className="shrink-0 font-medium text-teal-700 hover:underline dark:text-teal-300"
              >
                {t.learn_nav()} &rarr;
              </a>
            </div>
            {/* Regex Input */}
            <div ref={patternSectionRef} tabIndex={-1} className="scroll-mt-20 outline-none">
              <RegexInput
                revealRequest={currentReveal?.target === 'pattern' ? currentReveal : undefined}
                inspectionRanges={inspection?.source}
                onInspectSource={selectSource}
                pattern={pattern}
                onPatternChange={actions.setPattern}
                onUndo={actions.undoPattern}
                onRedo={actions.redoPattern}
                flags={flags}
                flagString={derived.flagString}
                onToggleFlag={actions.toggleFlag}
                validation={derived.validation}
                matchCount={derived.matches.length}
                matchesTruncated={derived.matchesTruncated}
                timedOut={derived.timedOut}
                pending={derived.pending}
                executionError={derived.executionError}
                onRetry={derived.retry}
                ast={derived.ast}
                hoveredNodeId={hoveredNodeId}
                onHoverNode={actions.setHoveredNodeId}
                engine={engine}
                onEngineChange={actions.setEngine}
                compatibilityTarget={compatibilityTarget}
                onCompatibilityTargetChange={actions.setCompatibilityTarget}
                legacyTargetFlags={legacyTargetFlags}
                compatibilityWarnings={derived.compatibilityWarnings}
              />
            </div>

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
                inspectedNodeIds={inspectedNodeIds}
                onInspectNode={selectNode}
              />
            )}

            {/* Test text and tools stack on narrow screens without remounting editors. */}
            {narrow && (
              <nav
                aria-label={t.inspection_navigation()}
                className="sticky top-14 z-10 flex gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-2 text-xs"
              >
                <button
                  onClick={() => revealSection('pattern')}
                  className="flex-1 py-1.5 rounded bg-gray-100 dark:bg-gray-800"
                >
                  {t.inspection_expression()}
                </button>
                <button
                  onClick={() => revealSection('text')}
                  className="flex-1 py-1.5 rounded bg-gray-100 dark:bg-gray-800"
                >
                  {t.testarea_title()}
                </button>
                <button
                  onClick={() => revealSection('tools')}
                  className="flex-1 py-1.5 rounded bg-gray-100 dark:bg-gray-800"
                >
                  {t.inspection_tools()}
                </button>
              </nav>
            )}
            <ResizablePanelGroup
              orientation={narrow ? 'vertical' : 'horizontal'}
              className="min-h-[400px] rounded-xl max-md:!h-auto max-md:!overflow-visible max-md:!touch-auto max-md:[&>[data-panel]]:!flex-none max-md:[&>[data-panel]]:!max-h-none"
              disabled={narrow}
              style={narrow ? { height: 'auto', overflow: 'visible' } : undefined}
            >
              {/* Left: Test String */}
              <ResizablePanel
                className="max-md:!max-h-none max-md:!overflow-visible max-md:!touch-auto"
                defaultSize="45%"
                minSize={narrow ? 0 : '30%'}
              >
                <div
                  ref={textSectionRef}
                  tabIndex={-1}
                  className="md:pr-2 md:h-full scroll-mt-28 outline-none"
                >
                  <TestArea
                    revealRequest={currentReveal?.target === 'text' ? currentReveal : undefined}
                    inspectionRange={inspection?.subject}
                    resultsReady={resultsReady}
                    text={testText}
                    onTextChange={actions.setTestText}
                    matches={derived.matches}
                    matchesTruncated={derived.matchesTruncated}
                    selectedMatch={selectedMatch}
                    onSelectMatch={selectMatch}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle
                disabled={narrow}
                withHandle={!narrow}
                className={narrow ? 'my-2 opacity-0 pointer-events-none' : 'mx-1'}
              />

              {/* Right: Tool Panel (Tabs) */}
              <ResizablePanel
                className="max-md:!max-h-none max-md:!overflow-visible max-md:!touch-auto"
                defaultSize="55%"
                minSize={narrow ? 0 : '30%'}
              >
                <div
                  ref={toolsSectionRef}
                  tabIndex={-1}
                  className="md:pl-2 md:h-full scroll-mt-28 outline-none"
                >
                  <ToolPanel
                    resultsReady={resultsReady}
                    selectedGroup={selectedGroup}
                    sourceAvailable={!!inspection?.source.length}
                    ambiguousSource={inspection?.ambiguous}
                    onSelectGroup={selectMatch}
                    onInspectStep={selectStep}
                    onReveal={revealSection}
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
                    matchesTruncated={derived.matchesTruncated}
                    matches={derived.matches}
                    selectedMatch={selectedMatch}
                    onSelectMatch={selectMatch}
                    testCases={testCases}
                    testResults={derived.testResults}
                    testsPassed={derived.testsPassed}
                    onAddTestCase={actions.addTestCase}
                    onImportTestCases={actions.importTestCases}
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

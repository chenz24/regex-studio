import type { DebugResult, DebugStep } from './steppingMatcher';
import type { MatchOutcome } from './matchEngine';

export interface TraceMessages {
  before: (item: string) => string;
  backtrack: (item: string) => string;
  start: (position: number) => string;
  end: string;
  matched: (start: number, end: number) => string;
  noMatch: string;
  incomplete: string;
}

export function pcre2DebugResult(
  outcome: MatchOutcome,
  pattern: string,
  text: string,
  messages: TraceMessages,
): DebugResult {
  const steps: DebugStep[] = (outcome.trace?.steps ?? []).map((event, index) => {
    const item = pattern.slice(event.patternStart, event.patternEnd) || messages.end;
    const captures: DebugStep['captureGroups'] = {};
    for (const capture of event.captures) {
      // Materialize text only for the selected step, not once per trace snapshot.
      captures[capture.index] = {
        start: capture.start,
        end: capture.end,
        get value() {
          return text.slice(capture.start, capture.end);
        },
      };
    }
    return {
      id: index,
      astNodeId: '',
      patternStart: event.patternStart,
      patternEnd: event.patternEnd,
      stringPos: event.stringPos,
      stringEnd: event.stringPos,
      action: event.flags & 2 ? 'backtrack' : 'try',
      description: `${event.flags & 1 ? `${messages.start(event.matchStart)} · ` : ''}${event.flags & 2 ? messages.backtrack(item) : messages.before(item)}`,
      captureGroups: captures,
      depth: 0,
    };
  });
  const match = outcome.matches[0];
  const incomplete =
    outcome.timedOut || !!outcome.executionError || outcome.validation?.valid === false;
  const captures: DebugStep['captureGroups'] = {};
  for (const capture of match?.groups ?? []) {
    if (capture.value !== undefined)
      captures[capture.index] = { value: capture.value, start: capture.start, end: capture.end };
  }
  steps.push({
    id: steps.length,
    astNodeId: '',
    patternStart: pattern.length,
    patternEnd: pattern.length,
    stringPos: match?.start ?? 0,
    stringEnd: match?.end ?? 0,
    action: incomplete ? 'try' : match ? 'match' : 'fail',
    description: incomplete
      ? messages.incomplete
      : match
        ? messages.matched(match.start, match.end)
        : messages.noMatch,
    captureGroups: captures,
    depth: 0,
  });
  return {
    steps,
    totalSteps: steps.length,
    matched: !!match && !incomplete,
    matchStart: match?.start ?? -1,
    matchEnd: match?.end ?? -1,
    truncated: !!outcome.trace?.truncated || incomplete,
  };
}

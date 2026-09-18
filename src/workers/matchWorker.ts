import type { MatchRequest, MatchResponse } from '../utils/matchEngine';
import { executeJavascript } from '../utils/javascriptMatcher';

/**
 * Runs the user's pattern against the test text off the main thread.
 *
 * A pattern like `(a+)+$` can take effectively forever on a moderately long
 * string, and `RegExp.exec` cannot be interrupted — so the only way to stay
 * responsive is to run it somewhere that can be terminated. The client gives
 * up after a deadline and kills this worker.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<MatchRequest>) => void) | null;
  postMessage(message: MatchResponse): void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = (event) => {
  ctx.postMessage({ id: event.data.id, ...executeJavascript(event.data) });
};

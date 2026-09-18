import { createPcre2Matcher } from '../utils/pcre2Matcher';
import type { MatchRequest, WorkerResponse } from '../utils/matchEngine';

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<MatchRequest>) => void) | null;
  postMessage: (response: WorkerResponse) => void;
};

createPcre2Matcher()
  .then((run) => {
    ctx.onmessage = ({ data: { id, ...input } }) => {
      ctx.postMessage({ id, ...run(input) });
    };
    ctx.postMessage({ type: 'ready' });
  })
  .catch(() => {
    ctx.postMessage({
      type: 'load-error',
      message: 'Unable to load the PCRE2 engine. Please retry.',
    });
  });

import { useEffect, useState } from 'react';

interface IdleWindow {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

/**
 * Report when a lazily-loaded chunk is ready, fetching it as soon as it is
 * needed — or during idle time if nothing needs it yet.
 *
 * Loading ahead of time is what keeps CSS enter/leave transitions working: a
 * drawer whose first render is already in the open state cannot slide in.
 */
export function useLazyMount(load: () => Promise<unknown>, needed: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready || typeof window === 'undefined') return;

    let cancelled = false;
    const start = () => {
      void load().then(() => {
        if (!cancelled) setReady(true);
      });
    };

    if (needed) {
      start();
      return () => {
        cancelled = true;
      };
    }

    const idleWindow = window as unknown as IdleWindow;
    const idle = idleWindow.requestIdleCallback;
    const handle = idle ? idle(start, { timeout: 2000 }) : window.setTimeout(start, 1200);

    return () => {
      cancelled = true;
      if (idle) idleWindow.cancelIdleCallback?.(handle);
      else window.clearTimeout(handle);
    };
  }, [ready, needed, load]);

  return ready;
}

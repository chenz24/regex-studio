/**
 * Analytics integration: Umami + Google Analytics (GA4).
 *
 * Configured via Vite env variables:
 *   - VITE_UMAMI_WEBSITE_ID     Umami website id (uuid).
 *   - VITE_UMAMI_SRC            Umami script URL.
 *                                Defaults to https://cloud.umami.is/script.js.
 *   - VITE_GA_MEASUREMENT_ID    Google Analytics 4 measurement id (G-XXXXXXX).
 *
 * Each provider activates only when its required env(s) are set, so analytics
 * stay disabled in development unless you explicitly opt in.
 */

type Env = Record<string, string | undefined>;

function readEnv(): Env {
  return ((import.meta as unknown as { env?: Env }).env ?? {}) as Env;
}

export interface AnalyticsConfig {
  umami?: { src: string; websiteId: string };
  ga?: { measurementId: string };
}

export function getAnalyticsConfig(): AnalyticsConfig {
  const env = readEnv();
  const config: AnalyticsConfig = {};

  const umamiId = env.VITE_UMAMI_WEBSITE_ID?.trim();
  if (umamiId) {
    config.umami = {
      src: env.VITE_UMAMI_SRC?.trim() || 'https://cloud.umami.is/script.js',
      websiteId: umamiId,
    };
  }

  const gaId = env.VITE_GA_MEASUREMENT_ID?.trim();
  if (gaId) {
    config.ga = { measurementId: gaId };
  }

  return config;
}

/**
 * Returns `<script>` elements to inject via TanStack Router's head().
 * Safe to call during SSR; only emits tags for providers that are configured.
 */
export function getAnalyticsScripts(): Array<Record<string, unknown>> {
  const config = getAnalyticsConfig();
  const scripts: Array<Record<string, unknown>> = [];

  if (config.umami) {
    scripts.push({
      src: config.umami.src,
      defer: true,
      'data-website-id': config.umami.websiteId,
    });
  }

  if (config.ga) {
    const id = config.ga.measurementId;
    scripts.push({
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
      async: true,
    });
    scripts.push({
      children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{send_page_view:false});`,
    });
  }

  return scripts;
}

type GtagFn = (...args: unknown[]) => void;
type UmamiApi = { track?: (eventOrProps?: unknown, props?: unknown) => void };

interface AnalyticsWindow {
  gtag?: GtagFn;
  dataLayer?: unknown[];
  umami?: UmamiApi;
}

function getWin(): AnalyticsWindow | undefined {
  if (typeof window === 'undefined') return undefined;
  return window as unknown as AnalyticsWindow;
}

/**
 * Track a SPA page view across configured providers.
 * - GA4: emits a manual `page_view` event (auto page_view is disabled above).
 * - Umami: auto-tracks history changes; we only call its API as a fallback
 *   in case auto-tracking is disabled by the user's instance.
 */
export function trackPageView(path: string, title?: string): void {
  const win = getWin();
  if (!win) return;

  const config = getAnalyticsConfig();
  const url = path || (typeof location !== 'undefined' ? location.pathname + location.search : '/');
  const pageTitle = title ?? (typeof document !== 'undefined' ? document.title : undefined);

  if (config.ga && typeof win.gtag === 'function') {
    win.gtag('event', 'page_view', {
      page_path: url,
      page_location: typeof location !== 'undefined' ? location.href : undefined,
      page_title: pageTitle,
    });
  }
  // Umami auto-tracks on history changes; no manual call needed by default.
}

/**
 * Track a custom event across configured providers.
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  const win = getWin();
  if (!win) return;
  const config = getAnalyticsConfig();

  if (config.ga && typeof win.gtag === 'function') {
    win.gtag('event', name, props ?? {});
  }
  if (config.umami && win.umami && typeof win.umami.track === 'function') {
    if (props) win.umami.track(name, props);
    else win.umami.track(name);
  }
}

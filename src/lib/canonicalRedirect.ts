/** Normalize document URLs before the router's temporary slash redirect. */
export function getCanonicalRedirect(request: Request): Response | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  const url = new URL(request.url);
  if (url.pathname === '/' || !url.pathname.endsWith('/')) return;
  // Only public page routes; never rewrite RPC or other server endpoints.
  if (!/^\/(?:en\/|zh\/|ja\/)?(?:(?:learn|challenges|patterns)(?:\/[^/]+)?\/)?$/.test(url.pathname))
    return;
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return Response.redirect(url.href, 308);
}

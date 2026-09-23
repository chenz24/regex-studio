import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import type { Register } from '@tanstack/react-router';
import type { RequestHandler } from '@tanstack/react-start/server';
import { getCanonicalRedirect } from '@/lib/canonicalRedirect';

const handleRequest = createStartHandler(defaultStreamHandler);

export type ServerEntry = { fetch: RequestHandler<Register> };

export default {
  fetch: async (request, ...args) =>
    getCanonicalRedirect(request) ?? handleRequest(request, ...args),
} satisfies ServerEntry;

import { createHash } from 'node:crypto';

export type Revisions = Record<string, { hash: string; lastmod: string }>;

/** Persist content fingerprints so an unchanged rebuild keeps its original date. */
export function updateRevisions(
  previous: Revisions,
  snapshots: Record<string, unknown>,
  changedOn: string,
): Revisions {
  return Object.fromEntries(
    Object.entries(snapshots).map(([path, content]) => {
      const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
      const lastmod = previous[path]?.hash === hash ? previous[path].lastmod : changedOn;
      return [path, { hash, lastmod }];
    }),
  );
}

import type { Challenge } from './types';

type ChallengeData = typeof import('./data');

/**
 * Challenge definitions and their test cases, kept out of the initial bundle
 * for the same reason as the tutorial lessons. See `tutorial/content.ts`.
 */
let loaded: ChallengeData | null = null;
let inFlight: Promise<ChallengeData> | null = null;

export function loadChallengeContent(): Promise<ChallengeData> {
  if (loaded) return Promise.resolve(loaded);
  if (!inFlight) {
    inFlight = import('./data').then((mod) => {
      loaded = mod;
      return mod;
    });
  }
  return inFlight;
}

/** The challenge data if it is already loaded, otherwise `null`. */
export function challengeContent(): ChallengeData | null {
  return loaded;
}

/** Look up a challenge, assuming the content has already been loaded. */
export function findLoadedChallenge(id: string): Challenge | undefined {
  return loaded?.findChallenge(id);
}

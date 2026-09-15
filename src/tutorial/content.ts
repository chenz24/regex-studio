import type { Lesson } from './types';

type Registry = typeof import('./registry');

/**
 * The lesson content — 21 lessons of prose, examples and validators — is the
 * largest thing in the app and nobody sees it until they open the tutorial.
 * It is kept out of the initial bundle and pulled in on demand, warmed
 * during idle time so opening the drawer feels instant.
 *
 * Anything that starts or advances a lesson must go through
 * `loadTutorialContent()` first; after that `tutorialContent()` answers
 * synchronously, which keeps the store's transitions simple.
 */
let loaded: Registry | null = null;
let inFlight: Promise<Registry> | null = null;

export function loadTutorialContent(): Promise<Registry> {
  if (loaded) return Promise.resolve(loaded);
  if (!inFlight) {
    inFlight = import('./registry').then((mod) => {
      loaded = mod;
      return mod;
    });
  }
  return inFlight;
}

/** The registry if it is already loaded, otherwise `null`. */
export function tutorialContent(): Registry | null {
  return loaded;
}

/** Look up a lesson, assuming the content has already been loaded. */
export function findLoadedLesson(id: string): Lesson | undefined {
  return loaded?.findLesson(id);
}

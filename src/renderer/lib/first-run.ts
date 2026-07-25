/**
 * Decides the first-run experience from persisted flags.
 *
 * Pure so it can be unit-tested without launching Electron — the App wires it to the
 * SQLite preferences table (which travels with the user's database, unlike localStorage
 * that resets when they download a fresh build).
 */

export interface FirstRunInput {
  /** Stored 'intro-seen' flag, or null if never recorded. */
  seenIntro: string | null;
  /** Stored 'last-seen-version', or null if never recorded. */
  lastVersion: string | null;
  /** The running app version. */
  version: string;
  /** True under test automation — suppresses the whole first-run experience. */
  isAutomation: boolean;
  /** The Settings toggle. Undefined is treated as on, for callers written before it. */
  introEnabled?: boolean;
}

export interface FirstRunDecision {
  /** Play the intro animation. */
  playIntro: boolean;
  /**
   * Show the changelog. When the intro also plays it should be deferred until the intro
   * finishes, which the caller handles.
   */
  showChangelog: boolean;
  /** Persist that the intro has now been seen. */
  writeIntroSeen: boolean;
  /** Persist the running version as the last one seen. */
  writeLastVersion: boolean;
}

export function decideFirstRun(input: FirstRunInput): FirstRunDecision {
  // The intro is due once ever per database; the changelog whenever the version changed
  // — including the very first launch, where lastVersion is null. That is the tester's
  // case: an existing database that never recorded a version, opened under a new build.
  // Turning the opening animation off in Settings skips it outright, but the flag is
  // still recorded — otherwise switching it back on would replay an intro the user has
  // already seen, on a database that is no longer new.
  const introDue = input.seenIntro !== '1';
  const introWanted = input.introEnabled !== false;
  const changelogDue = input.lastVersion !== input.version;

  // Automation suppresses the *visible* popups so they never block E2E, but the flags
  // are still recorded (throwaway databases, and it keeps the write path testable).
  return {
    playIntro: introDue && introWanted && !input.isAutomation,
    showChangelog: changelogDue && !input.isAutomation,
    writeIntroSeen: introDue,
    writeLastVersion: changelogDue,
  };
}

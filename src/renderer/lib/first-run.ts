/**
 * Decides whether to open the release notes, from persisted flags.
 *
 * Pure so it can be unit-tested without launching Electron — the App wires it to the
 * SQLite preferences table (which travels with the user's database, unlike localStorage
 * that resets when they download a fresh build).
 */

export interface FirstRunInput {
  /** Stored 'last-seen-version', or null if never recorded. */
  lastVersion: string | null;
  /** The running app version. */
  version: string;
  /** True under test automation — suppresses the popup so it never blocks a test run. */
  isAutomation: boolean;
}

export interface FirstRunDecision {
  /** Open the release notes. */
  showChangelog: boolean;
  /** Persist the running version as the last one seen. */
  writeLastVersion: boolean;
}

export function decideFirstRun(input: FirstRunInput): FirstRunDecision {
  // Release notes are *news*: they open once per version — the first launch on a version
  // the database has not recorded, including the very first launch, where lastVersion is
  // null. The splash is not decided here; it is a main-process window governed by its own
  // Settings toggle (see main/services/splash.ts).
  const changelogDue = input.lastVersion !== input.version;

  // Automation suppresses the *visible* popup so it never blocks E2E, but the version is
  // still recorded (throwaway databases, and it keeps the write path testable).
  return {
    showChangelog: changelogDue && !input.isAutomation,
    writeLastVersion: changelogDue,
  };
}

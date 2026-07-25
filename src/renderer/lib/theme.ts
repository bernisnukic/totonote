/**
 * Resolving the chosen theme to an actual one.
 *
 * "system" isn't a palette — it's a promise to follow whatever the OS is doing, which means
 * resolving it at render time *and* re-resolving when the OS switches. Keeping that in one
 * pure function makes the mapping testable without a DOM.
 */

/** What the user picked, including the follow-the-OS option. */
export type ThemeChoice = 'system' | 'light' | 'wood' | 'dark' | 'black';

/** A theme that actually has colours behind it. */
export type ResolvedTheme = Exclude<ThemeChoice, 'system'>;

/** The dark theme is the app's own look, so that's what an unknown or dark system gets. */
export const SYSTEM_DARK: ResolvedTheme = 'dark';
export const SYSTEM_LIGHT: ResolvedTheme = 'light';

export function resolveTheme(choice: string, prefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return prefersDark ? SYSTEM_DARK : SYSTEM_LIGHT;
  if (choice === 'light' || choice === 'wood' || choice === 'dark' || choice === 'black') {
    return choice;
  }
  // An unrecognised stored value (an older or newer build) shouldn't leave the app unstyled.
  return SYSTEM_DARK;
}

export function followsSystem(choice: string): boolean {
  return choice === 'system';
}

/**
 * How long the splash stays up, broken into the parts it is actually made of.
 *
 * Separate from `splash.ts` so it can be checked against `intro.gif` itself without pulling
 * Electron into a unit test. The numbers describe the animation, so if the animation is
 * re-exported these have to move with it — `splash-timing.test.ts` fails when they disagree.
 */

/** The fade-in in splash.html, before the animation is given its source. */
export const FADE_IN_MS = 450;

/** One play-through of intro.gif: 33 frames at 100ms, measured from the file. */
export const ANIMATION_MS = 3300;

/** How long the finished mark is held before handing over to the app. */
export const LINGER_MS = 900;

/**
 * The three added together rather than one guessed figure. The old single number was
 * 3150ms against a 3300ms animation, so the last five frames were cut off every launch.
 */
export const MINIMUM_MS = FADE_IN_MS + ANIMATION_MS + LINGER_MS;

/**
 * How long to wait for the main window before giving up and showing it anyway. A splash
 * that outlives a wedged renderer would leave someone staring at a logo forever.
 */
export const MAXIMUM_MS = 12000;

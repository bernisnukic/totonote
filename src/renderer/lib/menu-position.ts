/**
 * Keeping a pop-up menu on screen.
 *
 * A menu anchored where the pointer was runs off the bottom of the window when you
 * right-click near it, and the items you wanted are the ones cut off. Every desktop menu
 * handles this by opening upwards instead — this works out where it should actually go.
 *
 * Pure, so the arithmetic can be tested without a browser.
 */

/** Distance kept between the menu and the window edge. */
const MARGIN = 8;

export interface Placement {
  left: number;
  top: number;
}

export function fitOnScreen(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): Placement {
  // Flip above the pointer when there isn't room below, which is what makes a menu
  // opened near the bottom of the window usable at all.
  let top = y;
  if (y + height > viewportHeight - MARGIN) {
    top = y - height;
  }
  let left = x;
  if (x + width > viewportWidth - MARGIN) {
    left = x - width;
  }

  // A menu taller or wider than the window can't be placed cleanly either way; pin it to
  // the top-left corner so at least the first items are reachable.
  return {
    left: Math.max(MARGIN, left),
    top: Math.max(MARGIN, top),
  };
}

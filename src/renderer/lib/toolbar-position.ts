/**
 * Where the floating Tag toolbar goes.
 *
 * Over text it sits just above the selection, which is what everyone expects. Selecting a
 * picture or a drawing is different: the selection is the whole node, and placing the
 * toolbar at the top of it put it *on* the drawing, hiding the thing you had just clicked.
 * Reported as "when u left click once on drawing, the pop up thing should not be covering
 * the drawing, it should be like tagged text".
 *
 * So the toolbar is placed above the node's box, and only drops below it when there isn't
 * room above — which is better than covering the node either way.
 *
 * Pure, so the arithmetic is testable without a browser.
 */

/** Height of the toolbar plus the gap it keeps from what it points at. */
export const TOOLBAR_OFFSET = 40;

/** Never overlap the title bar, and leave the toolbar reachable. */
const TOP_LIMIT = 56;

export interface Box {
  top: number;
  bottom: number;
  left: number;
}

export function toolbarPosition(box: Box, viewportHeight: number): { x: number; y: number } {
  const above = box.top - TOOLBAR_OFFSET;
  if (above >= TOP_LIMIT) return { x: box.left, y: above };

  // No room above. Below the node keeps it off the node itself; if that is off-screen too,
  // pin it to the top limit and accept the overlap rather than putting it out of reach.
  const below = box.bottom + 8;
  if (below + TOOLBAR_OFFSET <= viewportHeight) return { x: box.left, y: below };
  return { x: box.left, y: TOP_LIMIT };
}

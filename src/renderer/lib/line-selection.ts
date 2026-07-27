/**
 * Where Shift+End should leave the selection.
 *
 * Reported as "when there's an image under a text and i select only the text, the image
 * keeps getting selected too". Shift+End extended past the end of the paragraph and into
 * the block below, so a picture underneath ended up inside the selection — and anything
 * done to that selection would have taken it too.
 *
 * Selecting text *and* a picture together is still possible by dragging, which is a
 * deliberate act; it just isn't what Shift+End does by accident.
 */
export interface LineRange {
  from: number;
  to: number;
}

/**
 * The range Shift+End should produce, or null to leave it to the editor.
 *
 * `anchor` is where the selection is held, `head` where it currently ends, and `blockEnd`
 * the last position inside the text block the caret is in.
 */
export function shiftEndRange(anchor: number, head: number, blockEnd: number): LineRange | null {
  // Already exactly at the end of the line: nothing to correct, let the editor decide
  // (pressing it twice should not keep firing).
  if (head === blockEnd) return null;
  // Selecting backwards — the anchor is after the caret — is not what this is for.
  if (anchor > blockEnd) return null;
  return { from: anchor, to: blockEnd };
}

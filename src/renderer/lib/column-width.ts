/**
 * How wide a picture or a drawing is allowed to be dragged.
 *
 * Measured from the editor's own text column, deliberately, and never from an ancestor of
 * the node being resized. Those ancestors include the wrapper TipTap puts around a React
 * node view, and anything that makes that wrapper shrink to fit its contents turns the
 * ceiling into "however wide it is right now" — so every drag could take width away and
 * none could give it back, and the drawing ratcheted down to nothing. The column does not
 * move when the thing inside it is resized, which is the whole point.
 */
export function columnWidth(column: HTMLElement | null | undefined, fallback: number): number {
  if (!column) return fallback;
  const style = getComputedStyle(column);
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const available = column.clientWidth - padding;
  // A column that has not been laid out yet measures zero; better to allow the drag than
  // to clamp everything to nothing.
  return available > 0 ? available : fallback;
}

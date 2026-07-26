import { useLayoutEffect, useState, type RefObject } from 'react';
import { fitOnScreen, type Placement } from '../lib/menu-position';

/**
 * Position a pop-up menu so it stays on screen, flipping above or left of the pointer
 * when there isn't room. Measure after paint, before the browser shows it, so it never
 * appears in the wrong place first.
 */
export function useMenuPosition(
  ref: RefObject<HTMLElement | null>,
  x: number,
  y: number,
): Placement {
  const [placement, setPlacement] = useState<Placement>({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPlacement(fitOnScreen(x, y, width, height, window.innerWidth, window.innerHeight));
    // The menu's own size changes when its contents do — the combine list expands in
    // place — so re-measure on those too, not only when the pointer position changes.
  }, [ref, x, y, ref.current?.clientHeight]);

  return placement;
}

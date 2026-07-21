import React, { useEffect, useRef, useState } from 'react';

/**
 * One floating tooltip for the whole app, driven by `data-tip` attributes.
 *
 * Native `title` tooltips wait ~1–3 seconds, vanish if the cursor twitches, and
 * sometimes never appear at all — which made the toolbar's icon-only buttons close to
 * unusable. Any element with `data-tip="…"` gets a tooltip after SHOW_DELAY_MS instead.
 * Keep an `aria-label` on those elements too: `data-tip` means nothing to a screen
 * reader.
 */
const SHOW_DELAY_MS = 150;
const GAP = 8;

interface TipState {
  text: string;
  x: number;
  y: number;
  above: boolean;
}

export function TooltipHost() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const cancel = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTip(null);
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (!el) return;
      const text = el.getAttribute('data-tip');
      if (!text) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Re-measure at show time: the element may have moved while we waited.
        const r = el.getBoundingClientRect();
        // Prefer below; flip above when there is no room.
        const above = r.bottom + 40 > window.innerHeight;
        setTip({
          text,
          x: r.left + r.width / 2,
          y: above ? r.top - GAP : r.bottom + GAP,
          above,
        });
      }, SHOW_DELAY_MS);
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', cancel);
    // Any of these mean the pointer has moved on or the layout changed under it.
    document.addEventListener('mousedown', cancel);
    document.addEventListener('keydown', cancel);
    window.addEventListener('scroll', cancel, true);
    window.addEventListener('blur', cancel);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', cancel);
      document.removeEventListener('mousedown', cancel);
      document.removeEventListener('keydown', cancel);
      window.removeEventListener('scroll', cancel, true);
      window.removeEventListener('blur', cancel);
    };
  }, []);

  if (!tip) return null;

  return (
    <div
      className={`app-tooltip${tip.above ? ' app-tooltip--above' : ''}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
    </div>
  );
}

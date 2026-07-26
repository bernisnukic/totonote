import { describe, it, expect } from 'vitest';
import { fitOnScreen } from './menu-position';

const VW = 1000;
const VH = 800;

describe('keeping a menu on screen', () => {
  it('opens down and right when there is room, exactly where clicked', () => {
    expect(fitOnScreen(100, 100, 200, 300, VW, VH)).toEqual({ left: 100, top: 100 });
  });

  it('opens upwards when it would run off the bottom', () => {
    // Right-clicking 60px from the bottom with a 300px menu: it must not be cut off.
    expect(fitOnScreen(100, 740, 200, 300, VW, VH)).toEqual({ left: 100, top: 440 });
  });

  it('opens leftwards when it would run off the right', () => {
    expect(fitOnScreen(900, 100, 200, 300, VW, VH)).toEqual({ left: 700, top: 100 });
  });

  it('flips both ways at once in the bottom-right corner', () => {
    expect(fitOnScreen(900, 740, 200, 300, VW, VH)).toEqual({ left: 700, top: 440 });
  });

  it('leaves a margin rather than sitting flush against the edge', () => {
    const { top } = fitOnScreen(100, 795, 200, 300, VW, VH);
    expect(top).toBeGreaterThanOrEqual(8);
  });

  it('pins a menu taller than the window to the top rather than off it', () => {
    expect(fitOnScreen(100, 700, 200, 2000, VW, VH).top).toBe(8);
  });

  it('pins a menu wider than the window to the left edge', () => {
    expect(fitOnScreen(900, 100, 2000, 300, VW, VH).left).toBe(8);
  });

  it('handles a click in the very corner', () => {
    const p = fitOnScreen(1000, 800, 200, 300, VW, VH);
    expect(p.left).toBe(800);
    expect(p.top).toBe(500);
  });
});

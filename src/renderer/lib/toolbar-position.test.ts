import { describe, it, expect } from 'vitest';
import { toolbarPosition, TOOLBAR_OFFSET } from './toolbar-position';

const VIEWPORT = 900;

describe('toolbarPosition', () => {
  it('sits above what is selected', () => {
    expect(toolbarPosition({ top: 400, bottom: 700, left: 120 }, VIEWPORT)).toEqual({
      x: 120,
      y: 400 - TOOLBAR_OFFSET,
    });
  });

  it('never covers a tall drawing, however tall it is', () => {
    // The whole point: the toolbar keys off the *top* of the node, so a 600px drawing is
    // no more covered than a line of text is.
    const { y } = toolbarPosition({ top: 200, bottom: 800, left: 0 }, VIEWPORT);
    expect(y).toBeLessThan(200);
  });

  it('drops below when there is no room above', () => {
    // A drawing at the very top of the window: above would be under the title bar.
    expect(toolbarPosition({ top: 60, bottom: 300, left: 40 }, VIEWPORT)).toEqual({
      x: 40,
      y: 308,
    });
  });

  it('pins to the top when there is room neither above nor below', () => {
    // Taller than the window — going below would put it off-screen and out of reach.
    expect(toolbarPosition({ top: 10, bottom: 1200, left: 8 }, VIEWPORT)).toEqual({ x: 8, y: 56 });
  });

  it('keeps the left edge of what is selected', () => {
    expect(toolbarPosition({ top: 500, bottom: 520, left: 333 }, VIEWPORT).x).toBe(333);
  });
});

import { describe, it, expect } from 'vitest';
import { shiftEndRange } from './line-selection';

describe('what Shift+End should select', () => {
  it('extends from the caret to the end of the line', () => {
    // Caret at the start of a paragraph whose content ends at 20.
    expect(shiftEndRange(1, 1, 20)).toEqual({ from: 1, to: 20 });
  });

  it('stops at the end of the line, not past it', () => {
    // The reported bug: the selection ran on to 25, into the block below — a picture, in
    // their case — so the picture was selected along with the words.
    const range = shiftEndRange(1, 25, 20);
    expect(range).toEqual({ from: 1, to: 20 });
    expect(range!.to).toBeLessThanOrEqual(20);
  });

  it('does nothing when the selection already ends there', () => {
    // Otherwise pressing it again would keep dispatching for no reason.
    expect(shiftEndRange(1, 20, 20)).toBeNull();
  });

  it('keeps the anchor where it was, so only the far end moves', () => {
    expect(shiftEndRange(8, 30, 20)).toEqual({ from: 8, to: 20 });
  });

  it('leaves a backwards selection alone', () => {
    // Anchor beyond this line: the caret came from somewhere below, and clamping to this
    // line's end would turn the selection inside out.
    expect(shiftEndRange(40, 5, 20)).toBeNull();
  });

  it('handles an empty line, where there is nothing to extend over', () => {
    expect(shiftEndRange(1, 1, 1)).toBeNull();
  });
});

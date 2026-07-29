import { describe, it, expect } from 'vitest';
import { columnWidth } from './column-width';

/**
 * A fake element, because the real one needs a browser. Only the two things `columnWidth`
 * reads are provided.
 */
function fakeColumn(clientWidth: number, paddingLeft = '0px', paddingRight = '0px') {
  return {
    clientWidth,
    // getComputedStyle is called on this; stub it globally per test instead.
    __padding: { paddingLeft, paddingRight },
  } as unknown as HTMLElement;
}

const originalGetComputedStyle = globalThis.getComputedStyle;

function withPadding<T>(run: () => T): T {
  globalThis.getComputedStyle = ((el: Element) =>
    (el as unknown as { __padding: Record<string, string> })
      .__padding) as unknown as typeof getComputedStyle;
  try {
    return run();
  } finally {
    globalThis.getComputedStyle = originalGetComputedStyle;
  }
}

describe('columnWidth', () => {
  it('is the column width when there is no padding', () => {
    withPadding(() => {
      expect(columnWidth(fakeColumn(786), 100)).toBe(786);
    });
  });

  it('excludes horizontal padding, so a drawing cannot be dragged into it', () => {
    withPadding(() => {
      expect(columnWidth(fakeColumn(800, '24px', '16px'), 100)).toBe(760);
    });
  });

  it('falls back when the column has not been laid out yet', () => {
    // Zero would otherwise clamp every drag to nothing.
    withPadding(() => {
      expect(columnWidth(fakeColumn(0), 320)).toBe(320);
    });
  });

  it('falls back when there is no column at all', () => {
    expect(columnWidth(null, 320)).toBe(320);
    expect(columnWidth(undefined, 320)).toBe(320);
  });

  it('falls back rather than going negative when padding exceeds the width', () => {
    withPadding(() => {
      expect(columnWidth(fakeColumn(20, '30px', '30px'), 250)).toBe(250);
    });
  });
});

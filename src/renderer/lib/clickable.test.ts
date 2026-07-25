import { describe, it, expect, vi } from 'vitest';
import { clickable } from './clickable';

/** A keyboard event as React would deliver it, with the bits the helper reads. */
function keyEvent(key: string, sameTarget = true) {
  const target = {};
  return {
    key,
    target: sameTarget ? target : {},
    currentTarget: target,
    preventDefault: vi.fn(),
  } as never;
}

describe('making a div usable from the keyboard', () => {
  it('gives it a role and a place in the tab order', () => {
    const props = clickable(() => undefined);
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
  });

  it('activates on Enter and on Space, the way a button does', () => {
    for (const key of ['Enter', ' ']) {
      const onActivate = vi.fn();
      clickable(onActivate).onKeyDown(keyEvent(key));
      expect(onActivate).toHaveBeenCalledTimes(1);
    }
  });

  it('stops Space from scrolling the page as well', () => {
    const event = keyEvent(' ');
    clickable(() => undefined).onKeyDown(event);
    expect((event as unknown as { preventDefault: ReturnType<typeof vi.fn> }).preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys, so typing still reaches whatever is inside', () => {
    const onActivate = vi.fn();
    const props = clickable(onActivate);
    for (const key of ['a', 'Tab', 'ArrowDown', 'Escape']) props.onKeyDown(keyEvent(key));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores Enter that came from something nested inside, like a text field', () => {
    const onActivate = vi.fn();
    clickable(onActivate).onKeyDown(keyEvent('Enter', false));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('still handles a plain click', () => {
    const onActivate = vi.fn();
    clickable(onActivate).onClick({} as never);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('announces a label when the visible content would not be enough', () => {
    expect(clickable(() => undefined, { label: 'Delete tag' })['aria-label']).toBe('Delete tag');
  });

  it('a disabled one takes no clicks, no keys, and leaves the tab order', () => {
    const onActivate = vi.fn();
    const props = clickable(onActivate, { disabled: true });
    props.onClick({} as never);
    props.onKeyDown(keyEvent('Enter'));
    expect(onActivate).not.toHaveBeenCalled();
    expect(props.tabIndex).toBe(-1);
    expect(props['aria-disabled']).toBe(true);
  });
});

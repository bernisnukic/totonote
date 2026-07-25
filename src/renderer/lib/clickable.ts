import type React from 'react';

/**
 * Make a `<div>` or `<span>` that behaves like a button behave like one for the keyboard too.
 *
 * Plenty of the app's controls are divs — rows, menu items, tabs — because they need layouts
 * a `<button>` fights with. A div with an onClick is invisible to the keyboard: it takes no
 * focus, Enter does nothing, and a screen reader announces nothing. Spreading this fixes all
 * three:
 *
 *     <div {...clickable(() => open(doc))} className="row">…</div>
 *
 * Space is included alongside Enter because that is what a real button does, and it is
 * prevented from also scrolling the page.
 *
 * Where a real `<button>` will do, use one — this is for the cases where it won't.
 */
export function clickable<T extends HTMLElement>(
  onActivate: (event: React.SyntheticEvent<T>) => void,
  options: { label?: string; disabled?: boolean } = {},
): {
  role: 'button';
  tabIndex: number;
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  onClick: React.MouseEventHandler<T>;
  onKeyDown: React.KeyboardEventHandler<T>;
} {
  const { label, disabled } = options;
  return {
    role: 'button',
    // -1 keeps a disabled control out of the tab order without hiding it.
    tabIndex: disabled ? -1 : 0,
    ...(label ? { 'aria-label': label } : {}),
    ...(disabled ? { 'aria-disabled': true } : {}),
    onClick: event => {
      if (disabled) return;
      onActivate(event);
    },
    onKeyDown: event => {
      if (disabled) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // Enter inside a text field or an editor means something else entirely.
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onActivate(event);
    },
  };
}

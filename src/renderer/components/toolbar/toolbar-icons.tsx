import React from 'react';

/**
 * The editor toolbar's formatting icons — the familiar bold-B / italic-I / list glyphs
 * every word processor uses. They're drawn as inline SVG (16px, currentColor stroke) so
 * they inherit the button's colour and active state, and ship with no icon dependency.
 *
 * The shapes follow the universal formatting convention (open Lucide-style paths); they are
 * not Microsoft's proprietary artwork.
 */

const S = 2;

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={S}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export type ToolbarIconName =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered';

export const ToolbarIcon: Record<ToolbarIconName, React.ReactElement> = {
  bold: (
    <Svg>
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
    </Svg>
  ),
  italic: (
    <Svg>
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </Svg>
  ),
  underline: (
    <Svg>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </Svg>
  ),
  strike: (
    <Svg>
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H7" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </Svg>
  ),
  h1: (
    <Svg>
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M17 12l3-2v8" />
    </Svg>
  ),
  h2: (
    <Svg>
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M17 10c0-1.5 1.5-2 3-1.5 1.5.5 1.5 2.5 0 3.5L17 18h5" />
    </Svg>
  ),
  h3: (
    <Svg>
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M17.5 9.5c1.7-.9 3.5.1 3.5 1.6a2 2 0 0 1-2 2" />
      <path d="M17 16.5c2 1.3 4 .3 4-1.4a2 2 0 0 0-2-2" />
    </Svg>
  ),
  bullet: (
    <Svg>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  ordered: (
    <Svg>
      <line x1="10" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </Svg>
  ),
};

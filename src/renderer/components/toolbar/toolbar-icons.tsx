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
  | 'ordered'
  | 'image'
  | 'draw'
  | 'sidebar'
  | 'graph'
  | 'timeline'
  | 'settings'
  | 'export';

export const ToolbarIcon: Record<ToolbarIconName, React.ReactElement> = {
  // A picture frame with a sun and a horizon — the convention everywhere.
  image: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </Svg>
  ),
  // An arrow coming down into a tray: save this out.
  export: (
    <Svg>
      <path d="M12 3v11" />
      <path d="M8 10.5l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  ),
  // A panel with a divider — the usual "show/hide the side panel".
  sidebar: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </Svg>
  ),
  // Connected nodes.
  graph: (
    <Svg>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <line x1="7.8" y1="7.6" x2="10.6" y2="15.6" />
      <line x1="16.4" y1="9" x2="13.4" y2="15.7" />
      <line x1="8.5" y1="6.3" x2="15.5" y2="6.8" />
    </Svg>
  ),
  // A clock, for time.
  timeline: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  ),
  // A cog: body, hole, and short teeth just outside the body. Radiating lines from a
  // small centre circle read as a sun at 16px, which is what the first attempt did.
  settings: (
    <Svg>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6" />
    </Svg>
  ),
  // A pencil, matching the ✎ this replaces.
  draw: (
    <Svg>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  ),
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

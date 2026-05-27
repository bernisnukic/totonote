const TAG_COLORS = [
  '#48dbfb', // Cyan
  '#ff6b6b', // Red
  '#ffd93d', // Yellow
  '#6bcb77', // Green
  '#4d96ff', // Blue
  '#ff6348', // Orange
  '#a55eea', // Purple
  '#fd79a8', // Pink
  '#00d2d3', // Teal
  '#ff9ff3', // Magenta
  '#54a0ff', // Sky Blue
  '#5f27cd', // Deep Purple
  '#01a3a4', // Dark Teal
  '#f368e0', // Hot Pink
  '#ff9f43', // Amber
  '#ee5a24', // Burnt Orange
];

export function getTagColor(index: number): string {
  return TAG_COLORS[index % TAG_COLORS.length];
}

export function getTagColors(): string[] {
  return [...TAG_COLORS];
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#48dbfb';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

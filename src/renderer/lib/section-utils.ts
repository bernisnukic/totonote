export function generateAbbreviation(title: string, maxLength = 3): string {
  const trimmed = title.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/);

  if (words.length === 1) {
    return trimmed.slice(0, maxLength).toUpperCase();
  }

  // Take first letter of each word
  const abbreviation = words
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return abbreviation.slice(0, maxLength);
}

export function estimateTabWidth(text: string, fontSize = 12): number {
  // Rough character width estimation for monospace font
  const charWidth = fontSize * 0.6;
  const padding = 24; // 12px each side
  return Math.ceil(text.length * charWidth + padding);
}

export function getNextSortOrder(sections: { sortOrder: number }[]): number {
  if (sections.length === 0) return 0;
  return Math.max(...sections.map(s => s.sortOrder)) + 1;
}

import type { AnnotationPlacement, Category } from './domain-types';

/**
 * Turning a compiled page into Markdown, so lore can leave the app.
 *
 * Everything lives in one database file, which is good for keeping a world together and
 * bad for sharing it. Markdown is the lowest-friction way out: it reads fine as plain
 * text, pastes into a wiki or a design doc, and renders on GitHub.
 *
 * Pure, so the formatting is testable without a filesystem or a database.
 */

export interface PageExport {
  title: string;
  /** Ancestor names, outermost first, shown as a trail under the heading. */
  breadcrumb?: string[];
  /** Excerpts filed directly on this page. */
  placements: AnnotationPlacement[];
  /** Child pages, each with their own filed excerpts. */
  children?: Array<{ category: Category; placements: AnnotationPlacement[] }>;
}

/** Markdown for one excerpt: the text, its note, and where it came from. */
export function excerptToMarkdown(placement: AnnotationPlacement): string {
  const lines: string[] = [];
  const body = placement.excerpt.trim();

  if (body) {
    // Block quote, so an excerpt is visibly someone's writing rather than commentary.
    lines.push(...body.split('\n').map(line => `> ${line}`.trimEnd()));
  } else if (placement.imageIds.length || placement.drawingIds.length) {
    const bits: string[] = [];
    if (placement.imageIds.length) bits.push(`${placement.imageIds.length} image(s)`);
    if (placement.drawingIds.length) bits.push(`${placement.drawingIds.length} drawing(s)`);
    // Pictures can't travel in a text file; say what was there rather than dropping it.
    lines.push(`> *[${bits.join(' and ')} — open TotoNote to see them]*`);
  } else {
    lines.push('> *[empty]*');
  }

  if (placement.note.trim()) lines.push('>', `> **Note:** ${placement.note.trim()}`);
  lines.push('', `— ${placement.tagName} · ${placement.documentTitle} › ${placement.sectionTitle}`);
  return lines.join('\n');
}

export function pageToMarkdown(page: PageExport): string {
  const out: string[] = [`# ${page.title}`];

  if (page.breadcrumb?.length) out.push('', `*${page.breadcrumb.join(' › ')} › ${page.title}*`);

  if (page.placements.length > 0) {
    out.push('');
    out.push(page.placements.map(excerptToMarkdown).join('\n\n'));
  }

  for (const child of page.children ?? []) {
    if (child.placements.length === 0) continue;
    out.push('', `## ${child.category.name}`, '');
    out.push(child.placements.map(excerptToMarkdown).join('\n\n'));
  }

  if (page.placements.length === 0 && !(page.children ?? []).some(c => c.placements.length > 0)) {
    out.push('', '*Nothing filed here yet.*');
  }

  return `${out.join('\n').trimEnd()}\n`;
}

/** A filename that is safe on every platform and still recognisable. */
export function pageFilename(title: string): string {
  const safe = title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${safe || 'page'}.md`;
}

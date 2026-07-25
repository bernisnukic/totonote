import { getEditor } from './editor-registry';
import type { AnnotationPlacement } from '../../shared/domain-types';

/**
 * The text an excerpt covers, preferring what is on screen right now.
 *
 * Excerpts arrive from the main process, computed from the *saved* section content — which
 * trails the debounced save by up to a second. File or date something and look at it
 * straight away and the server has nothing yet. Whenever the section is open in an editor,
 * that editor is the more current answer, so ask it first.
 */
export function excerptTextFor(placement: AnnotationPlacement): string {
  if (placement.excerpt) return placement.excerpt;

  const editor = getEditor(placement.sectionId);
  if (!editor) return '';
  try {
    return editor.state.doc.textBetween(placement.fromPos, placement.toPos, ' ').trim();
  } catch {
    // Positions can briefly outrun the document during an edit; a blank excerpt is a far
    // better outcome than a thrown error taking the panel down with it.
    return '';
  }
}

/**
 * Per-section "flush now" functions, registered by each SectionEditor.
 *
 * Auto-save uses the editor's own debounce. Manual-save mode (auto-save off) needs a way to
 * persist a section on demand — content *and* mapped annotation positions, which only the
 * live editor knows — so each SectionEditor registers a flusher here and the store calls it
 * on Cmd+S / save-and-quit.
 */
type Flusher = () => void | Promise<void>;

const flushers = new Map<string, Flusher>();

export function registerFlusher(sectionId: string, flush: Flusher): void {
  flushers.set(sectionId, flush);
}

export function unregisterFlusher(sectionId: string): void {
  flushers.delete(sectionId);
}

/** Flush one section if it has a registered editor; resolves once its save settles. */
export function flushSection(sectionId: string): void | Promise<void> {
  return flushers.get(sectionId)?.();
}

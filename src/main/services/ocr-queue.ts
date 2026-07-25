import { readTextFromImage } from './ocr';
import { setMediaOcrText, getMediaBytes, mediaWithoutOcr } from '../db/repositories/media-repo';
import { reindexSectionsUsingMedia } from '../db/repositories/search-repo';

/**
 * Runs recognition off to one side, one picture at a time.
 *
 * Importing an image must feel instant, so nothing here is awaited by the import — the
 * picture appears immediately and becomes searchable a moment later. Serialised because
 * recognition is CPU-bound: running several at once would make the app stutter for no gain.
 */

interface QueuedImage {
  mediaId: string;
  /** A straightened copy to read instead of the stored bytes, when one was prepared. */
  readable?: Buffer;
}

const queue: QueuedImage[] = [];
let running = false;

/** Queue one image. Safe to call for an id already queued or already done. */
export function queueImageForOcr(mediaId: string, readable?: Buffer): void {
  if (queue.some(item => item.mediaId === mediaId)) return;
  queue.push({ mediaId, readable });
  void drain();
}

/**
 * Look at anything imported before this feature existed.
 *
 * Bounded per launch so upgrading a world full of concept art doesn't peg a core for
 * minutes — the rest is picked up next time.
 */
export function queueOcrBacklog(limit = 25): number {
  const pending = mediaWithoutOcr(limit);
  for (const item of pending) queueImageForOcr(item.id);
  return pending.length;
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const { mediaId: id, readable } = queue.shift()!;
      try {
        // Prefer the straightened copy; fall back to the stored image for the backlog,
        // where no copy was ever prepared.
        const bytes = readable ?? getMediaBytes(id)?.data;
        if (!bytes) continue;
        const text = await readTextFromImage(bytes);
        setMediaOcrText(id, text);
        // The sections holding this picture now have more to match on.
        if (text) reindexSectionsUsingMedia(id);
      } catch (err) {
        // One bad picture must not stall the queue behind it.
        console.warn('[ocr] skipped', id, err);
      }
    }
  } finally {
    running = false;
  }
}

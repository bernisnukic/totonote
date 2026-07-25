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

const queue: string[] = [];
let running = false;

/** Queue one image. Safe to call for an id already queued or already done. */
export function queueImageForOcr(mediaId: string): void {
  if (queue.includes(mediaId)) return;
  queue.push(mediaId);
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
      const id = queue.shift()!;
      try {
        const found = getMediaBytes(id);
        if (!found) continue;
        const text = await readTextFromImage(found.data);
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

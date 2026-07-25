import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
// Static, and externalised in the build: this resolves to a plain require of the real
// package. A dynamic import would be code-split into a side chunk that both build paths
// then have to copy intact. The heavy part — the WASM core — is still only loaded when a
// worker is actually created, which is the cost we wanted to defer.
import { createWorker } from 'tesseract.js';

/**
 * Reading the text out of embedded pictures, so a label on a map is findable from the
 * search box even though it only exists as pixels.
 *
 * Runs **in the main process, in the background, once per image at import**. Recognition
 * costs a second or two of CPU; doing it on demand would make search feel broken, and
 * doing it in the renderer would stutter the editor.
 *
 * The language data is **vendored** (assets/ocr/eng.traineddata, shipped via
 * extraResource) rather than fetched: tesseract.js downloads it from a CDN by default,
 * which would quietly make a local-first, offline app depend on the network the first time
 * someone pasted a picture.
 */

/**
 * Words scoring below this are dropped.
 *
 * Chosen from measurement rather than taste: across clean, serif, fantasy, chalk,
 * handwriting-style, script and low-contrast renderings, every *correct* word scored 42 or
 * better, while a badly skewed image produced garbage at 8 and 19. Thirty sits in the gap
 * with margin at both ends. Indexing that garbage is worse than indexing nothing — it can
 * never match a real query, and it pollutes results.
 */
export const MIN_WORD_CONFIDENCE = 30;

interface OcrWord {
  text: string;
  confidence: number;
}

/** Loaded lazily — the module pulls in a WASM core we don't want to pay for at launch. */
type RecognizeResult = {
  data: {
    text: string;
    confidence: number;
    blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: OcrWord[] }> }> }>;
  };
};
type Worker = {
  recognize: (image: Buffer, opts?: unknown, output?: unknown) => Promise<RecognizeResult>;
  terminate: () => Promise<unknown>;
};
let workerPromise: Promise<Worker | null> | null = null;

/** Where the vendored language data lives, in dev and in a packaged build. */
function languageDir(): string | null {
  const candidates = [
    path.join(app.getAppPath(), 'assets', 'ocr'),
    path.join(process.cwd(), 'assets', 'ocr'),
    process.resourcesPath ? path.join(process.resourcesPath, 'ocr') : '',
  ].filter(Boolean);
  return candidates.find(dir => fs.existsSync(path.join(dir, 'eng.traineddata'))) ?? null;
}

async function getWorker(): Promise<Worker | null> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const langPath = languageDir();
      if (!langPath) {
        console.warn('[ocr] language data not found; text in images will not be searchable');
        return null;
      }
      try {
        // cachePath in userData so nothing is ever written next to the app bundle.
        return (await createWorker('eng', 1, {
          langPath,
          gzip: false,
          cachePath: app.getPath('userData'),
        })) as unknown as Worker;
      } catch (err) {
        console.warn('[ocr] could not start:', err);
        return null;
      }
    })();
  }
  return workerPromise;
}

/**
 * Text found in an image, or '' when there is none.
 *
 * Never throws: an unreadable picture must not break the import that triggered it. Empty
 * string is a real answer meaning "looked, found nothing", which is what stops it being
 * retried forever.
 */
export async function readTextFromImage(bytes: Buffer): Promise<string> {
  const worker = await getWorker();
  if (!worker) return '';
  try {
    // `blocks` gives per-word confidence, which is what lets the guessing be thrown away
    // while keeping the words it actually read.
    const { data } = await worker.recognize(bytes, {}, { blocks: true });
    const lines = (data.blocks ?? [])
      .flatMap(block => block.paragraphs ?? [])
      .flatMap(paragraph => paragraph.lines ?? []);
    if (lines.length === 0) return normalise(data.text);
    return normalise(confidentText(lines));
  } catch (err) {
    console.warn('[ocr] recognition failed:', err);
    return '';
  }
}

/**
 * The words worth keeping, line by line.
 *
 * Filtering per word rather than rejecting the whole picture means a map whose big labels
 * read cleanly still contributes them, even when the small print underneath is a mess.
 */
export function confidentText(
  lines: Array<{ words?: OcrWord[] }>,
  minConfidence = MIN_WORD_CONFIDENCE,
): string {
  return lines
    .map(line =>
      (line.words ?? [])
        .filter(word => word.confidence >= minConfidence && word.text.trim())
        .map(word => word.text.trim())
        .join(' '),
    )
    .filter(Boolean)
    .join('\n');
}

/**
 * Tidy the raw output.
 *
 * Recognition emits ragged whitespace and stray single characters where it mistook noise
 * for letters; those add nothing to an index and make snippets look broken.
 */
export function normalise(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 1)
    .join('\n')
    .trim();
}

export async function shutdownOcr(): Promise<void> {
  const worker = await workerPromise?.catch(() => null);
  if (worker) await worker.terminate().catch(() => undefined);
  workerPromise = null;
}

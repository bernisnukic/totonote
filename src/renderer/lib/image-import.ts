import { invoke } from './ipc-client';
import { mediaUrl } from '../../shared/media-refs';
import type { MediaMeta } from '../../shared/domain-types';

/**
 * Bringing an image file into the database.
 *
 * A world's concept art would otherwise take the `.db` file to hundreds of megabytes, so
 * oversized images are scaled down once on import rather than every time they're drawn.
 * The originals aren't kept — this is a reference-keeping tool, not an asset library, and
 * the user still has their source files.
 */

/** Longest edge an imported image is allowed to keep. */
export const MAX_IMAGE_DIMENSION = 2000;

/** Above this, a re-encode to WebP is worth the quality trade for the space saved. */
export const RECOMPRESS_OVER_BYTES = 512 * 1024;

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

export function isSupportedImage(file: { type: string }): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type);
}

/**
 * The size an image should be stored at: unchanged when it already fits, otherwise scaled
 * to fit `max` on its longest edge, keeping the aspect ratio. Pure, so the rule is testable
 * without a canvas.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_IMAGE_DIMENSION,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height, scaled: false };
  const ratio = max / longest;
  return {
    // Round, but never collapse an edge to zero on a very long thin image.
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

/** Whether the bytes are worth re-encoding rather than storing as they are. */
export function shouldRecompress(byteSize: number, scaled: boolean): boolean {
  // A scaled image has to be re-encoded anyway; an unscaled one only if it's big.
  return scaled || byteSize > RECOMPRESS_OVER_BYTES;
}

/**
 * Decode, downscale if needed, store, and return the metadata plus the url to put in the
 * document. Animated GIFs are stored untouched — drawing one to a canvas would flatten it
 * to its first frame.
 */
export async function importImageFile(file: File): Promise<{ meta: MediaMeta; url: string }> {
  const bitmap = await createImageBitmap(file);
  const target = fitWithin(bitmap.width, bitmap.height);
  const animated = file.type === 'image/gif';

  let mimeType = file.type;
  let bytes: Uint8Array;
  let width = bitmap.width;
  let height = bitmap.height;

  if (animated || !shouldRecompress(file.size, target.scaled)) {
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the image for import.');
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/webp', 0.9),
    );
    if (!blob) throw new Error('Could not encode the image.');
    bytes = new Uint8Array(await blob.arrayBuffer());
    mimeType = 'image/webp';
    width = target.width;
    height = target.height;
  }

  bitmap.close();

  const meta = await invoke('media:create', { mimeType, width, height, data: bytes });
  return { meta, url: mediaUrl(meta.id) };
}

/** Image files out of a paste or drop, ignoring anything else that came along. */
export function imageFilesFrom(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];
  return Array.from(dataTransfer.files).filter(isSupportedImage);
}

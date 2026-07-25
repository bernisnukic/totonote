import { invoke } from './ipc-client';
import { estimateSkew, needsCorrection, toGray } from './deskew';
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

/** Longest edge of the copy sent for reading — enough detail, far quicker than full size. */
const OCR_MAX_DIMENSION = 1600;

/**
 * A copy of the picture prepared for reading its text: greyscale, and straightened if it
 * is noticeably tilted.
 *
 * The *stored* picture is never touched — this is a throwaway variant. Tesseract assumes
 * roughly horizontal lines, and a modest tilt is the difference between reading a map
 * label and producing nonsense, so it is worth straightening before it is read.
 *
 * Returns null when nothing needed doing, so the caller can just use the original.
 */
export async function prepareForReading(bitmap: ImageBitmap): Promise<Uint8Array | null> {
  const scale = Math.min(1, OCR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);

  const gray = toGray(context.getImageData(0, 0, width, height).data, width, height);
  const angle = estimateSkew(gray);
  if (!needsCorrection(angle)) return null;

  // Rotate the other way to bring the text level, on a canvas big enough that the corners
  // aren't clipped off — a clipped label is no more readable than a tilted one.
  const radians = (-angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const rotated = document.createElement('canvas');
  rotated.width = Math.ceil(width * cos + height * sin);
  rotated.height = Math.ceil(width * sin + height * cos);
  const rotatedContext = rotated.getContext('2d');
  if (!rotatedContext) return null;
  // White, so the new corners read as paper rather than ink.
  rotatedContext.fillStyle = '#ffffff';
  rotatedContext.fillRect(0, 0, rotated.width, rotated.height);
  rotatedContext.translate(rotated.width / 2, rotated.height / 2);
  rotatedContext.rotate(radians);
  rotatedContext.drawImage(canvas, -width / 2, -height / 2);

  const blob = await new Promise<Blob | null>(resolve => rotated.toBlob(resolve, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
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

  // Prepared before the bitmap is released; failing here must not stop the import, since
  // the picture is still perfectly usable without its text being read.
  let readable: Uint8Array | null = null;
  try {
    readable = await prepareForReading(bitmap);
  } catch (err) {
    console.warn('[image import] could not prepare for reading:', err);
  }

  bitmap.close();

  const meta = await invoke('media:create', {
    mimeType,
    width,
    height,
    data: bytes,
    readableData: readable ?? undefined,
  });
  return { meta, url: mediaUrl(meta.id) };
}

/** Image files out of a paste or drop, ignoring anything else that came along. */
export function imageFilesFrom(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];
  return Array.from(dataTransfer.files).filter(isSupportedImage);
}

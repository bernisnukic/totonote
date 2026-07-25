/**
 * Straightening a picture before its text is read.
 *
 * Tesseract assumes roughly horizontal lines. Measured on our own pipeline, a 12° tilt took
 * "Frozen Harbour" to "grozel Haroou!" — text that reads perfectly when level becomes
 * unusable when it isn't. Map labels are exactly the case where that happens.
 *
 * The angle is found by **projection profile**: rotate a small grayscale copy through a
 * range of angles and, for each, sum the dark pixels in every row. When the rows line up
 * with the text, most rows are either "a line of text" or "the gap between two", so those
 * sums vary a lot. When the text is tilted, every row cuts through both and the sums
 * flatten out. The angle with the highest variance is the one the text sits at.
 *
 * Pure arithmetic over a pixel array — no canvas, so the choice of angle is testable.
 */

/** How far either side of level to look. Beyond this it isn't skew, it's a rotated image. */
export const MAX_SKEW_DEGREES = 15;

/** Below this the tilt costs nothing, and rotating would only resample the image for free. */
export const MIN_CORRECTION_DEGREES = 1;

export interface Gray {
  /** One byte per pixel, 0 = black. */
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/** RGBA from a canvas to a single grayscale plane. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    // Rec. 601 luma: green carries most perceived brightness.
    out[p] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  return { data: out, width, height };
}

/**
 * How strongly rows separate into text and gaps at this angle.
 *
 * Higher means the rows line up with the text better.
 */
export function profileScore(gray: Gray, degrees: number): number {
  const { data, width, height } = gray;
  if (width === 0 || height === 0) return 0;

  const radians = (degrees * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const centreX = width / 2;
  const centreY = height / 2;
  const rows = new Float64Array(height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Rotating the *sampling* rather than the image avoids allocating a copy per angle.
      const dx = x - centreX;
      const dy = y - centreY;
      const sourceY = Math.round(centreY + dx * sin + dy * cos);
      const sourceX = Math.round(centreX + dx * cos - dy * sin);
      if (sourceX < 0 || sourceX >= width || sourceY < 0 || sourceY >= height) continue;
      // Ink, not paper: dark pixels are what text is made of.
      rows[y] += 255 - data[sourceY * width + sourceX];
    }
  }

  let mean = 0;
  for (let y = 0; y < height; y++) mean += rows[y];
  mean /= height;

  let variance = 0;
  for (let y = 0; y < height; y++) {
    const d = rows[y] - mean;
    variance += d * d;
  }
  return variance / height;
}

/**
 * The angle the text sits at, in degrees (positive = rotated clockwise).
 *
 * Two passes: whole degrees across the range, then a finer sweep around the winner, which
 * costs far less than scanning the whole range finely.
 */
export function estimateSkew(gray: Gray, maxDegrees = MAX_SKEW_DEGREES): number {
  let best = 0;
  let bestScore = -1;

  for (let angle = -maxDegrees; angle <= maxDegrees; angle += 1) {
    const score = profileScore(gray, angle);
    if (score > bestScore) {
      bestScore = score;
      best = angle;
    }
  }

  for (let angle = best - 0.75; angle <= best + 0.75; angle += 0.25) {
    const score = profileScore(gray, angle);
    if (score > bestScore) {
      bestScore = score;
      best = angle;
    }
  }

  return Math.round(best * 4) / 4;
}

/** Whether a tilt is worth correcting at all. */
export function needsCorrection(degrees: number): boolean {
  return Math.abs(degrees) >= MIN_CORRECTION_DEGREES;
}

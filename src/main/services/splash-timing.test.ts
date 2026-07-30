import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FADE_IN_MS, ANIMATION_MS, LINGER_MS, MINIMUM_MS, MAXIMUM_MS } from './splash-timing';

/**
 * The splash timings against the animation they describe.
 *
 * Both failures this guards are silent. The wait used to be a single 3150ms figure against
 * a 3300ms animation, so the last five frames were cut off on every launch and nothing
 * said so. And `intro.gif` is patched to play once — re-export it from almost any tool and
 * it comes back looping, at which point "linger on the last frame" quietly becomes "start
 * again", with no error anywhere.
 */

const GIF = path.join(__dirname, '..', '..', '..', 'assets', 'splash', 'intro.gif');

interface GifFacts {
  frames: number;
  durationMs: number;
  /** 0 means forever; 1 means play once and stop. */
  loopCount: number | null;
}

/** Read frame delays and the NETSCAPE loop count straight out of the file. */
function readGif(file: string): GifFacts {
  const data = fs.readFileSync(file);
  const delays: number[] = [];
  let loopCount: number | null = null;
  let i = 0;
  while (i < data.length - 3) {
    // Graphic Control Extension: 0x21 0xF9 0x04, then flags, then a 2-byte delay.
    if (data[i] === 0x21 && data[i + 1] === 0xf9 && data[i + 2] === 4) {
      delays.push(data.readUInt16LE(i + 4));
      i += 8;
      continue;
    }
    // Application Extension: 0x21 0xFF 0x0B "NETSCAPE2.0", then the loop sub-block.
    if (
      data[i] === 0x21 &&
      data[i + 1] === 0xff &&
      data[i + 2] === 11 &&
      data.subarray(i + 3, i + 14).toString('latin1') === 'NETSCAPE2.0'
    ) {
      loopCount = data.readUInt16LE(i + 16);
      i += 19;
      continue;
    }
    i += 1;
  }
  // Delays are stored in hundredths of a second.
  return { frames: delays.length, durationMs: delays.reduce((a, d) => a + d * 10, 0), loopCount };
}

describe('splash timings', () => {
  const gif = readGif(GIF);

  it('reads the animation at all', () => {
    // Guards the parser: a zero-frame read would make everything below vacuously pass.
    expect(gif.frames).toBeGreaterThan(1);
  });

  it('plays once, so there is a last frame to linger on', () => {
    // No NETSCAPE block at all. Setting the loop count to 1 is *not* how a GIF is made to
    // play once — Chromium reads it as "repeat once more" and plays it twice, which is
    // what shipped in 1.23.1: the splash closed partway through the second play-through.
    // A GIF with no loop extension plays exactly once and stops on its last frame.
    expect(gif.loopCount).toBeNull();
  });

  it('ships the still of the first frame that the fade lands on', () => {
    // Without it the fade arrives at an empty box, which renders as a pale rectangle on
    // the black card — reported as "at the start i see a white border instead of all
    // black".
    expect(fs.existsSync(path.join(path.dirname(GIF), 'intro-first.png'))).toBe(true);
  });

  it('waits for the whole animation, not most of it', () => {
    expect(ANIMATION_MS).toBe(gif.durationMs);
  });

  it('is the fade, the animation and the pause added up', () => {
    expect(MINIMUM_MS).toBe(FADE_IN_MS + ANIMATION_MS + LINGER_MS);
  });

  it('finishes well inside the backstop that shows the app regardless', () => {
    expect(MINIMUM_MS).toBeLessThan(MAXIMUM_MS);
  });
});

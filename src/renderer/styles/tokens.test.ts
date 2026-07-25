import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Every `var(--x)` must resolve.
 *
 * A misspelt custom property is silent: the declaration is simply dropped and the element
 * falls back to a browser default, so text renders at the wrong size and borders vanish
 * with nothing in the console and no failing test. Fourteen of these shipped at once —
 * `--font-xs` where the token is `--font-size-xs`, `--border-color` where it is
 * `--border-default`.
 */
const STYLES = path.join(__dirname);
const RENDERER = path.resolve(__dirname, '..');

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(full);
    return entry.name.endsWith('.css') ? [full] : [];
  });
}

const DECLARED = /(--[a-z0-9-]+)\s*:/g;
/** `var(--x)` with no comma, i.e. no fallback to save it. */
const USED_WITHOUT_FALLBACK = /var\(\s*(--[a-z0-9-]+)\s*\)/g;

const tokens = new Set(
  [...fs.readFileSync(path.join(STYLES, 'tokens.css'), 'utf8').matchAll(DECLARED)].map(m => m[1]),
);

describe('CSS custom properties', () => {
  it('defines a reasonable set of tokens to begin with', () => {
    // Guards the test itself: a bad path would make everything below vacuously pass.
    expect(tokens.size).toBeGreaterThan(20);
    expect(tokens.has('--accent-primary')).toBe(true);
  });

  it.each(cssFiles(RENDERER).map(f => [path.relative(RENDERER, f), f]))(
    '%s uses only properties that exist',
    (_name, file) => {
      const text = fs.readFileSync(file, 'utf8');
      const local = new Set([...text.matchAll(DECLARED)].map(m => m[1]));
      const unknown = [...text.matchAll(USED_WITHOUT_FALLBACK)]
        .map(m => m[1])
        .filter(name => !tokens.has(name) && !local.has(name));
      expect([...new Set(unknown)]).toEqual([]);
    },
  );
});

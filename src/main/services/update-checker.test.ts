import { describe, it, expect } from 'vitest';
import { isNewerVersion } from './update-checker';

/**
 * The comparison behind the update prompt.
 *
 * Worth its own tests because the failure is silent and backwards: compared as text,
 * "1.9.0" sorts after "1.21.0", so an app three releases behind would consider itself
 * ahead and never offer the update.
 */
describe('isNewerVersion', () => {
  it('compares numerically, not as text', () => {
    expect(isNewerVersion('1.21.0', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.9.0', '1.21.0')).toBe(false);
  });

  it('is false for the same version', () => {
    expect(isNewerVersion('1.21.3', '1.21.3')).toBe(false);
  });

  it('notices a patch release', () => {
    expect(isNewerVersion('1.21.3', '1.21.2')).toBe(true);
    expect(isNewerVersion('1.21.2', '1.21.3')).toBe(false);
  });

  it('weighs major above minor above patch', () => {
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true);
    expect(isNewerVersion('1.22.0', '1.21.99')).toBe(true);
  });

  it('treats a missing part as zero', () => {
    expect(isNewerVersion('1.22', '1.21.9')).toBe(true);
    expect(isNewerVersion('1.21', '1.21.0')).toBe(false);
  });

  it('does not claim an update for something it cannot read', () => {
    expect(isNewerVersion('rubbish', '1.0.0')).toBe(false);
  });
});

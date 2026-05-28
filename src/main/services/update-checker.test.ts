import { describe, it, expect } from 'vitest';
import { isNewerVersion } from './update-checker';

describe('isNewerVersion', () => {
  it('detects a newer patch', () => {
    expect(isNewerVersion('1.0.3', '1.0.2')).toBe(true);
  });

  it('detects a newer minor', () => {
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true);
  });

  it('detects a newer major', () => {
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true);
  });

  it('returns false for the same version', () => {
    expect(isNewerVersion('1.0.2', '1.0.2')).toBe(false);
  });

  it('returns false for an older version', () => {
    expect(isNewerVersion('1.0.1', '1.0.2')).toBe(false);
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false);
  });

  it('handles missing components as zero', () => {
    expect(isNewerVersion('1.1', '1.0.9')).toBe(true);
    expect(isNewerVersion('1', '1.0.0')).toBe(false);
  });

  it('handles non-numeric components as zero', () => {
    expect(isNewerVersion('1.0.x', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.2', '1.0.x')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { decideFirstRun } from './first-run';

const base = { seenIntro: null, lastVersion: null, version: '1.5.0', isAutomation: false };

describe('decideFirstRun', () => {
  it('plays the intro and shows the changelog on a brand-new database', () => {
    expect(decideFirstRun(base)).toEqual({
      playIntro: true,
      showChangelog: true,
      writeIntroSeen: true,
      writeLastVersion: true,
    });
  });

  it("shows the changelog for the tester's case: an existing DB with no recorded version", () => {
    // Intro was already seen, but the version was never recorded (older builds, or the
    // old localStorage attempt that never touched the database).
    const d = decideFirstRun({ ...base, seenIntro: '1', lastVersion: null });
    expect(d.showChangelog).toBe(true);
    expect(d.playIntro).toBe(false);
    expect(d.writeLastVersion).toBe(true);
  });

  it('shows the changelog after an upgrade', () => {
    const d = decideFirstRun({ ...base, seenIntro: '1', lastVersion: '1.4.0', version: '1.5.0' });
    expect(d.showChangelog).toBe(true);
    expect(d.playIntro).toBe(false);
  });

  it('does nothing once the current version has been seen', () => {
    const d = decideFirstRun({ ...base, seenIntro: '1', lastVersion: '1.5.0', version: '1.5.0' });
    expect(d).toEqual({
      playIntro: false,
      showChangelog: false,
      writeIntroSeen: false,
      writeLastVersion: false,
    });
  });

  it('never replays the intro once seen, even across versions', () => {
    expect(decideFirstRun({ ...base, seenIntro: '1', lastVersion: '1.4.0' }).playIntro).toBe(false);
  });

  it('suppresses the popups under automation but still records the flags', () => {
    expect(decideFirstRun({ ...base, isAutomation: true })).toEqual({
      playIntro: false,
      showChangelog: false,
      writeIntroSeen: true,
      writeLastVersion: true,
    });
  });
});

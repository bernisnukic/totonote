import { describe, it, expect } from 'vitest';
import { decideFirstRun } from './first-run';

const base = { lastVersion: null, version: '1.5.0', isAutomation: false };

describe('the changelog', () => {
  it('opens on a brand-new database, which has recorded no version', () => {
    const d = decideFirstRun(base);
    expect(d.showChangelog).toBe(true);
    expect(d.writeLastVersion).toBe(true);
  });

  it("opens for the tester's case: an existing database that never recorded a version", () => {
    const d = decideFirstRun({ ...base, lastVersion: null });
    expect(d.showChangelog).toBe(true);
  });

  it('opens after an upgrade', () => {
    expect(decideFirstRun({ ...base, lastVersion: '1.4.0', version: '1.5.0' }).showChangelog).toBe(true);
  });

  it('stays shut once the running version has been recorded', () => {
    const d = decideFirstRun({ ...base, lastVersion: '1.5.0', version: '1.5.0' });
    expect(d.showChangelog).toBe(false);
    expect(d.writeLastVersion).toBe(false);
  });

  it('is news, not decoration — a downgrade counts as a change too', () => {
    expect(decideFirstRun({ ...base, lastVersion: '1.6.0', version: '1.5.0' }).showChangelog).toBe(true);
  });
});

describe('under automation', () => {
  it('keeps the release notes shut so they never block a test run', () => {
    expect(decideFirstRun({ ...base, isAutomation: true }).showChangelog).toBe(false);
  });

  it('still records the version, keeping the write path under test', () => {
    expect(decideFirstRun({ ...base, isAutomation: true }).writeLastVersion).toBe(true);
  });
});

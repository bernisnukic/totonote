import { app } from 'electron';

const REPO_OWNER = 'bernisnukic';
const REPO_NAME = 'totonote';
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

export interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();
  try {
    const response = await fetch(API_URL, {
      headers: {
        'User-Agent': `TotoNote/${currentVersion}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) {
      return { available: false, currentVersion };
    }
    const release = (await response.json()) as { tag_name?: string; html_url?: string };
    const latest = release.tag_name?.replace(/^v/, '');
    if (!latest) {
      return { available: false, currentVersion };
    }
    return {
      available: isNewerVersion(latest, currentVersion),
      currentVersion,
      latestVersion: latest,
      releaseUrl: release.html_url,
    };
  } catch {
    return { available: false, currentVersion };
  }
}

// Compares MAJOR.MINOR.PATCH semver. Pre-release suffixes are ignored —
// the project only ships plain release tags (v1.0.2 etc).
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < 3; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

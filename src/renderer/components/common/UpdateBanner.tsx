import React, { useEffect, useState } from 'react';
import { invoke } from '../../lib/ipc-client';

const DISMISS_KEY_PREFIX = 'update-dismissed-';

interface UpdateInfo {
  latestVersion: string;
  releaseUrl: string;
}

export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    // Skip the network check under E2E automation.
    if (navigator.webdriver) return;
    let cancelled = false;
    invoke('app:check-for-updates')
      .then(result => {
        if (cancelled) return;
        if (!result.available || !result.latestVersion || !result.releaseUrl) return;
        if (localStorage.getItem(`${DISMISS_KEY_PREFIX}${result.latestVersion}`)) return;
        setInfo({ latestVersion: result.latestVersion, releaseUrl: result.releaseUrl });
      })
      .catch(() => {
        /* ignore — staying silent is the right failure mode for an update check */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info) return null;

  const dismiss = () => {
    localStorage.setItem(`${DISMISS_KEY_PREFIX}${info.latestVersion}`, '1');
    setInfo(null);
  };

  const download = () => {
    invoke('app:open-external', { url: info.releaseUrl }).catch(() => {});
  };

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner__text">
        New version available: <strong>v{info.latestVersion}</strong>
      </span>
      <button type="button" className="update-banner__btn update-banner__btn--primary" onClick={download}>
        Download
      </button>
      <button type="button" className="update-banner__btn update-banner__btn--icon" onClick={dismiss} aria-label="Dismiss update notification">
        ×
      </button>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '../../lib/ipc-client';

/**
 * Checking for a new version on demand.
 *
 * A banner already appears by itself when there is something newer, but it only speaks up
 * once, at startup — so there was no way to *ask*. Reported as "is there no way to update
 * the app like a check for updates button".
 *
 * It does not install anything, and says so. Applying an update in place on macOS needs the
 * app to be signed and notarised by Apple, which TotoNote is not; offering a button that
 * appeared to update and then didn't would be worse than being plain about it.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current'; version: string }
  | { kind: 'available'; version: string; url: string }
  | { kind: 'failed' };

export function UpdateSettings({ autoCheck }: { autoCheck?: boolean }) {
  const [current, setCurrent] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    invoke('app:version')
      .then(setCurrent)
      .catch(() => setCurrent(''));
  }, []);

  const check = async () => {
    setState({ kind: 'checking' });
    try {
      const result = await invoke('app:check-for-updates');
      if (result.available && result.latestVersion && result.releaseUrl) {
        setState({ kind: 'available', version: result.latestVersion, url: result.releaseUrl });
      } else {
        setState({ kind: 'current', version: result.currentVersion });
      }
    } catch {
      // No network, or GitHub said no. Nothing the user can act on, so say so plainly.
      setState({ kind: 'failed' });
    }
  };

  // Opened from the menu item, which means "check now", not "show me a button". The ref
  // keeps it to once: without it every render would fire another request at GitHub.
  const started = useRef(false);
  useEffect(() => {
    if (autoCheck && !started.current) {
      started.current = true;
      void check();
    }
  });

  const download = () => {
    if (state.kind !== 'available') return;
    invoke('app:open-external', { url: state.url }).catch(() => undefined);
  };

  return (
    <div className="update-settings">
      <p className="input-hint" style={{ margin: '0 0 var(--space-2)' }}>
        You have <strong>v{current || '—'}</strong>. TotoNote also tells you at startup when
        there is something newer.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => void check()}
          disabled={state.kind === 'checking'}
        >
          {state.kind === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>

        {state.kind === 'available' && (
          <button className="btn btn-primary btn-sm" onClick={download}>
            Get v{state.version}
          </button>
        )}
      </div>

      {state.kind === 'current' && (
        <p className="input-hint" style={{ margin: 'var(--space-2) 0 0' }}>
          You’re up to date.
        </p>
      )}
      {state.kind === 'available' && (
        <p className="input-hint" style={{ margin: 'var(--space-2) 0 0' }}>
          <strong>v{state.version}</strong> is out. The button opens its download page —
          TotoNote can’t install it for you, because it isn’t signed with an Apple developer
          certificate.
        </p>
      )}
      {state.kind === 'failed' && (
        <p className="input-hint" style={{ margin: 'var(--space-2) 0 0' }}>
          Couldn’t check just now — no connection, or GitHub didn’t answer.
        </p>
      )}
    </div>
  );
}

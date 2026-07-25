import React, { useEffect, useState } from 'react';
import { invoke } from '../../lib/ipc-client';
import { formatBytes } from '../../lib/format-bytes';

/**
 * Back up everything, and put it back.
 *
 * A whole world lives in one file on one machine, which until now had no copy anywhere. This
 * is the answer to "my laptop died" and to "send me what you have so far".
 */
export function BackupSettings() {
  const [status, setStatus] = useState<{ dbPath: string; bytes: number } | null>(null);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    invoke('backup:status').then(setStatus).catch(() => setStatus(null));
  }, []);

  const backUp = async () => {
    setBusy('backup');
    setMessage('');
    try {
      const done = await invoke('backup:create');
      if (!done) return; // they closed the save dialog
      setMessage(
        `Saved ${done.documents} document${done.documents === 1 ? '' : 's'}, ` +
          `${done.annotations} highlight${done.annotations === 1 ? '' : 's'} and ` +
          `${done.images} picture${done.images === 1 ? '' : 's'} (${formatBytes(done.bytes)}).`,
      );
    } catch (err) {
      setMessage(`Could not save the backup: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    setMessage('');
    try {
      const result = await invoke('backup:restore');
      // A successful restore never gets here — the app relaunches. So anything returned is
      // either a cancellation or a refusal worth showing.
      if (result && !result.ok) setMessage(result.reason ?? 'That backup could not be restored.');
    } catch (err) {
      setMessage(`Could not restore: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <p className="settings-toggle-hint" style={{ marginBottom: 'var(--space-2)' }}>
        {status
          ? `Everything you have written is in one file, ${formatBytes(status.bytes)}, on this computer only.`
          : 'Checking…'}
      </p>
      <div className="settings-button-row">
        <button className="btn btn-primary btn-sm" onClick={backUp} disabled={busy !== null}>
          {busy === 'backup' ? 'Saving…' : 'Back up everything…'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={restore} disabled={busy !== null}>
          {busy === 'restore' ? 'Restoring…' : 'Restore from a backup…'}
        </button>
      </div>
      <p className="settings-toggle-hint" style={{ marginTop: 'var(--space-2)' }}>
        {message ||
          'A backup holds every document, highlight, category, drawing and picture. Restoring replaces everything currently here and restarts the app.'}
      </p>
      {status && (
        <p className="settings-path" title={status.dbPath}>
          {status.dbPath}
        </p>
      )}
    </div>
  );
}

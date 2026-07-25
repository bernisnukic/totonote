import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '../../lib/ipc-client';

/**
 * How much space embedded pictures take, and a way to get some back.
 *
 * Images and drawings are kept even when the section holding them is deleted, because
 * deletions are undoable and purging them would quietly break a restore. That is the right
 * default, but it means an active world only ever grows — so reclaiming is offered here as
 * something the user chooses to do, once they're sure they don't want those deletions back.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function StorageSettings() {
  const [usage, setUsage] = useState<{ count: number; totalBytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const refresh = useCallback(() => {
    invoke('media:usage').then(setUsage).catch(() => setUsage(null));
  }, []);

  useEffect(refresh, [refresh]);

  const reclaim = async () => {
    setBusy(true);
    setResult('');
    try {
      const { removed, drawingsRemoved } = await invoke('media:purge-unused');
      const parts: string[] = [];
      if (removed) parts.push(`${removed} image${removed === 1 ? '' : 's'}`);
      if (drawingsRemoved) parts.push(`${drawingsRemoved} drawing${drawingsRemoved === 1 ? '' : 's'}`);
      setResult(parts.length ? `Removed ${parts.join(' and ')}.` : 'Nothing to reclaim — everything is still in use.');
      refresh();
    } catch {
      setResult('Could not reclaim space.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="settings-toggle-hint" style={{ marginBottom: 'var(--space-2)' }}>
        {usage
          ? `${usage.count} embedded picture${usage.count === 1 ? '' : 's'}, ${formatBytes(usage.totalBytes)}.`
          : 'Checking…'}
      </p>
      <button className="btn btn-secondary btn-sm" onClick={reclaim} disabled={busy}>
        {busy ? 'Reclaiming…' : 'Reclaim unused space'}
      </button>
      <p className="settings-toggle-hint" style={{ marginTop: 'var(--space-2)' }}>
        {result ||
          'Removes pictures and drawings no document points at any more — usually ones left behind by a deleted section. They can’t be restored afterwards.'}
      </p>
    </div>
  );
}

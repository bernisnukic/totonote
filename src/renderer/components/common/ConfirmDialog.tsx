import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

/**
 * The app's own confirm and alert.
 *
 * `window.confirm` renders an OS dialog that ignores the theme, can't be styled, names the
 * page rather than the app, and blocks the whole renderer while it's up. This is the same
 * question asked in the app's own voice.
 *
 * `confirmDialog` returns a promise, so call sites read almost the same as the native call
 * they replace:
 *
 *     if (!(await confirmDialog({ message: 'Delete this?' }))) return;
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  /** Extra context under the message, for consequences worth spelling out. */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive, for anything that removes something. */
  destructive?: boolean;
  /** No cancel button — the "alert" case, where there is nothing to decide. */
  acknowledgeOnly?: boolean;
}

type Resolver = (confirmed: boolean) => void;

let openDialog: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Ask a question. Resolves true if confirmed.
 *
 * Falls back to the native dialog if the host isn't mounted, so a call can never silently
 * do nothing — better an ugly prompt than a destructive action taken without asking.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!openDialog) return Promise.resolve(window.confirm(options.message));
  return openDialog(options);
}

/** Tell the user something, with a single button. */
export function alertDialog(message: string, detail?: string): Promise<boolean> {
  return confirmDialog({ message, detail, acknowledgeOnly: true, confirmLabel: 'OK' });
}

/** Mounted once at app level; every confirm in the app goes through it. */
export function ConfirmDialogHost() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    openDialog = opts =>
      new Promise<boolean>(resolve => {
        resolverRef.current = resolve;
        setOptions(opts);
      });
    return () => {
      openDialog = null;
    };
  }, []);

  // Enter confirms, matching the native dialog people are replacing muscle memory for.
  useEffect(() => {
    if (options) confirmRef.current?.focus();
  }, [options]);

  const settle = useCallback((confirmed: boolean) => {
    setOptions(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(confirmed);
  }, []);

  if (!options) return null;

  return (
    <Modal
      title={options.title ?? 'Are you sure?'}
      isOpen
      // Dismissing without choosing is a "no" — never take the action by default.
      onClose={() => settle(false)}
      footer={
        <>
          {!options.acknowledgeOnly && (
            <button className="btn btn-secondary" onClick={() => settle(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            ref={confirmRef}
            className={`btn ${options.destructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => settle(true)}
          >
            {options.confirmLabel ?? 'OK'}
          </button>
        </>
      }
    >
      <p className="confirm-message">{options.message}</p>
      {options.detail && <p className="confirm-detail">{options.detail}</p>}
    </Modal>
  );
}

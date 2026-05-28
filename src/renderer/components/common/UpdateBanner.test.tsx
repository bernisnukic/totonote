// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';

type InvokeFn = (channel: string, args?: unknown) => Promise<unknown>;

function setupApi(invoke: InvokeFn) {
  (window as unknown as { api: { invoke: InvokeFn } }).api = { invoke };
}

function setWebdriver(value: boolean) {
  Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => value });
}

describe('UpdateBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    setWebdriver(false);
  });

  it('does not render when no update is available', async () => {
    setupApi(() => Promise.resolve({ available: false, currentVersion: '1.0.3' }));
    const { container } = render(<UpdateBanner />);
    // Give the effect a chance to run; the banner should never appear.
    await new Promise(r => setTimeout(r, 20));
    expect(container.querySelector('.update-banner')).toBeNull();
  });

  it('renders the banner when a newer version is available', async () => {
    setupApi(channel => {
      if (channel === 'app:check-for-updates') {
        return Promise.resolve({
          available: true,
          currentVersion: '1.0.3',
          latestVersion: '1.0.4',
          releaseUrl: 'https://github.com/bernisnukic/totonote/releases/tag/v1.0.4',
        });
      }
      return Promise.resolve(undefined);
    });
    render(<UpdateBanner />);
    expect(await screen.findByText(/New version available/i)).toBeTruthy();
    expect(screen.getByText('v1.0.4')).toBeTruthy();
    expect(screen.getByRole('button', { name: /download/i })).toBeTruthy();
  });

  it('skips the check entirely under E2E automation', async () => {
    setWebdriver(true);
    const invoke = vi.fn().mockResolvedValue({ available: true, currentVersion: '1.0.3', latestVersion: '1.0.4', releaseUrl: 'https://example.com' });
    setupApi(invoke);
    const { container } = render(<UpdateBanner />);
    await new Promise(r => setTimeout(r, 20));
    expect(invoke).not.toHaveBeenCalled();
    expect(container.querySelector('.update-banner')).toBeNull();
  });

  it('does not re-show a dismissed version on remount', async () => {
    localStorage.setItem('update-dismissed-1.0.4', '1');
    setupApi(() => Promise.resolve({
      available: true,
      currentVersion: '1.0.3',
      latestVersion: '1.0.4',
      releaseUrl: 'https://github.com/bernisnukic/totonote/releases/tag/v1.0.4',
    }));
    const { container } = render(<UpdateBanner />);
    await new Promise(r => setTimeout(r, 20));
    expect(container.querySelector('.update-banner')).toBeNull();
  });

  it('dismiss button stores the version and hides the banner', async () => {
    setupApi(() => Promise.resolve({
      available: true,
      currentVersion: '1.0.3',
      latestVersion: '1.0.4',
      releaseUrl: 'https://github.com/bernisnukic/totonote/releases/tag/v1.0.4',
    }));
    const { container } = render(<UpdateBanner />);
    await screen.findByText('v1.0.4');
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => expect(container.querySelector('.update-banner')).toBeNull());
    expect(localStorage.getItem('update-dismissed-1.0.4')).toBe('1');
  });

  it('download button invokes app:open-external with the release URL', async () => {
    const invoke = vi.fn().mockImplementation((channel: string) => {
      if (channel === 'app:check-for-updates') {
        return Promise.resolve({
          available: true,
          currentVersion: '1.0.3',
          latestVersion: '1.0.4',
          releaseUrl: 'https://github.com/bernisnukic/totonote/releases/tag/v1.0.4',
        });
      }
      return Promise.resolve(undefined);
    });
    setupApi(invoke);
    render(<UpdateBanner />);
    await screen.findByText('v1.0.4');
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(invoke).toHaveBeenCalledWith('app:open-external', {
      url: 'https://github.com/bernisnukic/totonote/releases/tag/v1.0.4',
    });
  });

  it('stays silent when the IPC call rejects', async () => {
    setupApi(() => Promise.reject(new Error('network down')));
    const { container } = render(<UpdateBanner />);
    await new Promise(r => setTimeout(r, 20));
    expect(container.querySelector('.update-banner')).toBeNull();
  });
});

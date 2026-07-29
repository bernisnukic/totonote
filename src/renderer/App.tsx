import React, { useEffect, useState } from 'react';
import { useStore } from './stores';
import { AppLayout } from './components/layout/AppLayout';
import { DocumentList } from './components/document-list/DocumentList';
import { EditorArea } from './components/editor/EditorArea';
import { TagContextMenu } from './components/editor/TagContextMenu';
import { GraphView } from './components/graph/GraphView';
import { TimelineView } from './components/timeline/TimelineView';
import { TooltipHost } from './components/common/TooltipHost';
import { SettingsModal } from './components/common/SettingsModal';
import { UndoToast } from './components/common/UndoToast';
import { HelpViewer } from './components/help/HelpViewer';
import { WikiView } from './components/right-sidebar/WikiView';
import { UpdateBanner } from './components/common/UpdateBanner';
import { invoke } from './lib/ipc-client';
import { decideFirstRun } from './lib/first-run';
import { resolveTheme, followsSystem } from './lib/theme';
import { ConfirmDialogHost } from './components/common/ConfirmDialog';

/** Preference key holding the last app version whose changelog was shown. */
const LAST_SEEN_VERSION_KEY = 'last-seen-version';

export function App() {
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const graphOpen = useStore(s => s.graphOpen);
  const timelineOpen = useStore(s => s.timelineOpen);
  const settingsOpen = useStore(s => s.settingsOpen);
  const setSettingsOpen = useStore(s => s.setSettingsOpen);
  const loadWorkspaces = useStore(s => s.loadWorkspaces);
  const loadDocuments = useStore(s => s.loadDocuments);
  const loadPreferences = useStore(s => s.loadPreferences);
  const readPreference = useStore(s => s.readPreference);
  const writePreference = useStore(s => s.writePreference);
  const openHelp = useStore(s => s.openHelp);
  const theme = useStore(s => s.theme);
  const lineSpacing = useStore(s => s.lineSpacing);
  // Set when Settings was opened by "Check for Updates…", so it checks rather than waiting.
  const [checkUpdatesOnOpen, setCheckUpdatesOnOpen] = useState(false);


  // TotoNote > Check for Updates… — people look next to About before they look in
  // Settings, and there was no way to ask at all before this.
  useEffect(() => {
    return window.api.onMenu('menu:check-updates', () => {
      setCheckUpdatesOnOpen(true);
      setSettingsOpen(true);
    });
  }, [setSettingsOpen]);

  useEffect(() => {
    loadPreferences();
    loadWorkspaces().then(() => loadDocuments());
  }, [loadPreferences, loadWorkspaces, loadDocuments]);

  // Follow the OS when "system" is chosen — and keep following it, so switching appearance
  // while the app is open takes effect rather than waiting for a restart.
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,
  );
  useEffect(() => {
    if (!followsSystem(theme)) return;
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const update = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    setPrefersDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
    // Only the choice matters here; this effect *sets* prefersDark, so depending on it
    // would tear the listener down and rebuild it on every change for nothing.
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme, prefersDark);
  }, [theme, prefersDark]);

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-line-height', String(lineSpacing));
  }, [lineSpacing]);

  // What's New opens when the running version differs from the last one recorded — kept
  // in the database, so it survives the re-download that used to wipe localStorage. The
  // splash is not handled here at all: it is a real window the main process puts on screen
  // while this one loads hidden, so by the time anyone sees this, it is already gone.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lastVersion, version] = await Promise.all([
        readPreference(LAST_SEEN_VERSION_KEY),
        invoke('app:version'),
      ]);
      if (cancelled) return;

      const d = decideFirstRun({ lastVersion, version, isAutomation: navigator.webdriver });
      if (d.writeLastVersion) await writePreference(LAST_SEEN_VERSION_KEY, version);
      if (d.showChangelog) openHelp('CHANGELOG');
    })();
    return () => {
      cancelled = true;
    };
  }, [readPreference, writePreference, openHelp]);

  return (
    <>
      <AppLayout>
        {activeDocumentId ? <EditorArea /> : <DocumentList />}
        <TagContextMenu />
        {graphOpen && <GraphView />}
        {timelineOpen && <TimelineView />}
      </AppLayout>
      <UpdateBanner />
      <TooltipHost />
      <UndoToast />
      <ConfirmDialogHost />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setCheckUpdatesOnOpen(false);
        }}
        checkUpdates={checkUpdatesOnOpen}
      />
      <HelpViewer />
      <WikiView />
    </>
  );
}

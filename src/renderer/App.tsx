import React, { useEffect, useState } from 'react';
import { useStore } from './stores';
import { AppLayout } from './components/layout/AppLayout';
import { DocumentList } from './components/document-list/DocumentList';
import { EditorArea } from './components/editor/EditorArea';
import { TagContextMenu } from './components/editor/TagContextMenu';
import { GraphView } from './components/graph/GraphView';
import { TooltipHost } from './components/common/TooltipHost';
import { UndoToast } from './components/common/UndoToast';
import { HelpViewer } from './components/help/HelpViewer';
import { IntroAnimation, INTRO_SEEN_KEY } from './components/intro/IntroAnimation';
import { UpdateBanner } from './components/common/UpdateBanner';
import { invoke } from './lib/ipc-client';
import { decideFirstRun } from './lib/first-run';

/** Preference key holding the last app version whose changelog was shown. */
const LAST_SEEN_VERSION_KEY = 'last-seen-version';

export function App() {
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const graphOpen = useStore(s => s.graphOpen);
  const loadWorkspaces = useStore(s => s.loadWorkspaces);
  const loadDocuments = useStore(s => s.loadDocuments);
  const loadPreferences = useStore(s => s.loadPreferences);
  const readPreference = useStore(s => s.readPreference);
  const writePreference = useStore(s => s.writePreference);
  const openHelp = useStore(s => s.openHelp);
  const theme = useStore(s => s.theme);

  // 'checking' until we've read the flags from the database; then 'playing' or 'done'.
  const [introState, setIntroState] = useState<'checking' | 'playing' | 'done'>('checking');
  // Whether the changelog should open once the first-run intro (if any) has finished.
  const [changelogPending, setChangelogPending] = useState(false);

  useEffect(() => {
    loadPreferences();
    loadWorkspaces().then(() => loadDocuments());
  }, [loadPreferences, loadWorkspaces, loadDocuments]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // First-run experience, decided from the database so it survives a re-download the
  // way localStorage did not. The intro plays once ever per database; the changelog
  // opens whenever the running version differs from the last one recorded — including
  // the first launch — and, when both apply, waits for the intro to finish.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [seenIntro, lastVersion, version] = await Promise.all([
        readPreference(INTRO_SEEN_KEY),
        readPreference(LAST_SEEN_VERSION_KEY),
        invoke('app:version'),
      ]);
      if (cancelled) return;

      const d = decideFirstRun({ seenIntro, lastVersion, version, isAutomation: navigator.webdriver });
      if (d.writeLastVersion) await writePreference(LAST_SEEN_VERSION_KEY, version);
      if (d.writeIntroSeen) await writePreference(INTRO_SEEN_KEY, '1');

      if (d.playIntro) {
        setChangelogPending(d.showChangelog);
        setIntroState('playing');
      } else {
        setIntroState('done');
        if (d.showChangelog) openHelp('CHANGELOG');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readPreference, writePreference, openHelp]);

  const handleIntroDone = () => {
    setIntroState('done');
    if (changelogPending) {
      setChangelogPending(false);
      openHelp('CHANGELOG');
    }
  };

  return (
    <>
      {introState === 'playing' && <IntroAnimation onDone={handleIntroDone} />}
      <AppLayout>
        {activeDocumentId ? <EditorArea /> : <DocumentList />}
        <TagContextMenu />
        {graphOpen && <GraphView />}
      </AppLayout>
      <UpdateBanner />
      <TooltipHost />
      <UndoToast />
      <HelpViewer />
    </>
  );
}

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
import { IntroAnimation, shouldPlayIntro } from './components/intro/IntroAnimation';
import { UpdateBanner } from './components/common/UpdateBanner';

export function App() {
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const graphOpen = useStore(s => s.graphOpen);
  const loadWorkspaces = useStore(s => s.loadWorkspaces);
  const loadDocuments = useStore(s => s.loadDocuments);
  const loadPreferences = useStore(s => s.loadPreferences);
  const theme = useStore(s => s.theme);

  // Plays once per install; also skipped under test automation. See shouldPlayIntro.
  const [showIntro, setShowIntro] = useState(shouldPlayIntro);

  useEffect(() => {
    loadPreferences();
    // Workspaces gate everything else — documents and categories are scoped to one.
    loadWorkspaces().then(() => loadDocuments());
  }, [loadPreferences, loadWorkspaces, loadDocuments]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      {showIntro && <IntroAnimation onDone={() => setShowIntro(false)} />}
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

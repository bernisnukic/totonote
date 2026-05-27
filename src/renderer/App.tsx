import React, { useEffect, useState } from 'react';
import { useStore } from './stores';
import { AppLayout } from './components/layout/AppLayout';
import { DocumentList } from './components/document-list/DocumentList';
import { EditorArea } from './components/editor/EditorArea';
import { TagContextMenu } from './components/editor/TagContextMenu';
import { IntroAnimation } from './components/intro/IntroAnimation';

export function App() {
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const loadPreferences = useStore(s => s.loadPreferences);
  const theme = useStore(s => s.theme);

  // Skip the intro under test automation so it never blocks E2E interactions.
  const [showIntro, setShowIntro] = useState(() => !navigator.webdriver);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      {showIntro && <IntroAnimation onDone={() => setShowIntro(false)} />}
      <AppLayout>
        {activeDocumentId ? <EditorArea /> : <DocumentList />}
        <TagContextMenu />
      </AppLayout>
    </>
  );
}

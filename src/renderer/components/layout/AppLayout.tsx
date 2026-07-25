import React, { useEffect, useCallback } from 'react'
import { useStore } from '../../stores';
import { PanelDivider } from './PanelDivider';
import { StatusBar } from './StatusBar';
import { LeftSidebar } from '../left-sidebar/LeftSidebar';
import { RightSidebar } from '../right-sidebar/RightSidebar';
import { getActiveEditor } from '../../lib/editor-registry';
import { invoke } from '../../lib/ipc-client';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const leftWidth = useStore(s => s.leftSidebarWidth);
  const rightWidth = useStore(s => s.rightSidebarWidth);
  const leftCollapsed = useStore(s => s.leftSidebarCollapsed);
  const rightCollapsed = useStore(s => s.rightSidebarCollapsed);
  const setLeftWidth = useStore(s => s.setLeftSidebarWidth);
  const setRightWidth = useStore(s => s.setRightSidebarWidth);
  const resetLeftSidebarWidth = useStore(s => s.resetLeftSidebarWidth);
  const resetRightSidebarWidth = useStore(s => s.resetRightSidebarWidth);
  const resetSidebarWidths = useStore(s => s.resetSidebarWidths);
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const saveAllDirty = useStore(s => s.saveAllDirty);
  const setSettingsOpen = useStore(s => s.setSettingsOpen);
  const autoSaveEnabled = useStore(s => s.autoSaveEnabled);
  const dirtyCount = useStore(s => s.dirtySectionIds.length);

  const handleLeftResize = useCallback(
    (delta: number) => {
      setLeftWidth(Math.min(400, Math.max(200, leftWidth + delta)));
    },
    [leftWidth, setLeftWidth]
  );

  const handleRightResize = useCallback(
    (delta: number) => {
      setRightWidth(Math.min(400, Math.max(200, rightWidth - delta)));
    },
    [rightWidth, setRightWidth]
  );

  // The View > Reset Sidebar Widths menu command.
  useEffect(() => {
    return window.api.onMenu('menu:reset-layout', () => resetSidebarWidths());
  }, [resetSidebarWidths]);

  // TotoNote > Settings… (⌘,). Handled here rather than in the toolbar so it works on the
  // Documents screen too, where there is no toolbar at all.
  useEffect(() => {
    return window.api.onMenu('menu:open-settings', () => setSettingsOpen(true));
  }, [setSettingsOpen]);

  // Edit > Undo/Redo (Cmd+Z / Shift+Cmd+Z). These come through the menu rather than the
  // OS-native undo, which the rich-text editor can't hear. Route to whatever has focus:
  // a plain input undoes its own text; otherwise the active section editor does.
  useEffect(() => {
    const run = (redo: boolean) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        document.execCommand(redo ? 'redo' : 'undo');
        return;
      }
      const editor = getActiveEditor(useStore.getState().activeSectionId);
      editor?.chain().focus()[redo ? 'redo' : 'undo']().run();
    };
    const offUndo = window.api.onMenu('menu:undo', () => run(false));
    const offRedo = window.api.onMenu('menu:redo', () => run(true));
    return () => {
      offUndo();
      offRedo();
    };
  }, []);

  // File > Save (Cmd+S). And the save-and-quit handshake: when the user chooses "Save" in
  // the close-warning dialog, flush everything, then tell main it's safe to quit.
  useEffect(() => {
    const offSave = window.api.onMenu('menu:save-all', () => {
      saveAllDirty();
    });
    const offSaveQuit = window.api.onMenu('app:save-and-quit', () => {
      saveAllDirty().finally(() => invoke('app:force-quit'));
    });
    return () => {
      offSave();
      offSaveQuit();
    };
  }, [saveAllDirty]);

  // Tell main whether there's unsaved work, so it can warn before the window closes. Only
  // manual-save mode can have unsaved work; auto-save keeps this false. Turning auto-save
  // back on also flushes anything left pending.
  useEffect(() => {
    if (autoSaveEnabled && dirtyCount > 0) saveAllDirty();
    invoke('window:set-dirty', { dirty: !autoSaveEnabled && dirtyCount > 0 });
  }, [autoSaveEnabled, dirtyCount, saveAllDirty]);

  return (
    <div className="app-container">
      <div className="title-bar-drag" />
      <div className="app-content">
        <div className="panel-layout">
          {activeDocumentId && (
            <>
              <div
                className={`left-sidebar${leftCollapsed ? ' collapsed' : ''}`}
                style={{ width: leftCollapsed ? 0 : leftWidth }}
              >
                <LeftSidebar />
              </div>
              {!leftCollapsed && <PanelDivider onResize={handleLeftResize} onReset={resetLeftSidebarWidth} />}
            </>
          )}

          <div className="center-panel">{children}</div>

          {activeDocumentId && (
            <>
              {!rightCollapsed && <PanelDivider onResize={handleRightResize} onReset={resetRightSidebarWidth} />}
              <div
                className={`right-sidebar${rightCollapsed ? ' collapsed' : ''}`}
                style={{ width: rightCollapsed ? 0 : rightWidth }}
              >
                <RightSidebar />
              </div>
            </>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

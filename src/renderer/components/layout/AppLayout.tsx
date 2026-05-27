import React, { useCallback } from 'react';
import { useStore } from '../../stores';
import { PanelDivider } from './PanelDivider';
import { StatusBar } from './StatusBar';
import { LeftSidebar } from '../left-sidebar/LeftSidebar';
import { RightSidebar } from '../right-sidebar/RightSidebar';

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
  const activeDocumentId = useStore(s => s.activeDocumentId);

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
              {!leftCollapsed && <PanelDivider onResize={handleLeftResize} />}
            </>
          )}

          <div className="center-panel">{children}</div>

          {activeDocumentId && (
            <>
              {!rightCollapsed && <PanelDivider onResize={handleRightResize} />}
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

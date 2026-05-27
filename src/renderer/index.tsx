import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Import styles
import './styles/tokens.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/editor.css';
import './styles/sidebar.css';
import './styles/tabs.css';
import './styles/toolbar.css';
import './styles/popover.css';
import './styles/modal.css';
import './styles/components.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

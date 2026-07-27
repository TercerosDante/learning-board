import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSettings } from './data/db';
import './index.css';

void ensureSettings()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((err) => {
    console.error(err);
    const root = document.getElementById('root');
    if (root) {
      root.textContent =
        'Learning OS could not open its browser database (IndexedDB). Check private-browsing mode or storage settings.';
    }
  });

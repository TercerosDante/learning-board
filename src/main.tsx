import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSettings } from './data/db';
import './index.css';

void ensureSettings()
  .then(async () => {
    try {
      const { sweepDue } = await import('./services/reviews');
      const { snapshotToday } = await import('./services/snapshots');
      await sweepDue();
      await snapshotToday();
    } catch (err) {
      console.error('metrics bootstrap failed', err);
    }
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

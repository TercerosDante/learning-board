import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSettings } from './data/db';
import './index.css';

void ensureSettings().then(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

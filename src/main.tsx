import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './storage/store';
import { SyncProvider } from './sync/SyncProvider';
import { ToastProvider } from './components/ui';
import { I18nProvider } from './i18n';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Wurzelelement #root nicht gefunden');

createRoot(container).render(
  <React.StrictMode>
    <I18nProvider>
      {(language) => (
        <StoreProvider>
          <ToastProvider>
            <SyncProvider>
              <App key={language} />
            </SyncProvider>
          </ToastProvider>
        </StoreProvider>
      )}
    </I18nProvider>
  </React.StrictMode>,
);

// Service Worker fuer Offline-Betrieb registrieren (nur im Produktions-Build).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Ohne Service Worker funktioniert die App weiterhin, nur nicht offline.
    });
  });
}

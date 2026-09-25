import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './storage/store';
import { SyncProvider } from './sync/SyncProvider';
import { ToastProvider } from './components/ui';
import { I18nProvider, detectLanguage, loadDictionary } from './i18n';
import { registerServiceWorker } from './lib/appUpdate';
import { isNativeApp } from './native/platform';
import './fonts.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Wurzelelement #root nicht gefunden');

const start = () => createRoot(container).render(
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

/*
 * Auf Deutsch startet die App sofort - der Quelltext ist die deutsche Fassung.
 * Auf Englisch wird kurz auf das Woerterbuch gewartet; sonst stuende die
 * Oberflaeche im ersten Bild auf Deutsch da und wechselte danach.
 */
if (detectLanguage() === 'en') void loadDictionary('en').then(start);
else start();

// Service Worker fuer Offline-Betrieb und Update-Erkennung (nur im Produktionsbau).
// Nicht in der Android-App: Dort liegen die Dateien ohnehin in der APK, und ein
// Zwischenspeicher wuerde nach einem APK-Update alte Dateien weiterliefern.
if (import.meta.env.PROD && !isNativeApp()) {
  window.addEventListener('load', () => {
    registerServiceWorker(import.meta.env.BASE_URL || '/');
  });
}

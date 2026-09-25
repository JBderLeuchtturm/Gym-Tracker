import type { CapacitorConfig } from '@capacitor/cli';

/*
 * Die Android-App.
 *
 * Alle Dateien der App liegen in der APK (webDir) - nichts wird aus dem Netz
 * geladen, die App startet offline und haengt nicht an der Webseite. Nur die
 * Dinge, die ohnehin Netz brauchen (Online-Suche, Wetter, Synchronisierung),
 * gehen weiterhin ins Internet.
 */
const config: CapacitorConfig = {
  appId: 'de.jbderleuchtturm.gymtracker',
  appName: 'Gym Tracker',
  webDir: 'dist',
  android: {
    backgroundColor: '#111214',
  },
};

export default config;

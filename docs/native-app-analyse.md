# Native App ohne Internet – Analyse und Plan

Ausgangsfrage: eine App, die **nicht über eine gehostete Webseite läuft**
(also nicht die TWA-Variante), sondern **direkt als App da ist und offline
funktioniert** – unabhängig davon, ob die Web-App irgendwo deployt ist.

Dieses Dokument analysiert die Möglichkeiten, empfiehlt einen Weg und legt
einen konkreten Umsetzungsplan fest. **Es wird noch nichts gebaut** – die
Entscheidungen am Ende trifft der Betreiber.

---

## 1. Was die App heute ist

- **~20.800 Zeilen** TypeScript/TSX in 73 Dateien.
- Abhängigkeiten: React, ReactDOM, `@supabase/supabase-js`. Sonst nichts –
  Diagramme, Körperkarte, Symbole, ZIP-Export sind alle selbst geschrieben.
- **Offline-first von Haus aus**: Der ganze Zustand liegt im `localStorage`
  (Trainings, Pläne, Profil, Ernährung, Ziele), Fotos in IndexedDB. Ein
  Service Worker cached alle App-Dateien.
- Das **Internet wird nur an drei optionalen Stellen** angefasst:
  - Synchronisierung mit Freunden über ein eigenes Supabase-Projekt – komplett
    freiwillig, die App läuft ohne Konto vollständig.
  - Nachschlage-Dienste: wger (Anleitungen), Open-Meteo (Wetter),
    Open Food Facts (Lebensmittel). Alle fallen bei fehlendem Netz sauber aus.
  - Echte Push-Nachrichten (Freunde anstupsen) über Web-Push + VAPID + eine
    Supabase Edge Function.

### Web-Plattform-APIs, die verbaut sind

| API | wofür | im Android-WebView (Capacitor)? |
|---|---|---|
| `localStorage` (21×) | der gesamte Zustand | funktioniert, persistent |
| IndexedDB | Fortschrittsfotos | funktioniert |
| `navigator.serviceWorker` | Offline-Cache, Update-Erkennung, Push | **entfällt** (App-Dateien sind eingebaut) |
| `Notification` / `PushManager` | Freunde-Anstupser | **Web-Push entfällt** – Ersatz nötig (siehe unten) |
| `getUserMedia` + `BarcodeDetector` | Barcode-Scanner | ab System-WebView 83 (≈ 2020); besser: nativer Ersatz |
| `navigator.vibrate` | Haptik beim Abhaken | funktioniert |
| `wakeLock` | Bildschirm wach im Training | funktioniert |
| `navigator.share` | Plan / Wochenbild teilen | funktioniert, nativer Ersatz robuster |
| `navigator.clipboard` | Plan-Code, Einladungslink kopieren | funktioniert |
| `navigator.geolocation` | Ort fürs Wetter | funktioniert (Berechtigung nötig) |
| `URL.createObjectURL` + `<a download>` (6×) | CSV / Backup-JSON / iCal / Foto-ZIP / Wochenbild | **funktioniert NICHT** – Dateien landen im WebView nirgends. Ersatz nötig. |
| `<input type=file>` / `capture` | Backup laden, Yazio-CSV, Foto aufnehmen | funktioniert |
| `AudioContext` | Countdown-Piepton | funktioniert |
| `matchMedia` | Hell/Dunkel automatisch | funktioniert |

**Kernbefund:** Das inhaltliche Herz der App (Training eintragen, Pläne,
Auswertung, Kalorien, Rechner) ist reines Web-Standard-Zeug und läuft ohne
Änderung in einem eingebetteten WebView. Wirklich anpassen muss man nur:
**Datei-Exporte**, **Push-Nachrichten**, optional **Barcode** und das übliche
Drumherum (Statusleiste, Splash, Zurück-Taste, Icons, Berechtigungen).

---

## 2. Die Möglichkeiten

### A) Capacitor – die Web-App in die APK packen

Capacitor (von den Ionic-Leuten, Open Source) legt die gebauten Dateien aus
`dist/` **in die APK** und lässt sie aus einem lokalen WebView laufen
(`http://localhost`, aus eingebauten Dateien – **kein Netz**). Native
Funktionen kommen über Plugins dazu.

- **Wiederverwendung: 100 %** der bestehenden React-Codebasis.
- **Offline: vollständig** ab dem ersten Start, ohne Hosting.
- Größe der APK: ~4–8 MB (die WebView-Engine liefert Android mit).
- „Native" ist hier: echte APK, echte Berechtigungen, echte
  Hintergrund-Benachrichtigungen, Play-Store-tauglich. Die Oberfläche ist
  weiter Web, gerendert in der System-WebView (Chromium-Engine). Für eine
  Formular- und Diagramm-App ist das nicht zu unterscheiden.
- Ein Codestand bedient beide Welten: Web/PWA **und** native APK. Jede weitere
  Runde landet automatisch in beiden.
- Native Plugins verfügbar: Statusleiste, Splash, Zurück-Taste, lokale
  Benachrichtigungen, Push (FCM), Haptik, Teilen, Dateisystem, Kamera,
  Barcode (ML Kit), Geolocation, Preferences (nativer Schlüssel-Wert-Speicher).
- **Aufwand: ~2 Tage.** Davon macht Claude das meiste; der letzte Bau (Android
  Studio), der Gerätetest und die Store-Einreichung liegen beim Betreiber.

### B) React Native / Expo – die Oberfläche neu schreiben

Eine echte native Oberfläche mit React-Native-Komponenten.

- **Wiederverwendung: ~30–40 %** – die reine Logik in `src/lib/` (Kalorien,
  Statistik, Scheiben, 1RM, Coaching, Ermüdung, Muskeln, Datum) ist portables
  TypeScript. Die SVG-Diagramme und die Körperkarte lassen sich mit
  `react-native-svg` weitgehend übernehmen.
- **Neu zu schreiben: alles** in `pages/`, `components/`, `storage/`, das
  ganze CSS (→ StyleSheet / eine RN-Styling-Lösung), Formulare, Navigation,
  Dialoge, die Sync-Anbindung.
- Vorteil: echte native Widgets, bessere Leistung auf schwachen Geräten,
  natives Gefühl, kein WebView.
- **Aufwand: 3–6 Wochen** für Funktionsgleichheit.
- Für **diese** App (Formulare, Diagramme, persönliche Daten, keine
  Animationslast, keine Leistungsanforderung) ist der Gewinn gering gegenüber
  den Kosten.

### C) Flutter (Dart) oder natives Android (Kotlin + Compose)

Vollständige Neuentwicklung, auch die Algorithmen müssen portiert werden.

- **Wiederverwendung: nahe 0.**
- **Aufwand: 6–12 Wochen.**
- Nicht gerechtfertigt.

### D) Tauri v2 (Rust + WebView)

Wie Capacitor, aber mit Rust-Kern. Die Mobil-Story ist jünger und weniger
erprobt als Capacitor, das Plugin-Ökosystem kleiner. Kein Vorteil hier.

---

## 3. Empfehlung: Capacitor

Begründung:

1. Die App **ist bereits** eine gut gebaute Offline-PWA. Capacitor macht daraus
   in ~2 Tagen eine eigenständige APK **ohne einen einzigen verlorenen
   Funktionspunkt**.
2. Eine native Neuentwicklung kostet 3–12 Wochen und die Art der App belohnt
   das nicht: Es gibt keine flüssigen Animationen, keine
   Leistungsengpässe, keine Plattform-Widgets, die man dringend bräuchte.
3. **Ein Codestand** für Web und App. Ohne das müsste jede zukünftige
   Verbesserung doppelt gebaut werden.
4. Der einzige echte Arbeitsaufwand sind die vier bekannten Baustellen
   (Exporte, Push, Barcode, Rahmen) – alle klein und klar umrissen.

Wenn dem Betreiber „echt nativ" (native Widgets, kein WebView) grundsätzlich
wichtiger ist als Aufwand und ein Codestand, ist **B) React Native/Expo** die
Option – dann bitte mit dem Wissen, dass das ein mehrwöchiges Projekt ist und
die App-Oberfläche komplett neu entsteht.

---

## 4. Umsetzungsplan (Capacitor)

### Phase 0 – Entscheidungen des Betreibers

1. **`appId`** (umgedrehte Domain, nach Veröffentlichung **nie** änderbar),
   z. B. `de.<name>.gymtracker`.
2. **Anzeigename** der App (z. B. „Gym Tracker").
3. **Freunde-Push in der App**:
   - (a) weglassen – die **Trainings-Erinnerung** kommt über lokale
     Benachrichtigungen (funktioniert sogar besser als im Web: auch bei
     geschlossener App). Freunde-Anstupser gibt es dann nur in der Web-Version.
   - (b) über **Firebase Cloud Messaging** nachrüsten – kostenloses
     Firebase-Projekt, `google-services.json`, `@capacitor/push-notifications`,
     und die Supabase Edge Function schickt zusätzlich an FCM. Aufwand ~1 Tag.
4. **Barcode**: `BarcodeDetector` behalten (0 Aufwand, ab WebView 83) oder
   `@capacitor-mlkit/barcode-scanning` (breitere Geräteabdeckung, bessere
   Bedienung, ~1 h).
5. **`android/`-Ordner** ins Git (empfohlen, damit Manifest/Icons versioniert
   sind) oder ignorieren und bei Bedarf neu erzeugen.
6. **Capacitor-Version**: aktuell (7.x). Alle Plugins müssen dieselbe
   Hauptversion haben.

### Phase 1 – Gerüst (Claude, ~2–3 h)

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` hinzufügen.
- `capacitor.config.ts`: `appId`, `appName`, `webDir: 'dist'`,
  `backgroundColor: '#0c0d0f'`, `androidScheme: 'https'`.
- `npx cap add android` → erzeugt den `android/`-Projektordner.
- npm-Skripte: `cap:build` (`npm run build && npx cap sync android`),
  `cap:open`, `cap:sync`.
- `.gitignore` um die Android-Bauartefakte ergänzen (`android/app/build`,
  `.gradle`, …), den Projektkern aber behalten.

### Phase 2 – Die Web-Schicht Capacitor-fest machen (Claude, ~2–3 h)

- **Service Worker** unter Capacitor nicht registrieren
  (`Capacitor.isNativePlatform()`), im Web-Bau unverändert lassen.
- **Statusleiste** (`@capacitor/status-bar`): Farbe `#0c0d0f`, helle Symbole.
- **Splash-Screen** (`@capacitor/splash-screen`): dunkel, wird beim
  Fertig-Laden ausgeblendet.
- **Zurück-Taste** (`@capacitor/app`): erst offene Dialoge schließen, dann im
  Reiter zurück, dann App in den Hintergrund. Die App hat viele Modals –
  hier braucht es einen zentralen Handler.
- **Sichere Ränder**: `env(safe-area-inset-*)` nutzt die App schon,
  `viewport-fit=cover` steht – am Gerät gegenprüfen.

### Phase 3 – Native Ersatzteile, wo es unter Android nötig ist (Claude, ~4–6 h)

- **Datei-Exporte** (`downloadText`, `downloadBlob`, `downloadBackup`,
  `shareCard`): eine Hülle, die im Web weiter `<a download>` benutzt und unter
  Capacitor über `@capacitor/filesystem` in „Dokumente" schreibt und die
  System-Teilen-Ansicht öffnet (`@capacitor/share`). Betrifft CSV, Backup-JSON,
  iCal, Foto-ZIP, Wochenbild.
- **Trainings-Erinnerung** → `@capacitor/local-notifications`: die geplante
  Erinnerung wird nativ terminiert und kommt auch bei geschlossener App
  (im Web geht das nachweislich nicht – das ist ein **Zugewinn**).
- **Teilen** → `@capacitor/share` für Plan-Code und Einladungslink.
- **Barcode** → optional `@capacitor-mlkit/barcode-scanning`.
- **Berechtigungen** im `AndroidManifest.xml`: `CAMERA`,
  `POST_NOTIFICATIONS` (Android 13+), `ACCESS_COARSE_LOCATION` (nur wenn Wetter
  genutzt wird), Kamera als „nicht erforderlich" markieren.

### Phase 4 – Icons und Splash (Claude, ~1–2 h)

- `@capacitor/assets` erzeugt alle Android-Dichten aus einer Quelle.
- Braucht ein **1024×1024-Icon** und ein Splash-Bild. Vorhanden ist
  `public/icon-512.png` – entweder hochskalieren oder eine saubere 1024er-Fassung
  anlegen. Dazu ein adaptives Icon (Vordergrund + Hintergrund).

### Phase 5 – Bauen und testen (Betreiber, ~1–2 h)

- `npm run cap:build`
- `npx cap open android` → Android Studio →
  *Build → Generate Signed Bundle / APK*.
- Am Gerät prüfen: Flugmodus-Start, Barcode + Kameraerlaubnis, Erinnerung bei
  geschlossener App, Zurück-Taste, alle Exporte, Hell/Dunkel, Bildschirm wach
  im Training.

### Phase 6 – Dokumentation (Claude, ~1 h)

- `docs/android-playstore.md`: der Capacitor-Weg wird der Hauptweg für „native
  Offline-App"; TWA bleibt als Alternative für „dünne Hülle um die Webseite".
- Kurzanleitung: App aktualisieren = `npm run cap:build`, in Android Studio neues
  signiertes Bundle, hochladen.
- README-Abschnitt „Als App".

### Aufwandsübersicht

| | Claude | Betreiber |
|---|---|---|
| Phase 1–2 Gerüst + Capacitor-fest | ~½ Tag | – |
| Phase 3 native Ersatzteile | ~½–1 Tag | – |
| Phase 4 Icons | ~1–2 h | ggf. Icon in 1024 liefern |
| Phase 5 Bau + Gerätetest | – | ~1–2 h + Android Studio |
| Phase 6 Doku | ~1 h | – |
| **Summe** | **~2 Tage** | **~2 h + Store-Einreichung** |

---

## 5. Risiken und offene Punkte

- **Web-Push → FCM**: Wenn Freunde-Anstupser auch nativ kommen sollen, braucht
  es ein Firebase-Projekt und eine Erweiterung der Edge Function. Ohne das
  bleibt die **lokale Erinnerung** (die sogar besser wird); die Anstupser gibt
  es dann nur in der Web-Fassung. → Entscheidung 0.3.
- **`android/` im Git**: ~150–200 Dateien Gradle-Gerüst. Capacitor empfiehlt,
  es zu versionieren. Alternative: ignorieren und ein Setup-Skript. → 0.5.
- **Zwei Bauziele**: Web/PWA **und** native APK. Die `isNativePlatform()`-
  Weichen halten den Web-Bau unangetastet; der Mehraufwand bei künftigen
  Änderungen ist klein, aber real.
- **WebView-Alter**: Capacitor braucht System-WebView ≥ 60 (praktisch alle
  Geräte ab ~2017). `BarcodeDetector` braucht ≥ 83 – daher die Empfehlung zum
  ML-Kit-Plugin für ältere Geräte.
- **Play Store**: gleicher Ablauf wie in `android-playstore.md`, aber **ohne**
  die TWA-/assetlinks-Schritte (einfacher). Die 12-Tester-Regel für neue
  Einzelkonten bleibt.
- **Supabase-Sync** braucht weiter Internet, wenn eingeschaltet – das ist
  gewollt und opt-in. „Läuft nicht übers Internet" heißt: der Kern läuft
  offline, und das tut er.
- **Fortschrittsfotos** liegen in IndexedDB im WebView-Speicher. Das ist stabil,
  aber an die App gebunden – bei Deinstallation weg. Wie schon heute im Web.
  Optional später auf `@capacitor/filesystem` umstellen.

---

## 6. Empfohlene Vorab-Entscheidungen (für den Betreiber)

1. **`appId`**: _______________ (z. B. `de.deinname.gymtracker`)
2. **Anzeigename**: „Gym Tracker" oder _______________
3. **Freunde-Push nativ**: (a) weglassen, nur lokale Erinnerung · (b) FCM
   nachrüsten (~1 Tag mehr)
4. **Barcode**: `BarcodeDetector` behalten · ML-Kit-Plugin (empfohlen)
5. **`android/` ins Git**: ja (empfohlen) · nein
6. **Sonst**: React Native statt Capacitor gewünscht? (dann mehrwöchiges
   Projekt, Oberfläche neu)

Sobald diese sechs Punkte stehen, ist Phase 1 sofort startklar.

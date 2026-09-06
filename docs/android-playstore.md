# Als Android-App in den Play Store

Der Gym-Tracker ist eine PWA: eine Webseite mit Manifest, Icons und Service
Worker, die sich installieren lässt und offline startet. Um daraus eine APK
(genauer: ein AAB fürs Play-Store, plus eine APK zum Testen) zu machen, gibt es
zwei Wege.

| | **TWA (Trusted Web Activity)** | **Capacitor** |
|---|---|---|
| Was steckt drin | eine dünne native Hülle um die **gehostete** Web-App | die Web-Dateien werden **in die APK gepackt** |
| Größe der APK | ~1–2 MB | ~5–10 MB |
| Updates | Web-App neu deployen, App aktualisiert sich | neue APK bauen (oder Code-Push nachrüsten) |
| Offline | hängt am Service Worker der Web-App | von Haus aus vollständig |
| Braucht Hosting | ja, HTTPS-URL + Digital Asset Links | nein (nur für die Freunde-Synchronisierung) |
| Native Extras | begrenzt (aber Kamera, Push, Vollbild gehen) | frei (echter Barcode-Scanner, Dateisystem …) |

**Empfehlung für diese App: TWA.** Die App ist schon eine funktionierende PWA,
der Barcode-Scanner (`BarcodeDetector`) und die Push-Nachrichten laufen in der
Android-WebView (das ist Chrome), und Updates gehen ohne neuen Store-Upload. Der
einzige Aufwand ist das Hosting.

---

## Voraussetzungen (einmalig)

- **Node** (hast du) und **Java JDK 17** (`java -version` → 17.x)
- **Android SDK** – am einfachsten über [Android Studio](https://developer.android.com/studio); Bubblewrap kann es auch selbst nachladen
- **Google-Play-Entwicklerkonto** – einmalig 25 US-Dollar, ~1–2 Tage Freischaltung
- Die App **irgendwo unter HTTPS deployt** (siehe Schritt 1)

---

## Schritt 1 – Web-App deployen

```bash
npm run build          # erzeugt dist/
```

`dist/` ist ein Ordner statischer Dateien und läuft auf jedem Static-Host.
Kostenlos und mit Root-Domain (wichtig für Schritt 3):

- **Cloudflare Pages** oder **Netlify**: GitHub-Repo verbinden, Build-Befehl
  `npm run build`, Ausgabeordner `dist`. Du bekommst z. B.
  `https://gym-tracker.pages.dev`.
- **Vercel**: genauso.
- GitHub Pages geht zwar auch, liegt aber unter `…github.io/Gym-Tracker/` – dann
  kannst du `/.well-known/assetlinks.json` in Schritt 3 nicht an die richtige
  Stelle legen. Nur mit eigener Domain sinnvoll.

Danach in `public/manifest.webmanifest` `start_url` und `scope` auf die echte
Adresse setzen (`"https://gym-tracker.pages.dev/"`), und in
`public/sync-config.json` die produktive Supabase-Konfiguration hinterlegen
(oder leer lassen, wenn ohne Konten).

Prüfen: die Seite im Handy-Chrome öffnen → Menü → *App installieren* muss
angeboten werden. In den DevTools (Lighthouse → PWA) sollte alles grün sein.

---

## Schritt 2 – TWA-Projekt mit Bubblewrap erzeugen

[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) ist Googles
offizielles Werkzeug dafür.

```bash
npm install -g @bubblewrap/cli

mkdir gym-tracker-android && cd gym-tracker-android
bubblewrap init --manifest https://gym-tracker.pages.dev/manifest.webmanifest
```

Der Assistent fragt ab:

- **Package name** – die weltweit eindeutige App-ID, danach nie wieder
  änderbar. Übliche Form: umgedrehte Domain, z. B. `de.deinname.gymtracker`.
- **App name / Launcher name** – „Gym Tracker" / „Gym".
- **Farben** – aus dem Manifest übernommen (`#0c0d0f`).
- **Signing key** – Bubblewrap legt einen Keystore an (`android.keystore`) und
  fragt zwei Passwörter ab.
  **Diesen Keystore und die Passwörter sicher aufbewahren** (Passwortmanager,
  Backup). Ohne ihn kannst du die App im Store nie wieder aktualisieren.

```bash
bubblewrap build
```

Ergebnis im Ordner:

- `app-release-signed.apk` – zum Testen auf dem eigenen Gerät
- `app-release-bundle.aab` – das Paket für den Play Store

Nach jeder Änderung an der App (oder für eine neue Versionsnummer):
`bubblewrap update` (holt Änderungen aus dem Manifest, zählt `versionCode` hoch)
und wieder `bubblewrap build`.

---

## Schritt 3 – Digital Asset Links (die Adressleiste ausblenden)

Ohne diesen Schritt zeigt die App oben eine schmale Chrome-Adressleiste. Sie
verschwindet, sobald die Domain und die App-Signatur nachweislich
zusammengehören.

Bubblewrap gibt am Ende einen Block wie diesen aus (oder
`bubblewrap fingerprint`):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "de.deinname.gymtracker",
    "sha256_cert_fingerprints": ["AB:CD:… (dein Zertifikat)"]
  }
}]
```

Diese Datei muss unter **`https://gym-tracker.pages.dev/.well-known/assetlinks.json`**
erreichbar sein. Bei Cloudflare Pages / Netlify legst du dafür
`public/.well-known/assetlinks.json` ins Projekt (Vite kopiert `public/` mit).

Wichtig: Sobald die App im Play Store ist, **signiert Google sie neu** (Play App
Signing). Dann gehört noch ein **zweiter** Fingerabdruck in dieselbe Datei – zu
finden in der Play Console unter *Einrichtung → App-Integrität → Play-App-Signatur*.
Am Ende stehen dort also zwei Fingerabdrücke.

---

## Schritt 4 – Auf dem Gerät testen

Handy per USB anschließen, USB-Debugging an:

```bash
bubblewrap install        # oder: adb install app-release-signed.apk
```

Durchgehen:

- Startet im Vollbild, keine Adressleiste (nach Schritt 3)
- Barcode scannen fragt nach der Kamera-Erlaubnis und funktioniert
- Flugmodus an → App startet weiter, Training lässt sich eintragen
- Zurück-Taste verhält sich wie erwartet

---

## Schritt 5 – Play Store

1. [Play Console](https://play.google.com/console) → **App erstellen**. Name,
   Sprache, „App", „Kostenlos".
2. **Internal testing** anlegen und das `.aab` hochladen. Erst hier testen, bevor
   irgendwas öffentlich wird.
3. Die Pflichtangaben abarbeiten (Play Console führt durch die Liste):
   - **Store-Eintrag**: Titel, Kurzbeschreibung (80 Zeichen), Beschreibung,
     mindestens 2 Telefon-Screenshots, ein Feature-Grafik-Bild (1024×500).
   - **Inhaltseinstufung**: Fragebogen (Fitness-App ohne Gewalt/Glücksspiel →
     „ab 3").
   - **Datensicherheit**: ehrlich ausfüllen –
     *Daten liegen auf dem Gerät*; die Synchronisierung mit Freunden ist
     optional und läuft über ein Supabase-Projekt (Name, Trainingsauswertung,
     wahlweise Gewicht/Kalorien); die **Kamera** wird für den Barcode-Scan
     genutzt; **keine Werbung**, **kein Verkauf von Daten**.
   - **Datenschutzerklärung**: eine URL ist Pflicht, auch für eine so
     datensparsame App. Reicht eine einfache Seite auf demselben Host.
   - **Zielgruppe**, **Regierungs-App? nein**, **Anzeigen? nein**.
4. Zur Prüfung einreichen. Die erste Prüfung dauert meist einige Tage; Updates
   gehen danach schneller.

---

## Ohne CLI: PWABuilder

[pwabuilder.com](https://www.pwabuilder.com) macht Schritt 2 im Browser: URL
eingeben, „Package for stores" → Android. Erzeugt ebenfalls ein TWA-Paket samt
Keystore und einer fertigen `assetlinks.json` mit Anleitung. Bequemer, wenn du
Bubblewrap nicht lokal einrichten willst – das Ergebnis ist dasselbe.

---

## Der andere Weg: Capacitor

Wenn die App die Web-Dateien lieber selbst mitbringen soll (voll offline ohne
Hosting, echter nativer Barcode-Scanner):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Gym Tracker" de.deinname.gymtracker --web-dir dist
npm run build
npx cap add android
npx cap sync
npx cap open android      # Android Studio: Build → Generate Signed Bundle / APK
```

- Bei jedem App-Update: `npm run build && npx cap sync`, dann in Android Studio
  ein neues signiertes Bundle bauen und hochladen.
- Für einen zuverlässigeren Scanner:
  `@capacitor-mlkit/barcode-scanning` statt `BarcodeDetector`.
- Die Freunde-Synchronisierung braucht weiterhin Internet; alles andere läuft
  ohne.

---

## Was an dieser App schon passt

- Manifest, Icons (auch maskable), Service Worker mit Vorab-Cache aller
  App-Dateien – alles vorhanden.
- `base: './'` in `vite.config.ts` – funktioniert unter Root wie unter Unterpfad.
- Barcode-Scanner und Push laufen in der Android-WebView.
- Farben von Statusleiste, Manifest und App-Hintergrund sind aufeinander
  abgestimmt (`#0c0d0f`).

Zu tun bleibt: hosten, `start_url`/`scope` und `sync-config.json` auf die
Produktivwerte setzen, Store-Eintrag mit Texten und Screenshots füllen.

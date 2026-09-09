# Als Android-App in den Play Store

> Wenn du die App nur an Freunde weitergeben willst, brauchst du den Play Store
> nicht. Der einfachere Weg – Link, Installation auf dem Startbildschirm und
> eine APK zum Verschicken – steht in
> [`app-verteilen.md`](app-verteilen.md).

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

## Schritt 5 – Play Store, im Einzelnen

### 5.1  Entwicklerkonto

- [play.google.com/console](https://play.google.com/console) mit einem
  Google-Konto anmelden – am besten ein eigenes, nicht das private.
- **25 US-Dollar** einmalig, per Karte.
- **Identitätsprüfung** (seit 2023 für neue Konten Pflicht): Name, Adresse,
  Telefonnummer, Ausweisdokument. Als Privatperson wählst du „Einzelperson"
  (eine Organisation bräuchte eine D-U-N-S-Nummer). Die Prüfung dauert Stunden
  bis Tage.
- **Kontakt-Adresse**: Google verlangt eine Support-Adresse, die im
  Store-Eintrag **öffentlich** steht. Wer die eigene Wohnadresse nicht zeigen
  will, nimmt ein Postfach.
- Zwei-Faktor-Anmeldung ist Pflicht.

### 5.2  App anlegen

*Alle Apps → App erstellen*:

- **App-Name** (max. 30 Zeichen, später änderbar)
- Standardsprache
- **App** (kein Spiel)
- **Kostenlos oder kostenpflichtig** – von *kostenpflichtig* auf *kostenlos*
  geht später **nicht** zurück. Im Zweifel *kostenlos* wählen und, wenn du
  Geld nehmen willst, einen In-App-Kauf einbauen.
- Erklärungen: Spiel? nein. Enthält Werbung? (dazu unten mehr.)

### 5.3  Die Checkliste im Dashboard

Die Console führt durch eine Liste. Für diese App:

| Punkt | Was hier gilt |
|---|---|
| **App-Zugriff** | „Alle Funktionen ohne besonderen Zugriff verfügbar" – die App braucht kein Login. |
| **Werbung** | Ja/Nein. Bei Ja gibt es das Label „Enthält Werbung". (Siehe unten – im TWA ist das ohnehin schwierig.) |
| **Inhaltseinstufung** | IARC-Fragebogen. Fitness-App ohne Gewalt/Sex/Glücksspiel/Drogen → USK 0 / PEGI 3. |
| **Zielgruppe** | Altersgruppen. Sobald *unter 13* dabei ist, greift das strenge „Für Familien"-Programm. Für einen Trainingstracker → **13+** oder **16+** wählen. |
| **Nachrichten-App / COVID-Tracing / Behörden-App / Finanz-Features** | überall nein. |
| **Datensicherheit** | Der aufwändigste Punkt – eigener Absatz unten. |
| **Datenschutzerklärung** | Eine funktionierende URL ist **Pflicht**, auch für eine datensparsame App. Muss abdecken: was erhoben wird, wozu, welche Dritten (Supabase, Open Food Facts, ggf. Google Play Services / Werbenetz), Aufbewahrung, Kontakt, Nutzerrechte. Eine einfache Seite auf demselben Host reicht. |
| **App-Kategorie** | Gesundheit & Fitness. |
| **Store-Eintrag** | siehe 5.4 |

### 5.4  Store-Eintrag

- **Name** (30), **Kurzbeschreibung** (80), **Beschreibung** (4000)
- **App-Icon**: 512×512 PNG, unter 1 MB
- **Feature-Grafik**: 1024×500, steht oben im Eintrag
- **Screenshots**: 2 bis 8 Telefon-Screenshots, Hoch- oder Querformat, Kante
  320–3840 px. Optional Tablet-Screenshots und ein YouTube-Video.
- **Kontakt-E-Mail** (öffentlich, Pflicht)

### 5.5  Datensicherheit – ehrlich, weil Google nachprüft

Google gleicht diese Angaben mit den tatsächlich verbauten SDKs ab. Falsche
Angaben führen zur Entfernung.

Für diese App:

- **Erhobene Daten**: Ohne Synchronisierung – **keine** (alles im `localStorage`).
  Mit Synchronisierung: Name, Trainingsauswertungen, wahlweise Gewicht/Kalorien
  – gehen an dein Supabase-Projekt und an die Freunde, die du freigibst.
- **Kamera**: Zugriff für den Barcode-Scan. Das Bild wird **nicht** gespeichert
  oder übertragen – nur der erkannte Barcode geht an Open Food Facts.
- **Verschlüsselung bei der Übertragung**: ja (HTTPS).
- **Löschung**: Nutzer können ihre Daten löschen (lokal ohnehin, am Server über
  die Konto-Funktionen).
- **Verkauf von Daten**: nein. **Daten für Werbung**: nein – *solange keine
  Werbung drin ist*. Mit einem Werbe-SDK wird daraus „ja, Werbe-ID".

### 5.6  Release-Kanäle und die 12-Tester-Regel

Reihenfolge: **Internal testing** (bis 100 Tester, sofort) → **Closed testing**
(E-Mail-Listen) → **Open testing** (öffentliche Beta) → **Produktion**.

Für **neue Einzelkonten** (seit November 2023) gilt: bevor du überhaupt in die
Produktion darfst, musst du einen **Closed Test mit mindestens 12 Testern über
14 Tage laufen** lassen – die zwölf müssen die App die ganze Zeit installiert
lassen. Das ist die eigentliche Hürde, nicht die Technik. (Organisationskonten
sind davon ausgenommen.)

Pro Kanal: `.aab` hochladen, Länder und Rollout-Anteil festlegen, Release-Notes
je Sprache.

### 5.7  App-Signatur

Play App Signing ist für neue Apps verpflichtend: Du lädst mit deinem
**Upload-Schlüssel** hoch, Google hält den **Signaturschlüssel** und signiert
neu. Den SHA-256 des Signaturschlüssels holst du dir unter *Testen und
veröffentlichen → Einrichtung → App-Integrität* und trägst ihn als zweiten
Fingerabdruck in `assetlinks.json` ein (siehe Schritt 3).

### 5.8  Prüfung

Die **erste** Prüfung dauert derzeit einige Tage bis gut zwei Wochen. Häufige
Ablehnungsgründe: unvollständige Datenschutzerklärung, Datensicherheit passt
nicht zu den SDKs, eine Funktion tut nicht, Metadaten. Für die
**Kamera-Berechtigung** kann eine Rückfrage kommen – der Store-Eintrag sollte
den Barcode-Scan erwähnen.

Nach dem Start: `versionCode` hochzählen, neues `.aab`, stufenweiser Rollout.
Auf den **Pre-Launch-Report** achten (Google lässt die App auf echten Geräten
laufen und meldet Abstürze) und auf die **Android Vitals** (Absturz- und
ANR-Rate); zu hohe Werte drücken die Sichtbarkeit.

---

## Kann man Werbung schalten?

Kurz: **technisch ja, aber im TWA praktisch nicht, und es passt schlecht zu
dieser App.**

### Was geht womit

- **TWA**: Die App ist eine WebView. Ein Werbe-SDK von Google (**AdMob**) ist
  nativ und lässt sich hier nicht sauber einbinden. Web-Werbung (**AdSense**)
  ist laut Google-Richtlinie **in Apps nicht erlaubt** – AdSense ist für echte
  Webseiten. Damit bleibt im TWA realistisch: keine Werbung.
- **Capacitor**: Hier geht **AdMob** über ein Plugin
  (`@capacitor-community/admob` oder `@capacitor/admob`) – Banner, Interstitial,
  Rewarded. Wer Werbung will, baut die App also mit Capacitor statt als TWA.

### AdMob in Kürze

- Kostenloses Google-Konto, du legst „Ad Units" an und trägst deren IDs in die
  App ein.
- Formate: **Banner** (klein, dauerhaft sichtbar, bringt sehr wenig –
  Größenordnung 0,20–1 € je 1000 Einblendungen), **Interstitial** (Vollbild an
  Übergängen, mehr Geld, nervt), **Rewarded** (Nutzer entscheidet sich, ein
  Video für einen Vorteil anzusehen – bestes Verhältnis aus Ertrag und
  Akzeptanz), **Native** (ins App-Design eingepasst).
- Realistisch für eine kleine, selbst veröffentlichte App: Banner bringen
  Centbeträge im Monat. Rewarded/Interstitial deutlich mehr, kosten aber
  Nutzer.

### Was die Play-Richtlinie verlangt

- „Enthält Werbung" im Store-Eintrag deklarieren.
- **Keine störende Werbung**: keine unerwarteten Vollbild-Anzeigen, keine
  Werbung bei der Zurück-Taste, keine vor dem Laden der App, keine außerhalb der
  App, nichts, was wie eine Systemmeldung oder Teil der Bedienoberfläche
  aussieht.
- **EU/GDPR**: Für personalisierte Werbung an Nutzer in der EU/UK ist ein
  Einwilligungsdialog Pflicht (Googles UMP-SDK oder ein zertifizierter CMP).
  Ohne den nur nicht-personalisierte Werbung – die bringt weniger.
- **Datensicherheit** muss dann „Geräte- oder andere IDs" (Werbe-ID) für
  „Werbung/Marketing" angeben, mit Weitergabe an das Werbenetz.

### Warum es zu dieser App schlecht passt

Das Leitbild ist „deine Daten, auf deinem Gerät, kein Konto, kein Tracking".
Ein Werbe-SDK schickt die Werbe-ID und Nutzungssignale an Googles Werbeserver –
das widerspricht dem direkt und müsste in der Datenschutzerklärung und der
Datensicherheit auch so stehen.

### Bessere Alternativen zur Finanzierung

- **Einmaliger Kauf** (z. B. 2–4 €) über Play Billing.
- **Kostenlos mit optionalem „Pro" / Trinkgeld** als In-App-Kauf – der Kern
  bleibt frei und sauber.
- **Nur Rewarded-Werbung an einer Stelle** („Video ansehen, um den Wochen­
  rückblick als hübsches Bild zu exportieren") – am wenigsten aufdringlich.
- Einfach **kostenlos** lassen, als eigenes Projekt.

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

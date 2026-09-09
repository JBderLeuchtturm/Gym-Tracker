# Als Android-App in den Play Store

Der Gym-Tracker ist eine PWA: eine Webseite mit Manifest, Icons und Service
Worker, die sich installieren lässt und offline startet. Daraus wird ein
Play-Store-Eintrag, ohne die App neu zu schreiben.

> Wenn du die App nur **an Freunde weitergeben** willst, brauchst du den Store
> nicht – das steht in `docs/app-verteilen.md` (Link teilen oder APK
> verschicken). Der Store lohnt sich, wenn Fremde sie finden sollen, automatische
> Updates über Google laufen sollen oder du sie einfach „richtig" veröffentlichen
> willst.

---

## Die kurze Antwort

1. Entwicklerkonto anlegen, 25 US-Dollar, Ausweis hochladen.
2. Die App unter einer HTTPS-Adresse hosten, **deren Wurzel dir gehört**.
3. Mit **Bubblewrap** eine TWA-Hülle bauen (`.aab`).
4. `assetlinks.json` an die Wurzel dieser Adresse legen.
5. In der Play Console den Papierkram ausfüllen: Datenschutzerklärung,
   Datensicherheit, Inhaltseinstufung, Screenshots.
6. Geschlossenen Test fahren, dann Produktion beantragen.

Technisch sind das ein bis zwei Abende. Die zwei echten Hürden stehen unten –
lies die zuerst, bevor du anfängst.

---

## Hürde 1 – die 12-Tester-Regel

Für **neue Einzelkonten** (also Privatpersonen, kein Firmenkonto mit
D-U-N-S-Nummer) verlangt Google, dass die App vor der Produktion einen
**geschlossenen Test mit mindestens 12 Testern über 14 Tage** durchlaufen hat.
Die zwölf müssen sich eintragen und die App die ganze Zeit installiert lassen.
Erst danach kannst du den Zugang zur Produktion beantragen.

Das ist die eigentliche Hürde, nicht die Technik: Du brauchst zwölf echte
Google-Konten von Leuten, die mitmachen. Sinnvoll ist, das früh anzustoßen –
die 14 Tage laufen parallel zu allem anderen.

Google schraubt an dieser Regel regelmäßig (Anzahl, Dauer, wer betroffen ist).
Was **heute** für dein Konto gilt, steht in der Play Console selbst unter
*Testen und veröffentlichen → Produktion → Zugriff auf die Produktion*. Verlass
dich auf die Anzeige dort, nicht auf diesen Text.

Organisationskonten sind ausgenommen – dafür brauchst du aber eine eingetragene
Organisation und eine D-U-N-S-Nummer.

---

## Hürde 2 – die Adresse muss dir bis zur Wurzel gehören

Eine TWA gilt erst dann als „deine" App, wenn unter
`https://DEINE-DOMAIN/.well-known/assetlinks.json` eine Datei liegt, die App und
Domain verknüpft (Details in Schritt 3). Entscheidend: **die Wurzel der Domain**,
nicht ein Unterordner.

Die App läuft aktuell auf `https://jbderleuchtturm.github.io/Gym-Tracker/`. Die
Wurzel davon ist `https://jbderleuchtturm.github.io/` – und die gehört zum
GitHub-Pages-Repo `jbderleuchtturm.github.io`, nicht zu diesem Projekt. Ohne
Zugriff darauf zeigt die App oben dauerhaft eine schmale Chrome-Adressleiste.
Sie funktioniert, sieht aber nicht nach App aus.

Drei Auswege:

### A – ein zweites Repo für die Wurzel *(kostenlos, bleibt bei GitHub)*

1. Neues, öffentliches Repo mit **exakt** dem Namen `jbderleuchtturm.github.io`.
2. Darin zwei Dateien:
   - `.well-known/assetlinks.json` (Inhalt aus Schritt 3)
   - `.nojekyll` – leere Datei, **wichtig**: GitHub Pages lässt sonst Jekyll
     laufen, und Jekyll ignoriert alle Ordner, die mit einem Punkt anfangen.
     Ohne `.nojekyll` wird `.well-known/` schlicht nicht ausgeliefert.
3. *Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`.*
4. Prüfen: `https://jbderleuchtturm.github.io/.well-known/assetlinks.json` muss
   im Browser den JSON-Text zeigen.

Der Gym-Tracker selbst bleibt, wo er ist. Das Wurzel-Repo ist nur der Briefkasten
für die eine Datei.

### B – Umzug zu Cloudflare Pages *(empfohlen)*

Du bekommst eine eigene Wurzel wie `https://gym-tracker.pages.dev/`, und die
`assetlinks.json` liegt einfach im Projekt:

1. [dash.cloudflare.com](https://dash.cloudflare.com) → *Workers & Pages →
   Create → Pages → Connect to Git* → dieses Repo.
2. Build-Befehl `npm run build`, Ausgabeordner `dist`, Branch
   `claude/gym-tracker-website-aeaazi`.
3. Später: `public/.well-known/assetlinks.json` ins Projekt legen – Vite kopiert
   `public/` unverändert nach `dist/`.

Vorteil: alles in einem Repo, jeder Push deployt, und die App liegt auf `/`
statt `/Gym-Tracker/`. Netlify und Vercel gehen genauso.

### C – eigene Domain

Eine Domain für ~10 €/Jahr (z. B. bei Namecheap oder INWX) und auf GitHub Pages
oder Cloudflare zeigen lassen. Sieht im Store am besten aus, kostet Geld.

**Was ich nehmen würde:** B. Ein Umzug ist ein Nachmittag, und danach musst du
nie wieder über Unterordner nachdenken. Wenn du bei GitHub bleiben willst, tut A
es aber genauso – der Unterschied ist nur Bequemlichkeit.

---

## TWA oder Capacitor

| | **TWA (Trusted Web Activity)** | **Capacitor** |
|---|---|---|
| Was steckt drin | eine dünne native Hülle um die **gehostete** Web-App | die Web-Dateien werden **in die APK gepackt** |
| Größe | ~1–2 MB | ~5–10 MB |
| Updates | Web-App neu deployen, App aktualisiert sich | neues Bundle bauen und hochladen |
| Offline | über den Service Worker der Web-App | von Haus aus vollständig |
| Braucht Hosting | ja, HTTPS + Digital Asset Links | nein (nur für die Freunde-Synchronisierung) |
| Native Extras | begrenzt (Kamera, Push, Vollbild gehen) | frei (echter Barcode-Scanner, Dateisystem …) |
| Werbung möglich | praktisch nein | ja (AdMob) |

**Empfehlung: TWA** – vorausgesetzt, Hürde 2 ist gelöst. Die App ist schon eine
funktionierende PWA, Barcode-Scanner (`BarcodeDetector`) und Push laufen in der
Android-WebView (das ist Chrome), und jede Änderung ist ohne neuen Store-Upload
beim Nutzer.

**Nimm Capacitor**, wenn du die Wurzel partout nicht in den Griff bekommst oder
die App ohne Hosting funktionieren soll – dann steckt alles in der APK und
Digital Asset Links entfallen. Preis: jedes Update braucht einen neuen Upload
und Googles Prüfung.

---

## Voraussetzungen (einmalig)

- **Node** (hast du) und **Java JDK 17** (`java -version` → 17.x)
- **Android SDK** – am einfachsten über
  [Android Studio](https://developer.android.com/studio); Bubblewrap kann es
  auch selbst nachladen
- **Google-Play-Entwicklerkonto** – 25 US-Dollar, Freischaltung dauert
- Die App unter HTTPS deployt, mit erreichbarer Wurzel (Hürde 2)

---

## Schritt 1 – Web-App deployen

Läuft schon: `.github/workflows/deploy.yml` baut bei jedem Push auf
`claude/gym-tracker-website-aeaazi` und veröffentlicht `dist/` auf GitHub Pages.
Wenn du nach Cloudflare umziehst (Variante B), übernimmt Cloudflare das.

Am Manifest ist **nichts zu ändern**: `start_url` und `scope` stehen auf `"./"`,
und relativ ist hier richtig. Bubblewrap löst sie gegen die Manifest-Adresse auf,
und die App läuft damit unter `/` genauso wie unter `/Gym-Tracker/` und lokal in
der Vorschau. Absolute Adressen einzutragen würde die lokale Entwicklung
kaputtmachen.

Was du vor dem Store **wohl** setzen willst: `public/sync-config.json` mit der
produktiven Supabase-Konfiguration (nur der *publishable*-Key und der
**öffentliche** VAPID-Schlüssel – der private gehört niemals ins Repo). Leer
lassen geht auch, dann läuft die App ohne Konten.

Prüfen: Seite im Handy-Chrome öffnen → Menü → *App installieren* muss angeboten
werden. In den DevTools (Lighthouse → PWA) sollte alles grün sein.

---

## Schritt 2 – TWA-Projekt mit Bubblewrap erzeugen

[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) ist Googles
offizielles Werkzeug dafür.

```bash
npm install -g @bubblewrap/cli

mkdir gym-tracker-android && cd gym-tracker-android

# aktuelle Adresse:
bubblewrap init --manifest https://jbderleuchtturm.github.io/Gym-Tracker/manifest.webmanifest

# nach dem Umzug zu Cloudflare stattdessen:
# bubblewrap init --manifest https://gym-tracker.pages.dev/manifest.webmanifest
```

Der Assistent fragt ab:

- **Package name** – die weltweit eindeutige App-ID, danach **nie wieder
  änderbar**. Übliche Form: umgedrehte Domain, z. B. `io.github.jbderleuchtturm.gymtracker`.
- **App name / Launcher name** – „Gym Tracker" / „Gym".
- **Farben** – kommen aus dem Manifest (`#0c0d0f`).
- **Signing key** – Bubblewrap legt einen Keystore an (`android.keystore`) und
  fragt zwei Passwörter ab.
  **Keystore und Passwörter sicher aufbewahren** (Passwortmanager, Backup an
  einem zweiten Ort). Ohne sie kannst du die App im Store nie wieder
  aktualisieren – und der Keystore gehört **niemals ins Repository**.

```bash
bubblewrap build
```

Ergebnis:

- `app-release-signed.apk` – zum Testen auf dem eigenen Gerät
- `app-release-bundle.aab` – das Paket für den Play Store

---

## Schritt 3 – Digital Asset Links

Bubblewrap gibt am Ende einen Block wie diesen aus (oder
`bubblewrap fingerprint`):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.github.jbderleuchtturm.gymtracker",
    "sha256_cert_fingerprints": ["AB:CD:… (dein Zertifikat)"]
  }
}]
```

Diese Datei muss unter der **Wurzel** erreichbar sein:

- Variante A: `https://jbderleuchtturm.github.io/.well-known/assetlinks.json`
  (im Repo `jbderleuchtturm.github.io`, zusammen mit `.nojekyll`)
- Variante B: `https://gym-tracker.pages.dev/.well-known/assetlinks.json`
  (als `public/.well-known/assetlinks.json` in diesem Projekt)

Wichtig: Sobald die App im Play Store ist, **signiert Google sie neu** (Play App
Signing). Dann gehört ein **zweiter** Fingerabdruck in dieselbe Datei – zu finden
in der Play Console unter *Testen und veröffentlichen → Einrichtung →
App-Integrität → Play-App-Signatur*. Am Ende stehen dort also zwei.

Prüfen kannst du das Ergebnis mit Googles Tester:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://DEINE-DOMAIN&relation=delegate_permission/common.handle_all_urls
```

Solange die Adressleiste in der App noch zu sehen ist, stimmt hier etwas nicht.
Android cacht das Ergebnis – nach einer Korrektur App deinstallieren und neu
installieren.

---

## Schritt 4 – Auf dem Gerät testen

Handy per USB anschließen, USB-Debugging an:

```bash
bubblewrap install        # oder: adb install app-release-signed.apk
```

Durchgehen:

- Startet im Vollbild, **keine Adressleiste** (sonst zurück zu Schritt 3)
- Barcode scannen fragt nach der Kamera-Erlaubnis und funktioniert
- Flugmodus an → App startet weiter, Training lässt sich eintragen
- Zurück-Taste verhält sich wie erwartet
- Push-Benachrichtigungen kommen an (Android 13+ fragt einmalig nach)

---

## Schritt 5 – Play Store, im Einzelnen

### 5.1  Entwicklerkonto

- [play.google.com/console](https://play.google.com/console) mit einem
  Google-Konto anmelden – am besten ein eigenes, nicht das private.
- **25 US-Dollar** einmalig, per Karte.
- **Identitätsprüfung**: Name, Adresse, Telefonnummer, Ausweisdokument. Als
  Privatperson wählst du „Einzelperson" (eine Organisation bräuchte eine
  D-U-N-S-Nummer). Dauert Stunden bis Tage.
- **Kontakt-Adresse**: Google verlangt eine Support-Adresse, die im Store-Eintrag
  **öffentlich** steht. Wer die eigene Wohnadresse nicht zeigen will, nimmt ein
  Postfach.
- Zwei-Faktor-Anmeldung ist Pflicht.

### 5.2  App anlegen

*Alle Apps → App erstellen*:

- **App-Name** (max. 30 Zeichen, später änderbar)
- Standardsprache
- **App** (kein Spiel)
- **Kostenlos oder kostenpflichtig** – von *kostenpflichtig* auf *kostenlos*
  geht später **nicht** zurück. Im Zweifel *kostenlos* wählen und, wenn du Geld
  nehmen willst, einen In-App-Kauf einbauen.

### 5.3  Die Checkliste im Dashboard

| Punkt | Was hier gilt |
|---|---|
| **App-Zugriff** | „Alle Funktionen ohne besonderen Zugriff verfügbar" – die App braucht kein Login. Falls du die Freunde-Funktion zeigen willst: Testzugang hinterlegen. |
| **Werbung** | Ja/Nein. Bei Ja gibt es das Label „Enthält Werbung". (Siehe unten – im TWA ohnehin schwierig.) |
| **Inhaltseinstufung** | IARC-Fragebogen. Fitness-App ohne Gewalt/Sex/Glücksspiel/Drogen → USK 0 / PEGI 3. |
| **Zielgruppe** | Sobald *unter 13* dabei ist, greift das strenge „Für Familien"-Programm. Für einen Trainingstracker → **13+** oder **16+**. |
| **Nachrichten-App / COVID-Tracing / Behörden-App / Finanz-Features** | überall nein. |
| **Gesundheits-Apps** | Es gibt eine Deklaration für Gesundheits-Apps. Ein reiner Trainings- und Kalorien-Tracker ohne medizinische Aussagen fällt normalerweise nicht darunter – lies die Frage trotzdem genau und behaupte **keine** medizinische Wirkung im Store-Text. |
| **Datensicherheit** | Der aufwändigste Punkt – eigener Absatz unten. |
| **Datenschutzerklärung** | Eine funktionierende URL ist **Pflicht**, auch für eine datensparsame App. Eine einfache Seite auf demselben Host reicht. |
| **App-Kategorie** | Gesundheit & Fitness. |

### 5.4  Store-Eintrag

- **Name** (30), **Kurzbeschreibung** (80), **Beschreibung** (4000)
- **App-Icon**: 512×512 PNG, unter 1 MB (`public/icon-512.png` ist da)
- **Feature-Grafik**: 1024×500, steht oben im Eintrag – die musst du noch bauen
- **Screenshots**: 2 bis 8 Telefon-Screenshots, Kante 320–3840 px. Optional
  Tablet-Screenshots und ein YouTube-Video.
- **Kontakt-E-Mail** (öffentlich, Pflicht)

### 5.5  Datensicherheit – ehrlich, weil Google nachprüft

Google gleicht diese Angaben mit den tatsächlich verbauten SDKs ab. Falsche
Angaben führen zur Entfernung. Für diese App:

- **Ohne Konto**: **keine** Datenerhebung – alles liegt im `localStorage` des
  Geräts.
- **Mit Konto (Supabase)**: E-Mail-Adresse (Anmeldung), selbstgewählter Name und
  Handle, der App-Zustand als Sicherung (`user_state`), die geteilten
  Auswertungen für Freunde und – falls eingeschaltet – die Zeile in der
  Rangliste (`rank_board`: Punktzahl, Stufe je Bewegung, Anzeigename; **keine
  Gewichte**).
- **Fortschrittsfotos** bleiben ausschließlich auf dem Gerät (IndexedDB), gehen
  weder in die Synchronisierung noch in die Sicherungsdatei. Also **nicht** als
  erhoben angeben.
- **Kamera**: Zugriff für den Barcode-Scan. Das Bild wird nicht gespeichert oder
  übertragen – nur der erkannte Barcode geht an Open Food Facts.
- **Standort**: die Wetter-Abfrage nutzt den groben Standort, falls du sie
  erlaubst. Das ist eine „ungefähre Standortangabe" und gehört ins Formular,
  wenn die Funktion aktiv ist.
- **Benachrichtigungen**: Push braucht eine Geräte-Kennung beim Push-Dienst.
- **Verschlüsselung bei der Übertragung**: ja (HTTPS).
- **Löschung**: Nutzer können ihre Daten löschen (lokal ohnehin, am Server über
  die Konto-Funktionen). Google verlangt zusätzlich eine **öffentlich
  erreichbare Seite zur Kontolöschung** – auch als Link im Store-Eintrag.
- **Verkauf von Daten**: nein. **Daten für Werbung**: nein – *solange keine
  Werbung drin ist*.

### 5.6  Release-Kanäle

Reihenfolge: **Internal testing** (bis 100 Tester, sofort verfügbar) →
**Closed testing** (E-Mail-Listen – hier laufen die 14 Tage aus Hürde 1) →
**Open testing** (öffentliche Beta) → **Produktion**.

Pro Kanal: `.aab` hochladen, Länder und Rollout-Anteil festlegen, Release-Notes
je Sprache.

### 5.7  App-Signatur

Play App Signing ist für neue Apps verpflichtend: Du lädst mit deinem
**Upload-Schlüssel** hoch, Google hält den **Signaturschlüssel** und signiert
neu. Den SHA-256 des Signaturschlüssels holst du dir unter *Einrichtung →
App-Integrität* und trägst ihn als zweiten Fingerabdruck in `assetlinks.json`
ein (siehe Schritt 3).

### 5.8  Prüfung

Die **erste** Prüfung dauert einige Tage bis gut zwei Wochen. Häufige
Ablehnungsgründe: unvollständige Datenschutzerklärung, Datensicherheit passt
nicht zu den SDKs, eine Funktion tut nicht, Metadaten. Für die
**Kamera-Berechtigung** kann eine Rückfrage kommen – der Store-Eintrag sollte den
Barcode-Scan erwähnen.

---

## Updates nach dem Start

Zwei Ebenen, und das ist der Grund für die TWA:

- **Inhalt der App** (alles, was in diesem Repo steht): Push auf
  `claude/gym-tracker-website-aeaazi`, der Workflow deployt, der Service Worker
  holt die neue Version. **Kein Store-Upload, keine Prüfung, keine Wartezeit.**
  Das deckt praktisch jede Änderung ab.
- **Die Hülle** (Name, Icon, Farben, Android-Zielversion): nur dann nötig.

```bash
cd gym-tracker-android
bubblewrap update      # zieht Manifest-Änderungen, zählt versionCode hoch
bubblewrap build
# neues .aab in der Play Console hochladen
```

Google verlangt außerdem alle paar Jahre eine neuere `targetSdkVersion` – dann
kommt eine Mail, und `bubblewrap update` erledigt das.

Achte auf den **Pre-Launch-Report** (Google lässt die App auf echten Geräten
laufen und meldet Abstürze) und die **Android Vitals** (Absturz- und ANR-Rate);
zu hohe Werte drücken die Sichtbarkeit.

---

## Kann man Werbung schalten?

Kurz: **technisch ja, im TWA praktisch nicht, und es passt schlecht zu dieser
App.**

### Was geht womit

- **TWA**: Die App ist eine WebView. Ein Werbe-SDK von Google (**AdMob**) ist
  nativ und lässt sich hier nicht sauber einbinden. Web-Werbung (**AdSense**) ist
  laut Google-Richtlinie **in Apps nicht erlaubt** – AdSense ist für echte
  Webseiten. Damit bleibt im TWA realistisch: keine Werbung.
- **Capacitor**: Hier geht **AdMob** über ein Plugin
  (`@capacitor-community/admob`) – Banner, Interstitial, Rewarded. Wer Werbung
  will, baut die App mit Capacitor statt als TWA.

### AdMob in Kürze

- Kostenloses Google-Konto, du legst „Ad Units" an und trägst deren IDs ein.
- Formate: **Banner** (klein, dauerhaft, bringt sehr wenig – Größenordnung
  0,20–1 € je 1000 Einblendungen), **Interstitial** (Vollbild an Übergängen, mehr
  Geld, nervt), **Rewarded** (Nutzer sieht freiwillig ein Video für einen Vorteil
  – bestes Verhältnis aus Ertrag und Akzeptanz), **Native**.
- Realistisch für eine kleine, selbst veröffentlichte App: Banner bringen
  Centbeträge im Monat.

### Was die Play-Richtlinie verlangt

- „Enthält Werbung" im Store-Eintrag deklarieren.
- **Keine störende Werbung**: keine unerwarteten Vollbild-Anzeigen, keine Werbung
  bei der Zurück-Taste, keine vor dem Laden der App, keine außerhalb der App,
  nichts, was wie eine Systemmeldung oder Teil der Bedienoberfläche aussieht.
- **EU/GDPR**: Für personalisierte Werbung in der EU/UK ist ein
  Einwilligungsdialog Pflicht (Googles UMP-SDK oder ein zertifizierter CMP).
  Ohne den nur nicht-personalisierte Werbung – die bringt weniger.
- **Datensicherheit** muss dann „Geräte- oder andere IDs" (Werbe-ID) für
  „Werbung/Marketing" angeben, mit Weitergabe an das Werbenetz.

### Warum es zu dieser App schlecht passt

Das Leitbild ist „deine Daten, auf deinem Gerät, kein Konto, kein Tracking". Ein
Werbe-SDK schickt die Werbe-ID und Nutzungssignale an Googles Werbeserver – das
widerspricht dem direkt und müsste in Datenschutzerklärung und Datensicherheit
auch so stehen.

### Bessere Alternativen

- **Einmaliger Kauf** (2–4 €) über Play Billing.
- **Kostenlos mit optionalem „Pro" / Trinkgeld** als In-App-Kauf – der Kern
  bleibt frei und sauber.
- **Nur Rewarded-Werbung an einer Stelle**, freiwillig.
- Einfach **kostenlos** lassen, als eigenes Projekt.

---

## Ohne CLI: PWABuilder

[pwabuilder.com](https://www.pwabuilder.com) macht Schritt 2 im Browser: URL
eingeben, *Package for stores* → Android. Erzeugt ebenfalls ein TWA-Paket samt
Keystore und einer fertigen `assetlinks.json` mit Anleitung. Bequemer, wenn du
Bubblewrap nicht lokal einrichten willst – das Ergebnis ist dasselbe, und
Hürde 2 bleibt trotzdem bestehen.

---

## Der andere Weg: Capacitor

Wenn die App die Web-Dateien lieber selbst mitbringen soll (voll offline ohne
Hosting, echter nativer Barcode-Scanner, Werbung möglich):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Gym Tracker" io.github.jbderleuchtturm.gymtracker --web-dir dist
npm run build
npx cap add android
npx cap sync
npx cap open android      # Android Studio: Build → Generate Signed Bundle / APK
```

- Bei jedem App-Update: `npm run build && npx cap sync`, dann in Android Studio
  ein neues signiertes Bundle bauen und hochladen. **Jedes Mal durch Googles
  Prüfung.**
- Für einen zuverlässigeren Scanner: `@capacitor-mlkit/barcode-scanning` statt
  `BarcodeDetector`.
- Digital Asset Links entfallen – Hürde 2 ist damit gelöst, Hürde 1 nicht.

---

## Was an dieser App schon passt

- Manifest, Icons (auch maskable), Service Worker mit Vorab-Cache aller
  App-Dateien – alles vorhanden.
- `base: './'` in `vite.config.ts` und relative `start_url`/`scope` – funktioniert
  unter Root wie unter Unterpfad. **Nicht anfassen.**
- Barcode-Scanner und Push laufen in der Android-WebView.
- Farben von Statusleiste, Manifest und App-Hintergrund sind aufeinander
  abgestimmt (`#0c0d0f`).
- Automatischer Deploy per GitHub Actions steht.

Zu tun bleibt:

1. Wurzel klären (Hürde 2, Variante A oder B)
2. Datenschutzerklärung und Seite zur Kontolöschung schreiben und hosten
3. Feature-Grafik 1024×500 und Screenshots
4. Zwölf Tester zusammentrommeln (Hürde 1)

### Kleiner Stolperstein am Rande

Im Manifest steht `"id": "/"`. Das löst sich zur Wurzel der Domain auf, nicht zum
Unterordner. Solange auf `jbderleuchtturm.github.io` nur diese eine PWA liegt,
ist das egal. Zwei PWAs auf derselben Wurzel würden sich damit aber dieselbe
Kennung teilen. Ändern solltest du das trotzdem nur, bevor Leute die App
installiert haben – eine geänderte `id` gilt für Chrome als **andere** App und
erzeugt beim Nutzer ein zweites Symbol statt eines Updates.

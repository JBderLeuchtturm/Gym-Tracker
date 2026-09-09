# Die App aufs Handy bringen und weitergeben

Ziel: eine App, die auf dem Handy wie eine App aussieht und startet, die du an
Freunde weitergeben kannst – und die neue Fassungen bekommt, ohne dass jeder
etwas tun muss.

Es gibt dafür vier Wege. **Sie schließen sich nicht aus**, und der erste ist bei
Weitem der einfachste.

| | Weg A: Link | Weg B: APK verschicken | Weg C: Play Store | Weg D: iPhone-Store |
|---|---|---|---|---|
| iPhone | ✅ | ❌ | ❌ | ✅ |
| Android | ✅ | ✅ | ✅ | ❌ |
| Weitergeben | Link schicken | Datei schicken | Store-Link | Einladung |
| Aufwand | ~10 Minuten | ~1 Stunde einmalig | ~1 Tag (Prüfung) | ~1 Tag |
| Kosten | nichts | nichts | 25 $ einmalig | 99 $ pro Jahr |
| Updates | von selbst | von selbst¹ | von selbst¹ | neuer Upload |

¹ wenn du die Variante „Hülle um die Webseite" baust – siehe Weg B.

> **Empfehlung:** Weg A für alle. Wer auf Android partout eine Datei haben will,
> bekommt zusätzlich Weg B. Weg C und D lohnen sich erst, wenn Fremde die App
> finden sollen.

---

# Weg A — Link zum Installieren

Das ist kein Kompromiss: Die App ist eine PWA. Einmal auf den Startbildschirm
gelegt, hat sie ein eigenes Symbol, startet im Vollbild ohne Adressleiste,
läuft ohne Internet und aktualisiert sich selbst. Auf dem iPhone ist das
ohnehin der einzige Weg ohne Apple-Konto.

## Schritt 1 – GitHub Pages einschalten (einmalig)

1. Auf GitHub ins Repo → **Settings** → in der linken Spalte **Pages**.
2. Bei **Source** auf **„GitHub Actions"** stellen. Speichern.

Mehr ist da nicht zu tun. Der Workflow liegt schon im Repo
(`.github/workflows/deploy.yml`) und baut bei jedem Push auf die Hauptbranch.

## Schritt 2 – Veröffentlichen

Merge einen Pull Request nach `claude/gym-tracker-website-aeaazi` (oder pushe
direkt dorthin). Unter **Actions** läuft dann „Deploy" – dauert ein bis zwei
Minuten.

Danach ist die App hier erreichbar:

```
https://jbderleuchtturm.github.io/Gym-Tracker/
```

Ruf die Adresse einmal am Rechner auf und prüfe, dass sie lädt.

## Schritt 3 – Auf dem eigenen Handy installieren

**iPhone (Safari – Chrome auf dem iPhone kann das nicht):**
1. Adresse in **Safari** öffnen.
2. Unten auf das **Teilen-Symbol** (Quadrat mit Pfeil).
3. Nach unten scrollen → **„Zum Home-Bildschirm"** → **Hinzufügen**.

**Android (Chrome):**
1. Adresse in Chrome öffnen.
2. Drei-Punkte-Menü oben rechts.
3. **„App installieren"** (oder „Zum Startbildschirm hinzufügen").

Danach liegt das Symbol auf dem Startbildschirm und die App startet im Vollbild.

## Schritt 4 – Weitergeben

Schick einfach die Adresse. Dazu ein Satz, was zu tun ist:

> Gym-Tracker: https://jbderleuchtturm.github.io/Gym-Tracker/
> Öffnen, dann iPhone: Teilen → „Zum Home-Bildschirm". Android: Menü → „App
> installieren". Danach läuft es wie eine App, auch ohne Internet.

**Tipp:** Aus der Adresse einen QR-Code machen (z. B. in Chrome: Menü →
„QR-Code teilen"). Den kannst du in einen Gruppenchat werfen oder ausdrucken.

## Was deine Freunde bekommen

- Jeder hat **seine eigenen Daten**, lokal auf seinem Gerät. Es geht nichts an
  dich und nichts an einen Server, solange niemand ein Konto anlegt.
- Wer Freunde-Funktionen und die Rangliste will, legt unter *Freunde* ein Konto
  an. Das läuft über dein Supabase-Projekt – die Zugangsdaten dafür stecken
  schon in `public/sync-config.json`.
- Ohne Konto fehlt nichts außer dem Vergleich mit anderen.

---

# Weg B — Eine APK, die du verschicken kannst

Nur für Android. Am Ende hast du eine Datei, die du über WhatsApp, Telegram
oder einen Link weitergeben kannst.

## Erst die eine wichtige Entscheidung

Es gibt zwei Bauarten, und sie unterscheiden sich vor allem beim Aktualisieren:

**B1 – Hülle um die Webseite (empfohlen).**
Die APK enthält nur eine Ansicht, die deine veröffentlichte Adresse lädt. Der
Inhalt kommt aus dem Netz und wird vom Service Worker offline vorgehalten.

* Updates kommen **von selbst**, genau wie bei Weg A. Die APK baust du **einmal**
  und nie wieder.
* Beim allerersten Start braucht sie kurz Internet. Danach läuft sie offline.

**B2 – Alles eingebaut.**
Die gebauten Dateien liegen in der APK. Offline ab der ersten Sekunde, kein
Hosting nötig.

* Jedes Update heißt: **neue APK bauen und an alle neu verschicken.** Bei einer
  App, die sich jede Woche ändert, wird das schnell mühsam.

Der Rest dieser Anleitung baut **B1**. Für B2 steht der Unterschied unten in
einem eigenen Abschnitt – es ist eine geänderte Zeile.

## Voraussetzungen (einmalig, auf deinem Rechner)

- **Node** – hast du schon.
- **Java JDK 17 oder neuer** – `java -version` muss etwas ab `17` zeigen.
- **Android Studio** – https://developer.android.com/studio. Beim ersten Start
  installiert es das Android SDK; einfach durchklicken.

## Schritt 1 – Capacitor ins Projekt holen

Im Projektordner:

```bash
npm install --save-dev @capacitor/cli
npm install @capacitor/core @capacitor/android
npx cap init "Gym Tracker" com.jbderleuchtturm.gymtracker --web-dir dist
```

`com.jbderleuchtturm.gymtracker` ist die App-Kennung. Sie muss weltweit
eindeutig sein und lässt sich später **nicht mehr ändern**, ohne dass die App
als eine andere gilt – such sie dir also gleich richtig aus.

## Schritt 2 – Auf die veröffentlichte Adresse zeigen

`capacitor.config.ts` öffnen und den `server`-Block ergänzen:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jbderleuchtturm.gymtracker',
  appName: 'Gym Tracker',
  webDir: 'dist',
  server: {
    // Die App lädt den Inhalt von hier - dadurch aktualisiert sie sich selbst.
    url: 'https://jbderleuchtturm.github.io/Gym-Tracker/',
    cleartext: false,
  },
};

export default config;
```

## Schritt 3 – Android-Projekt erzeugen

```bash
npm run build
npx cap add android
npx cap sync android
```

Das legt einen Ordner `android/` an. Der gehört ins Repo – dort landen später
auch das Symbol und die Einstellungen.

## Schritt 4 – Symbol und Name

Am schnellsten in Android Studio:

```bash
npx cap open android
```

Dann Rechtsklick auf `app` → **New → Image Asset**, bei *Path* die Datei
`public/icon-512.png` wählen, *Name* auf `ic_launcher` lassen, **Next → Finish**.

Den angezeigten Namen setzt du in `android/app/src/main/res/values/strings.xml`:

```xml
<string name="app_name">Gym Tracker</string>
<string name="title_activity_main">Gym Tracker</string>
```

## Schritt 5 – Einen Schlüssel anlegen (einmalig, gut aufheben!)

Android nimmt nur signierte Apps. Der Schlüssel entscheidet, ob eine spätere
APK als **Update** oder als **fremde App** gilt.

```bash
keytool -genkey -v -keystore ~/gym-tracker.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias gym
```

> **Diese Datei ist unersetzlich.** Verlierst du sie, kannst du nie wieder ein
> Update für dieselbe App bauen – alle müssten deinstallieren und neu
> installieren. Leg sie in deinen Passwort-Manager oder auf einen Stick.
>
> **Nicht ins Repo legen.** Weder die `.jks` noch die Passwörter.

Die Passwörter kommen nach `~/.gradle/gradle.properties` (also außerhalb des
Projekts):

```properties
GYM_STORE_FILE=/Users/DEINNAME/gym-tracker.jks
GYM_STORE_PASSWORD=…
GYM_KEY_ALIAS=gym
GYM_KEY_PASSWORD=…
```

Und in `android/app/build.gradle` innerhalb von `android { … }`:

```gradle
signingConfigs {
    release {
        storeFile file(GYM_STORE_FILE)
        storePassword GYM_STORE_PASSWORD
        keyAlias GYM_KEY_ALIAS
        keyPassword GYM_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

## Schritt 6 – Bauen

```bash
cd android
./gradlew assembleRelease
```

Die fertige Datei liegt unter:

```
android/app/build/outputs/apk/release/app-release.apk
```

Das ist die Datei zum Verschicken. Sie ist ein paar Megabyte groß.

## Schritt 7 – Verteilen

Per WhatsApp, Telegram, Drive-Link, E-Mail – die Datei ist die Datei.

Sag dazu, was zu tun ist, sonst hängen alle an derselben Stelle fest:

> Android erlaubt Apps aus dem Store und sonst nichts. Beim Antippen der Datei
> fragt es einmal nach: **„Installieren von unbekannten Apps zulassen"** →
> erlauben → zurück → **Installieren**. Danach ist die Berechtigung nur für die
> App gesetzt, aus der du die Datei geöffnet hast, nicht für alles.

Es kann außerdem eine Warnung von Play Protect kommen („App nicht geprüft") –
das ist normal bei allem, was nicht aus dem Store kommt. **Trotzdem
installieren** antippen.

## Variante B2 – alles eingebaut, ohne Hosting

Nimm den ganzen `server`-Block aus `capacitor.config.ts` wieder heraus. Dann
liegen die Dateien aus `dist/` in der APK.

Der Ablauf für jedes Update ist dann:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

… und die neue APK an alle verschicken. Wichtig: In
`android/app/build.gradle` **vor jedem Update** `versionCode` um eins erhöhen,
sonst weigert sich Android, drüberzuinstallieren.

---

# Weg C — Play Store

Wenn die App auch für Fremde auffindbar sein soll. Der Ablauf steht schon in
[`docs/android-playstore.md`](android-playstore.md): Entwicklerkonto (einmalig
25 $), Bubblewrap oder Capacitor, AAB hochladen, Prüfung abwarten.

Ein Haken für dieses Repo: Die dort beschriebene TWA-Variante braucht eine
Datei unter `/.well-known/assetlinks.json` **im Wurzelverzeichnis der Domain**.
Bei GitHub Pages liegt die App unter `…github.io/Gym-Tracker/`, und die Wurzel
gehört dir nicht. Dafür bräuchtest du eine eigene Domain oder einen Host wie
Cloudflare Pages. Mit der Capacitor-Variante aus Weg B ist das kein Thema.

---

# Weg D — iPhone als echte App

Ehrlich gesagt: Das geht nicht ohne Geld. Apple lässt sich nichts
vorbeischleusen.

- **Apple Developer Program** – 99 $ pro Jahr.
- Dann **TestFlight**: Du lädst eine Fassung hoch, lädst bis zu 100 Leute per
  E-Mail ein, sie installieren die TestFlight-App und darüber deine. Eine
  Fassung läuft 90 Tage, dann muss eine neue hoch.
- Oder ganz in den **App Store**, mit Prüfung durch Apple.

Solange das nicht sein muss: **Weg A ist auf dem iPhone völlig ausreichend.**
Eine über Safari installierte Web-App bekommt ein eigenes Symbol, startet im
Vollbild ohne Adressleiste und läuft offline. Der Unterschied zu einer
Store-App ist an dieser Stelle klein.

---

# Updates – wie neue Fassungen bei allen ankommen

## Was du tust

Genauso wie bisher:

1. Änderungen auf einer Branch, Pull Request, mergen.
2. **Actions** baut und veröffentlicht automatisch – ein bis zwei Minuten.

Das war's. Es gibt keinen zweiten Schritt für die Handys.

## Was auf den Handys passiert

Die App fragt **beim Öffnen und danach stündlich**, ob online etwas Neueres
steht. Findet sie etwas, lädt sie es im Hintergrund und zeigt oben ein Band:

> **Neue Version verfügbar** – Einmal neu laden, dann ist sie da. *[Jetzt laden]*

Erst auf Antippen wird gewechselt. Das ist Absicht: Sonst tauscht die App
mitten im Training die Dateien aus. Wer das Band ignoriert, bekommt die neue
Fassung beim nächsten kompletten Neustart der App.

**Die Trainingsdaten bleiben dabei unangetastet.** Sie liegen im Speicher des
Geräts, nicht in den App-Dateien. Ein Update ändert nie einen Eintrag.

## Wann es welchen Aufwand macht

| Bauart | Was du tun musst | Wann es ankommt |
|---|---|---|
| Weg A (Link) | mergen | beim nächsten Öffnen |
| Weg B1 (Hülle) | mergen | beim nächsten Öffnen |
| Weg B2 (eingebaut) | mergen, APK neu bauen, verschicken | wenn jeder sie installiert hat |
| Weg C (Play Store, TWA) | mergen | beim nächsten Öffnen |
| Weg D (TestFlight) | mergen, hochladen | wenn jeder aktualisiert hat |

Deshalb die Empfehlung für B1: Du baust die APK ein einziges Mal.

## Wenn jemand eine alte Fassung festhält

Kommt vor, wenn der Browser hartnäckig ist:

- **Android/Chrome:** App schließen (aus der Übersicht wischen), neu öffnen.
  Hilft das nicht: Einstellungen → Apps → Chrome → Speicher → *Cache leeren*
  (nicht „Daten löschen" – das wirft die Trainingsdaten weg).
- **iPhone/Safari:** App vom Startbildschirm schließen und neu öffnen. Wenn es
  hakt, Symbol löschen und über Safari neu hinzufügen. **Vorher exportieren**,
  siehe unten.
- **APK (B1):** App schließen und neu öffnen.

## Vor jedem Umzug: exportieren

Unter *Profil → Daten → Exportieren* fällt eine einzelne JSON-Datei heraus.
Die enthält alles außer den Fortschrittsfotos (die bleiben bewusst nur auf dem
Gerät). Auf dem neuen Gerät oder in der neuen Installation über
*Importieren* wieder einlesen.

**Das brauchst du auch beim Wechsel von Weg A auf Weg B:** Die APK hat ihren
eigenen Speicher, getrennt vom Browser. Wer vorher die Web-App benutzt hat,
startet in der APK mit einem leeren Stand. Entweder exportieren und
importieren – oder auf beiden Seiten dasselbe Konto unter *Freunde* benutzen,
dann führt die Synchronisierung die Stände zusammen.

---

# Kurzfassung zum Abhaken

**Heute, zehn Minuten:**

- [ ] Settings → Pages → Source: „GitHub Actions"
- [ ] Einen PR mergen, Actions abwarten
- [ ] `https://jbderleuchtturm.github.io/Gym-Tracker/` auf dem eigenen Handy
      öffnen und zum Startbildschirm hinzufügen
- [ ] Link mit einem Satz Anleitung in die Gruppe schicken

**Wenn danach jemand nach einer „richtigen App" fragt:**

- [ ] Android Studio installieren
- [ ] Weg B, Schritte 1 bis 6 – einmal, dann nie wieder
- [ ] APK verschicken

**Ab dann für immer:**

- [ ] Branch → PR → mergen. Fertig.

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
| Aufwand | ~10 Minuten | ~5 Minuten (baut GitHub) | ~1 Tag (Prüfung) | ~1 Tag |
| Kosten | nichts | nichts | 25 $ einmalig | 99 $ pro Jahr |
| Updates | von selbst | Hinweis in der App, antippen | von selbst | neuer Upload |
| Widgets | ❌ | ✅ | – | ❌ |

> **Empfehlung:** Auf Android Weg B – eine echte App mit Widgets, die nicht an
> der Webseite hängt. Für iPhones und zum schnellen Weitergeben Weg A. Weg C und
> D lohnen sich erst, wenn Fremde die App finden sollen.

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

# Weg B — Die Android-App (mit Widgets)

Eine richtige App: Alle Dateien liegen in der APK, nichts wird aus dem Netz
geladen. Sie startet offline ab der ersten Sekunde und hängt nicht an der
Webseite, an deren Zwischenspeicher oder an Updates mitten im Training. Dazu
kommen drei **Widgets für den Startbildschirm**.

**Gebaut wird sie von GitHub**, nicht auf deinem Rechner: Bei jedem Merge auf
den Hauptzweig baut der Workflow `.github/workflows/android.yml` eine neue,
signierte APK und legt sie unter einem Link ab, der immer gleich bleibt:

> **https://github.com/JBderLeuchtturm/Gym-Tracker/releases/download/app/Gym-Tracker.apk**

## Auf dem Samsung installieren (einmalig, ~5 Minuten)

1. Den Link oben **auf dem Handy** öffnen (Chrome oder Samsung Internet). Die
   Datei `Gym-Tracker.apk` wird heruntergeladen.
2. Unten auf *Öffnen* tippen – oder in *Eigene Dateien → Downloads* auf die
   Datei.
3. Beim ersten Mal fragt Android: *„Aus dieser Quelle installieren?"* →
   **Einstellungen** → *Berechtigung zulassen* einschalten → zurück →
   **Installieren**. (Die Erlaubnis gilt nur für den Browser, über den du
   geladen hast. Du kannst sie danach wieder ausschalten.)
4. Falls **Play Protect** warnt („Unbekannte App"): *Weitere Details* →
   *Trotzdem installieren*. Die Warnung kommt, weil die App nicht aus dem
   Play Store stammt – nicht, weil etwas mit ihr ist.
5. Die App erscheint als **Gym Tracker** mit der gelben Hantel.

### Deine Daten aus der Web-App mitnehmen

Die App hat ihren eigenen Speicher, getrennt vom Browser. Einmal umziehen:

1. In der **Web-App**: *Profil → Einstellungen → Daten & Sicherung → Exportieren*. Es
   öffnet sich eine JSON-Datei zum Speichern.
2. In der **App**: *Profil → Einstellungen → Daten & Sicherung → Importieren* und die
   Datei auswählen.

Oder auf beiden Seiten dasselbe Konto unter *Freunde* benutzen – dann führt
die Synchronisierung die Stände zusammen.

## Widgets auf den Startbildschirm legen

Auf einer freien Stelle des Startbildschirms **lange drücken** → **Widgets** →
**Gym Tracker**. Es gibt drei:

| Widget | Zeigt | Tippen öffnet |
|---|---|---|
| **Heute-Training** | Tagesplan („PUSH"), Sätze 8/20 mit Balken, nächste Übung und Satz – an Ruhetagen den nächsten Trainingstag | die Fokus-Ansicht beim nächsten Satz |
| **Wochenziele** | Tage, Minuten, Volumen und Muskelgruppen als Balken; grün, wenn erreicht | die Trainingsseite |
| **To-dos heute** | bis zu fünf offene Aufgaben mit Kategorie-Farbe, Überfälliges zuerst | den Reiter To-dos |

Alle drei lassen sich in der Größe ziehen (lange drücken → Rahmen) und auf
Samsung auch stapeln (ein Widget auf ein anderes ziehen). Sie folgen dem
hellen oder dunklen Modus des Handys.

**Wie sie aktuell bleiben:** Nach jeder Änderung in der App – Satz abgehakt,
Aufgabe erledigt, Ziel geändert – bekommen die Widgets sofort den neuen Stand.
Die App rechnet dabei die nächsten sieben Tage und die nächste Woche mit
voraus. Deshalb zeigt das Widget am Morgen den richtigen Trainingstag, auch
wenn die App seit gestern Abend zu ist. Zusätzlich zeichnet Android sie etwa
jede halbe Stunde neu.

## Updates

Nach jedem Merge baut GitHub eine neue APK (ein paar Minuten). Die App fragt
beim Start und danach höchstens alle sechs Stunden nach, und zeigt dann oben:

> **Neue Version verfügbar** – Build 12 herunterladen und installieren – deine
> Daten bleiben. *[Herunterladen]*

Antippen lädt die neue APK im Browser. Öffnen, *Aktualisieren*, fertig. Die
Trainingsdaten bleiben, weil jede Fassung mit **demselben Schlüssel** signiert
ist – Android erkennt sie als Update derselben App.

Welche Fassung läuft, steht unter *Profil → Einstellungen → Daten & Sicherung* ganz unten:
*App-Version … · Android-App, Build 12*.

## Was in der App anders ist als im Browser

- **Dateien** (Sicherung, CSV, Kalender, Fotos als ZIP) öffnen den
  **Teilen-Dialog** statt eines Downloads – von dort in *Eigene Dateien*,
  Drive oder eine Nachricht.
- **Die Zurück-Taste** schließt erst Fenster, Fokus-Ansicht und Zirkel, geht
  dann zur Trainingsseite und legt die App dort in den Hintergrund, ohne sie
  zu beenden. Eine laufende Pause geht so nicht verloren.
- **Bildschirm wach halten** und **Vibrieren** laufen über Android selbst.
- **Push-Nachrichten** von Freunden gibt es nur in der Web-App (sie brauchen
  einen Service Worker). Die Erinnerungen beim Öffnen funktionieren.
- **Drucken** gibt es nur im Browser.

## Der Schlüssel

Die APK wird mit `android/keystore/gym-tracker.jks` signiert, das Passwort
steht daneben in `keystore.properties`. **Nicht löschen und nicht ersetzen:**
Mit einem anderen Schlüssel lehnt Android jedes Update ab, und die App müsste
samt Daten deinstalliert werden.

Er liegt bewusst im Repo, damit der Bau ohne Einrichtung läuft. Weil das Repo
öffentlich ist, könnte damit jeder eine APK bauen, die Android als Update
dieser App annimmt. Um dir zu schaden, müsste sie aber jemand auf dein Handy
bringen. Wer das ausschließen will, legt den Schlüssel als GitHub-Secret ab
und nimmt ihn aus dem Repo. Es bleibt derselbe Schlüssel, also gehen keine
Updates verloren.

## Selbst bauen (optional)

Nur nötig, wenn du ohne GitHub bauen willst. Voraussetzungen: Node 22,
JDK 21, Android Studio (bringt das Android SDK mit).

```bash
npm ci
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease -PappBuild=1
# → android/app/build/outputs/apk/release/app-release.apk
```

Mit `npx cap open android` öffnet sich das Projekt in Android Studio. Dort
lässt sich die App auch direkt auf ein per USB angeschlossenes Handy spielen.
Die Widgets stehen unter `android/app/src/main/java/.../widgets`, ihre Daten
rechnet `src/lib/widgetSnapshot.ts`.

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
| Weg B (Android-App) | mergen – GitHub baut die APK | wenn man auf *Herunterladen* tippt |
| Weg C (Play Store, TWA) | mergen | beim nächsten Öffnen |
| Weg D (TestFlight) | mergen, hochladen | wenn jeder aktualisiert hat |

## Wenn jemand eine alte Fassung festhält

Kommt vor, wenn der Browser hartnäckig ist:

- **Android/Chrome:** App schließen (aus der Übersicht wischen), neu öffnen.
  Hilft das nicht: Einstellungen → Apps → Chrome → Speicher → *Cache leeren*
  (nicht „Daten löschen" – das wirft die Trainingsdaten weg).
- **iPhone/Safari:** App vom Startbildschirm schließen und neu öffnen. Wenn es
  hakt, Symbol löschen und über Safari neu hinzufügen. **Vorher exportieren**,
  siehe unten.
- **Android-App (Weg B):** Keine Zwischenspeicher-Probleme – die Dateien
  liegen in der APK. Unter *Profil → Einstellungen → Daten & Sicherung* steht der Build.

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

**Für die Android-App mit Widgets:**

- [ ] Nach dem Merge auf *Actions → Android-App* warten (ein paar Minuten)
- [ ] Den APK-Link auf dem Handy öffnen und installieren
- [ ] In der Web-App exportieren, in der App importieren
- [ ] Widgets auf den Startbildschirm ziehen

**Ab dann für immer:**

- [ ] Branch → PR → mergen. Fertig.

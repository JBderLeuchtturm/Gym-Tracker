# Gym Tracker

Ein persönlicher Trainingstracker als Website – funktioniert im Browser am Rechner
genauso wie auf dem Handy, wo sie sich als App auf den Startbildschirm legen lässt.

## Was drin ist

**Wochenpläne**
Beliebig viele Pläne anlegen, benennen und jederzeit zwischen ihnen wechseln.
Jeder Wochentag bekommt einen Namen (z. B. „Push"), Übungen mit Zielvorgaben
(Sätze, Wiederholungsbereich, Zielgewicht, Pausenzeit) und lässt sich auf andere
Tage kopieren. Fünf fertige Vorlagen sind dabei: Push/Pull/Legs, Oberkörper/
Unterkörper, Ganzkörper, 5er-Split und ein reines Körpergewichts-Programm.

**Training aufzeichnen**
Die Startseite zeigt genau die Übungen, die laut aktivem Plan heute anstehen.
Jeder Satz wird mit Gewicht, Wiederholungen und optional RPE eingetragen und
abgehakt; Aufwärmsätze lassen sich markieren und zählen nicht ins Volumen.
Zwischen den Sätzen läuft auf Wunsch ein Pausen-Timer. Spontane Zusatzübungen
gehen jederzeit, auch an Ruhetagen.

**Letzte Leistungen direkt an der Übung**
Unter jeder Übung steht, was beim letzten Mal lief – Datum, Gewichte, Wiederholungen,
geschätztes 1RM und die Veränderung des Volumens gegenüber der Einheit davor.
Neue Sätze sind mit den Werten vom letzten Mal vorbelegt, du korrigierst nur noch.

**Fortschritt**
Volumen und Sätze je Woche, Verteilung auf die Muskelgruppen, Körpergewichtsverlauf
und für jede einzelne Übung ein Verlaufsdiagramm – wahlweise nach geschätztem 1RM,
bestem Gewicht, Volumen, Wiederholungen oder Zeit. Dazu persönliche Bestleistungen
und eine Tabelle der letzten Einheiten.

**Kalorienverbrauch**
Aus den Profildaten wird der Grundumsatz berechnet, daraus der Alltagsumsatz, und
das Training kommt über MET-Werte je Übung obendrauf. Die Zufuhr kann von Hand,
per Yazio-CSV-Export oder über eine eigene Bridge dazukommen (siehe unten).

**Übungssuche mit vielen Vorschlägen**
Über 200 Übungen sind fest eingebaut – deutsch und englisch benannt, mit Muskeln,
Geräten, Synonymen und MET-Wert. Gesucht wird über all diese Felder gleichzeitig,
inklusive Tippfehlertoleranz: „latissimus", „kurzhantel", „bench", „bd" oder
„kniebeuge" führen alle zum Ziel. Zusätzlich wird live die freie
[wger-Datenbank](https://wger.de) abgefragt (kostenlos, ohne Konto, ohne API-Key),
die noch einmal mehrere tausend Übungen beisteuert. Findest du trotzdem nichts,
legst du die Übung in zehn Sekunden selbst an.

## Sprache

Die App erscheint auf Deutsch oder Englisch – beim ersten Start richtet sie sich
nach der Spracheinstellung des Geräts, umstellen lässt sich das jederzeit unter
*Profil → Einstellungen → Sprache*. Übungsnamen aus dem eingebauten Katalog
erscheinen auf Englisch, wo eine englische Bezeichnung hinterlegt ist.

Übersetzt wird über den deutschen Text als Schlüssel: `t('Sätze')` liefert auf
Englisch „Sets" und sonst den deutschen Text. Eine fehlende Übersetzung führt
damit nie zu einer leeren Stelle. Die Wörterbuchdatei ist
[`src/i18n/en.ts`](src/i18n/en.ts).

## Tests

```bash
npm run build && npm test        # alle Läufe
npm test training                # nur einen Lauf
```

Acht Läufe im echten Browser decken Grundbedienung, Trainingsfunktionen,
Übungssuche ohne Netz, Layout auf schmalen Geräten, Mehrsprachigkeit, Freunde
und Freigaben, Gruppen und Challenges sowie Einladungslinks ab. Die Läufe mit
Konto arbeiten gegen ein nachgebautes Supabase unter
[`tests/mockBackend.mjs`](tests/mockBackend.mjs) und fassen das echte Projekt
nie an. Bei jedem Push und Pull Request laufen sie zusätzlich in GitHub Actions.

## Loslegen

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:5173
npm run build    # Produktionsbuild nach dist/
npm run preview  # Build lokal ansehen
```

Getestet mit Node 20+.

## Ins Netz stellen

Die App ist eine reine Statik-Seite ohne Server – `dist/` kann überall liegen.

Mit **GitHub Pages** passiert das automatisch: Der Workflow unter
`.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf die
Default-Branch des Repos. Einmalig musst du dafür unter *Settings → Pages →
Source* den Eintrag **„GitHub Actions"** auswählen. Danach ist die App unter
`https://<benutzername>.github.io/Gym-Tracker/` erreichbar.

Wird die Branch später umbenannt oder auf `main` gemerged, muss die Liste unter
`on.push.branches` im Workflow entsprechend angepasst werden – `main` ist dort
bereits eingetragen.

Der Build verwendet relative Pfade, funktioniert also auch in jedem Unterordner
oder bei Netlify, Vercel und Co.

## Aufs Handy holen

Im Browser die Seite öffnen und „Zum Startbildschirm hinzufügen" wählen
(Safari: Teilen-Menü, Chrome: Drei-Punkte-Menü). Danach startet der Tracker im
Vollbild wie eine normale App und funktioniert dank Service Worker auch ohne
Internet – nur die Online-Übungssuche braucht dann eine Verbindung.

## Freunde und Synchronisierung

Ohne Einrichtung läuft alles rein lokal auf dem Gerät – so wie oben beschrieben.
Wer Trainings mit Freunden teilen oder mehrere Geräte abgleichen will, hängt ein
kostenloses **Supabase**-Projekt an. Das ist einmalig eingerichtet und gilt dann
für alle, die deinen Link benutzen.

### Einrichten (etwa fünf Minuten)

1. Auf [supabase.com](https://supabase.com) anmelden und ein neues Projekt
   anlegen. Der kostenlose Tarif reicht dafür aus und verlangt keine Zahlungsdaten.
2. Im Projekt den **SQL Editor** öffnen, den gesamten Inhalt von
   [`supabase/schema.sql`](supabase/schema.sql) einfügen und ausführen. Das legt
   die Tabellen an und schaltet die Zugriffsregeln scharf. Das Skript kann
   gefahrlos mehrfach laufen.
3. Unter **Project Settings → API** die *Project URL* und den *anon public*-Key
   kopieren.
4. Beides in [`public/sync-config.json`](public/sync-config.json) eintragen und
   committen. Der Deploy-Workflow veröffentlicht die Änderung automatisch.

```json
{
  "url": "https://abcdefgh.supabase.co",
  "anonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
}
```

Der `anon`-Key gehört in den Quelltext – er ist dafür gedacht, öffentlich zu
sein. Geschützt werden die Daten nicht durch den Schlüssel, sondern durch die
Zeilenregeln (Row Level Security) aus dem Schema: Ohne gültige Anmeldung kommt
niemand an Daten, und angemeldete Konten sehen ausschließlich das, was ihnen
ausdrücklich freigegeben wurde. Den *service_role*-Key darfst du dagegen
**niemals** eintragen – der umgeht alle Regeln.

**Optional, aber bequem:** In Supabase unter *Authentication → Sign In / Providers
→ Email* die Bestätigungs-Mail abschalten, dann können sich Freunde ohne den
Umweg über den Posteingang anmelden.

**Zwei Dinge zum kostenlosen Tarif:** Projekte, die etwa eine Woche lang gar nicht
benutzt werden, legt Supabase schlafen – ein Klick im Dashboard weckt sie wieder.
Und wer regelmäßig trainiert, hält das Projekt ohnehin wach. Das Speicherlimit ist
für diese App kein Thema: Ein Jahr Training liegt im niedrigen einstelligen
Megabyte-Bereich.

### Wie es sich benutzt

**Deine Freunde richten nichts ein.** Das Supabase-Projekt legst nur du an,
einmal. Alle anderen öffnen bloß den Link und legen ein Konto mit E-Mail und
Passwort an; einen Benutzernamen wie `jan-4f2a` bekommen sie automatisch und
können ihn ändern.

Am bequemsten geht es über *Freunde → Einladung teilen*. Das erzeugt einen Link
mit deinem Benutzernamen daran (`…/#add=jan-4f2a`). Wer ihn öffnet, landet direkt
auf der Freunde-Seite, sieht wer ihn eingeladen hat, legt ein Konto an – und die
Freundschaftsanfrage geht von selbst bei dir raus. Nichts abtippen, nichts
suchen. Der Anhang verschwindet danach wieder aus der Adresszeile, und eine
Einladung wird nur ein einziges Mal eingelöst.

Wer lieber von Hand sucht, gibt unter *Freund hinzufügen* einfach den
Benutzernamen ein.

**Was andere sehen, entscheidest du pro Freund.** Bei jedem Freund gibt es drei
Schalter unter „Was ich zeige":

| Bereich | Inhalt | Standard |
| --- | --- | --- |
| Fortschritt | Trainings, Sätze, Volumen, Bestleistungen je Übung | an |
| Körpergewicht | Der Gewichtsverlauf | aus |
| Kalorien | Verbrauch und Zufuhr je Tag | aus |

Alles andere bleibt grundsätzlich privat: Trainingsnotizen, Pläne, Profildaten
wie Größe und Geburtsdatum werden nie geteilt. Geteilt werden auch nicht die
Rohdaten, sondern fertige Auswertungen. Nimmst du eine Freigabe zurück oder
beendest die Freundschaft, ist der Zugriff sofort weg.

Im Detail eines Freundes gibt es außerdem einen **Vergleich** der Übungen, die
ihr beide trainiert, und auf der Übersicht eine **Bestenliste** über alle
verbundenen Konten.

### Mehrere Geräte

Sobald du angemeldet bist, gleicht sich der Trainingsstand automatisch ab –
kurz nach jeder Änderung, beim Zurückkehren zur App und im Hintergrund.
Treffen zwei Stände aufeinander (etwa Handy und Rechner), werden sie
zusammengeführt statt überschrieben: Trainings, Pläne und Einträge aus beiden
Richtungen bleiben erhalten, und bei demselben Eintrag gewinnt der jüngere.

## Wo die Daten liegen

Ohne eingerichtete Synchronisierung bleibt alles auf deinem Gerät, im
`localStorage` des Browsers – kein Server, kein Konto, keine Übertragung an
Dritte. Mit Synchronisierung liegt zusätzlich eine Kopie in deinem eigenen
Supabase-Projekt; das Gerät bleibt trotzdem die Arbeitsgrundlage, die App
funktioniert also auch offline weiter. Die Daten überstehen das
Schließen des Browsers und Neustarts des Geräts; die App fordert zusätzlich
dauerhaften Speicher an (`navigator.storage.persist()`), damit mobile Browser
sie nicht bei Speicherdruck wegräumen.

Zwei Dinge folgen daraus:

* **Gerätewechsel** geht über *Profil → Daten → Exportieren* und auf dem neuen
  Gerät *Importieren*. Die Sicherung ist eine einzelne JSON-Datei.
* **Browserdaten löschen** löscht auch den Tracker. Ein gelegentlicher Export
  ist deshalb eine gute Angewohnheit.

Beim Laden werden gespeicherte Stände auf das aktuelle Schema migriert und
fehlende Felder ergänzt – ältere Sicherungen bleiben also nutzbar. Zusätzlich
wird regelmäßig eine zweite Kopie als Fallback abgelegt, falls ein Stand einmal
beschädigt ankommt.

## Wie der Kalorienverbrauch berechnet wird

1. **Grundumsatz** nach Mifflin-St Jeor aus Gewicht, Größe, Alter und Geschlecht.
   Ist im Profil ein Körperfettanteil hinterlegt, wird stattdessen Katch-McArdle
   verwendet, das auf der fettfreien Masse basiert und dann genauer ist.
2. **Alltagsumsatz (TDEE)** = Grundumsatz × Aktivitätsfaktor (1,2 bis 1,9).
   Die Stufe im Profil meint den Alltag **ohne** Training.
3. **Training** über MET-Werte: `kcal = MET × 3,5 × Körpergewicht ÷ 200 × Minuten`.
   Jede Übung hat einen eigenen MET-Wert. Ohne eingetragene Trainingsdauer wird
   die aktive Zeit aus Sätzen, Wiederholungen und Pausen geschätzt; trägst du
   eine gemessene Dauer ein, wird die Schätzung proportional darauf skaliert.
4. **Empfehlung** = Gesamtverbrauch plus Zielkorrektur (−500 kcal beim Abnehmen,
   +300 kcal beim Aufbauen).

Das sind Schätzungen, keine Messwerte. Aussagekräftig wird es dadurch, dass
dieselbe Methode über Wochen angewendet wird und du die Entwicklung beobachtest.

## Yazio

Yazio bietet **keine offizielle öffentliche Schnittstelle** an – eine direkte
Anmeldung mit deinem Yazio-Konto ist von einer Website aus also nicht möglich.
Deshalb gibt es zwei Wege, die unter *Kalorien → Yazio* zu finden sind:

**1. CSV-Import (funktioniert sofort)**
In der Yazio-App unter *Profil → Einstellungen → Konto → Daten exportieren* eine
Datei anfordern und hier hochladen. Kalorien und Makros werden je Tag summiert
und in den Verlauf übernommen. Der Import erkennt deutsche und englische
Spaltenüberschriften sowie Komma- und Semikolon-getrennte Dateien.

**2. Eigene Bridge (für alle, die einen kleinen Dienst betreiben wollen)**
Läuft irgendwo ein Programm, das sich bei Yazio anmeldet, kann die App es
abfragen. Erwartet wird:

```
GET {Adresse}/daily?date=2026-09-03
Authorization: Bearer {Token}       # optional

{ "date": "2026-09-03", "energy": 2140, "protein": 155, "carb": 210, "fat": 70 }
```

Alternative Feldnamen (`kcal`, `calories`, `carbs`, …) werden ebenfalls erkannt.
Die Bridge muss CORS für die Adresse der App erlauben.

Ohne beides trägst du die Kalorien einfach von Hand ein – der berechnete
Verbrauch, die Bilanz und alle Diagramme funktionieren dann genauso.

## Projektstruktur

```
src/
├── api/           wger-Übungsdatenbank, Yazio (Bridge + CSV)
├── sync/          Konto, Freunde, Freigaben, Einladungslinks, Zusammenführen
├── components/    UI-Bausteine, Übungssuche, Detailansicht, Diagramme
├── data/          Übungskatalog (216 Einträge) und Planvorlagen
├── lib/           Datum, Suche, Kalorien- und Statistikberechnung
├── pages/         Heute, Pläne, Fortschritt, Kalorien, Freunde, Profil, Verlauf
├── storage/       Speicherung, Migration, globaler Zustand
└── types.ts       Datenmodell
```

Dazu `supabase/schema.sql` – das Datenbankschema samt Zugriffsregeln.

Abhängigkeiten sind nur React und der Supabase-Client; Diagramme, Icons und
Suche sind selbst geschrieben, damit die App klein und offline-fähig bleibt.
Der Supabase-Client wird erst nachgeladen, wenn die Synchronisierung wirklich
eingerichtet ist – ohne sie lädt die App nichts davon.

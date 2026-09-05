# Änderungen

Alle nennenswerten Änderungen an diesem Projekt, neueste zuerst.

## Die neun Schwächen aus der dritten Ideensammlung

*Branch `claude/schwaechen`*

Setzt alle Punkte aus dem Abschnitt „Schwächen" in
[#13](https://github.com/JBderLeuchtturm/Gym-Tracker/issues/13) um.

- **Diagramme mit ein oder zwei Messpunkten** sahen kaputt aus. Unter drei
  Punkten stehen jetzt die Zahlen im Klartext und ein Satz, ab wann gezeichnet
  wird. Dasselbe gilt für die Verteilung nach Muskelgruppe: mit nur einer
  Gruppe wäre der Balken immer voll.
- **Die letzte Kennzahl stand allein in einer Zeile.** Bei ungerader Anzahl
  nimmt sie auf schmalen Geräten jetzt die ganze Breite ein.
- **Datumsfelder zeigten `mm/dd/yyyy`**, wenn der Browser englisch eingestellt
  ist. Das native Feld bleibt – ein eigener Kalender wäre schlechter als der
  des Systems –, aber daneben steht das gelesene Datum im Klartext.
- **Rückgängig für alles Gelöschte.** Übung, Training, Satz, Plan,
  Gewichtseintrag, Körpermaße, eigene Übung und Foto lassen sich sieben
  Sekunden lang zurückholen. Fotos liegen in IndexedDB, deshalb wird dort das
  Bild selbst festgehalten.
- **Das Datum eines Trainings lässt sich ändern.** Liegt am Zieltag schon
  etwas, sagt der Dialog das vorher, statt still zusammenzuführen.
- **Fotos kommen jetzt aus der App heraus** – gebündelt als ZIP. Beim Export
  steht außerdem, dass sie im Backup nicht enthalten sind.
- **Einstellungen und Profil haben einen eigenen Zeitstempel.** Vorher gewann
  beim Abgleich pauschal die Seite, die zuletzt irgendetwas getan hat.
- **Bremse gegen das Zuschütten mit Freundschaftsanfragen** – dreißig pro
  Stunde, durchgesetzt in der Datenbank, nicht im Browser.
- **Querformat.** Auf breiten, flachen Bildschirmen wandert die Navigation an
  den linken Rand, statt unten sechzig Pixel Höhe zu fressen.

**Technik**
- Kleiner eigener ZIP-Schreiber (`src/lib/zip.ts`), gegen einen echten
  Entpacker geprüft – eine Bibliothek dafür wären einige zehn Kilobyte in einer
  App, die offline starten soll
- Elfter Testlauf `tests/robust.mjs`

## Oberfläche von Hand nachgezogen

*Branch `claude/ui-handarbeit`*

Leitbild: ein Trainingsbuch, keine Software-Oberfläche. Was zählt, sind Namen
und Zahlen — alles andere tritt zurück.

**Farben und Flächen**
- Warme Graustufen statt kühlem Blau-Violett, ein Messing-Akzent statt einer
  Palette. Das helle Thema ist jetzt Papier, kein Weiß.
- Hintergrundverläufe, Glanzkanten und Schlagschatten entfernt
- Radien von 16 auf 8 Pixel, Knöpfe ohne Verlauf und Schein
- Muskelgruppen-Farben gedämpft

**Emoji raus, wo sie Dekoration waren**
- Die Kategorie-Emoji (eine Lunge für Brust, ein Rückwärts-Pfeil für Rücken)
  sind durch den Namen der Muskelgruppe in ihrer Farbe ersetzt
- Leere Zustände ohne Symbol, Bestenlisten mit Platzziffer statt Medaille
- Nutzer-Emoji bleiben: Profilbild, Gruppenzeichen und Reaktionen sind Inhalt

**Dichte und Rangfolge**
- Der Donut mit Prozentzahl ist drei Zahlen nebeneinander und einem dünnen
  Balken gewichen
- Der Zähler an der Übung zeigt einen Bruch statt eines kleinen Rings
- Sieben gleichwertige Knöpfe je Übung sind auf drei geschrumpft
- Kennzahlen ohne Kasten: Beschriftung, Linie, Zahl

**Behoben**
- Der Tagesstreifen war im hellen Thema praktisch unsichtbar
- Der Trainingskalender hatte keine Orientierung – jetzt mit Monatsmarken
- Haken und Schieber folgten dem Browser-Blau statt dem Akzent
- Zwei Bedienelemente hießen für Screenreader gleich

## Zweite Runde aus der Ideensammlung

*Branch `claude/zweite-runde`*

Setzt alles aus der zweiten Runde in [#3](https://github.com/JBderLeuchtturm/Gym-Tracker/issues/3)
um – außer den Anbindungen an Strava und Health.

**Behoben**
- Der Trainingsverbrauch wurde gegen eine unmögliche Trainingsdauer gerechnet.
  Wer die Stoppuhr versehentlich kurz laufen ließ, hatte danach eine Dauer von
  einer Minute stehen – aus zwölf Sätzen wurden neun Kilokalorien. Eine
  gemessene Dauer muss jetzt mindestens so lang sein wie die reine Hebezeit;
  sonst zählt die Schätzung, und im Training steht ein Hinweis darauf.

**Pläne**
- Einen Tag auf beliebig viele Wochentage gleichzeitig kopieren
- Mehrwöchige Zyklen mit Steigerung je Woche und Entlastungswoche
- Steigerung je Übung für die doppelte Progression
- Pläne als Textbaustein weitergeben und einlesen – ohne Server, ohne Konto

**Training**
- Ersatzübung mit denselben Zielmuskeln; eingetragene Sätze bleiben stehen
- Countdown für Halteübungen mit Signalton
- Notiz je Satz
- Sätze des Trainingspartners – im Training sichtbar, aus der eigenen
  Auswertung heraus

**Auswertung**
- Wochenziel je Muskelgruppe als Ampel auf der Körperkarte
- „Diese Woche fehlt noch“ und „lange nicht dran“ im Klartext
- Trainingskalender über 27 Wochen
- Hochrechnung je Übung aufs nächste runde Ziel, mit Angabe der Streuung
- Export als CSV (Sätze, Trainings, Körperdaten) und druckbarer Bericht

**Körper**
- Umfänge mit Verlauf je Maß
- Fortschrittsfotos, zwei nebeneinander vergleichbar; bleiben auf dem Gerät

**Freunde**
- Wochenrückblick über alle Freigaben, eigene Zahlen daneben
- Echte Push-Nachrichten über VAPID und eine Supabase Edge Function;
  bewusst ohne Nutzlast, damit beim Push-Dienst keine Trainingsdaten liegen

**Profil**
- Wochenziele je Muskelgruppe, Geräteprofil, Trainingspartner, Signalton

**Technik**
- Zehnter Testlauf `tests/features.mjs`
- Neue Tabelle `push_subscriptions` in `supabase/schema.sql`

## Muskelkarte, Passwort vergessen, App-Updates

*Branch `claude/muskelkarte`*

**Muskelkarte**
- Selbst gezeichnete Körperkarte von vorne und hinten (SVG, keine fremden
  Abbildungen)
- In den Übungsdetails: kräftig eingefärbt sind die Zielmuskeln, blass die
  unterstützenden
- Im Training: welche Muskeln der heutige Tag abdeckt – kräftig, was schon
  abgehakt ist
- In der Übungssuche: eine Region antippen und passende Übungen vorgeschlagen
  bekommen, Zielmuskel zuerst
- In der Auswertung: Belastungskarte über den gewählten Zeitraum, sekundäre
  Muskeln zählen halb; ein Tipp auf eine Region zeigt, woher die Sätze kommen,
  und schlägt bei Lücken Übungen vor; darunter steht, was gar nicht drankam

**Anmeldung**
- „Passwort vergessen“ schickt einen Link per E-Mail; darüber lässt sich direkt
  in der App ein neues Passwort setzen

**App-Updates**
- Die installierte App lädt neue Versionen selbst und meldet sich mit einem
  Balken „Neue Version verfügbar“; erst ein Tipp darauf schaltet um, damit
  mitten im Satz nichts wegspringt
- Im Profil steht, welcher Stand gerade läuft

**Robustheit**
- Fehlen auf dem Server neuere Tabellen, erscheint statt einer roten Fehlermeldung
  ein Hinweis, dass `supabase/schema.sql` erneut ausgeführt werden muss
- „Beinbizeps" wurde bei der Muskelzuordnung als Armbizeps gewertet – behoben
- Neunter Testlauf `tests/muscles.mjs` für Karte, Zuordnung und Vorschläge

## Ausbau nach der Ideensammlung

*Branch `claude/ausbau`*

Setzt die Ideensammlung aus [#3](https://github.com/JBderLeuchtturm/Gym-Tracker/issues/3)
um – alles außer dem Abschnitt Ernährung.

**Training**
- Übungen je Tag umsortieren; die Reihenfolge bleibt erhalten
- Supersätze: zwei benachbarte Übungen koppeln, Pause erst nach der letzten
- Aufwärmsätze auf Knopfdruck aus dem Arbeitsgewicht
- Gewichtsvorschlag aus der letzten Einheit, per Antippen übernehmbar
- Trainingsdauer per Start/Stopp statt Eintippen
- Ein Satz, der einen Bestwert schlägt, wird gefeiert

**Auswertung**
- Rückblick: Zeitraum gegen den gleich langen davor, samt Bestleistungen
- Gestapeltes Diagramm der Muskelgruppen über die Wochen

**Freunde**
- Aktivitätsliste mit Reaktionen und Kommentaren
- Gruppen mit Beitrittscode und gegenseitiger Fortschritts-Freigabe
- Challenges über einen Zeitraum, nach Trainings, Sätzen oder Volumen
- Benachrichtigung, wenn ein Freund trainiert hat (ohne Server, solange die
  App offen ist)

**Technik**
- Acht Browser-Testläufe unter `tests/`, per `npm test`, zusätzlich in CI
- Übungsbilder von wger bleiben offline verfügbar
- Deutsch und Englisch, Umschaltung im Profil

**Design**
- Zweiter Durchgang: Farbverläufe im Hintergrund, plastischere Karten,
  größere Typografie, Übungskarten mit Symbolkachel und Fortschrittsring

## Optischer Feinschliff

*Branch `claude/ui-feinschliff` · [PR #1](https://github.com/JBderLeuchtturm/Gym-Tracker/pull/1)*

Rein optisch – Logik, Datenstruktur und Datenbankregeln blieben unangetastet.

**Neu**
- Farbsystem mit festen Tönen für elf Muskelgruppen, konsequent verwendet in
  Übungskarten, Suche, Filtern, Auswertungen, Plan-Wochenstreifen und der
  Freundeansicht
- Tagesübersicht als Hero-Karte mit Fortschrittsring statt drei grauer Kästen

**Geändert**
- Abgehakte Sätze und vollständig erledigte Übungen sind jetzt sichtbar markiert
- Aktiver Reiter mit Indikatorstreifen, Pausenuhr mit ablaufendem Balken
- Tiefere Flächenstaffelung, weichere Schatten, größere Radien, Verlauf in der
  Kopfzeile
- Namen in Trefferlisten werden gekürzt statt umgebrochen
- Fokus-Ringe für Tastaturbedienung

## Einladungslinks

Freunde müssen nichts mehr abtippen.

**Neu**
- „Einladung teilen" erzeugt einen Link mit dem eigenen Benutzernamen
  (`…/#add=jan-4f2a`)
- Wer ihn öffnet, landet direkt bei den Freunden und sieht, von wem die
  Einladung kommt; nach dem Anlegen des Kontos geht die Anfrage automatisch raus
- Die Einladung überlebt eine Bestätigungsmail und wird genau einmal eingelöst

**Behoben**
- Der Anhang wurde in der Adresszeile stehen gelassen und wanderte beim Teilen
  erneut mit

## Freunde, Freigaben und Geräteabgleich

Optionale Anbindung an ein eigenes Supabase-Projekt. Ohne Zugangsdaten läuft
alles unverändert rein lokal.

**Neu**
- Konto mit E-Mail und Passwort, automatisch vergebener Benutzername
- Freundschaftsanfragen, annehmen, ablehnen, beenden
- Sichtbarkeit **pro Freund** in drei Bereichen: Fortschritt (Standard an),
  Körpergewicht und Kalorien (Standard aus)
- Vergleich gemeinsam trainierter Übungen, Bestenliste über alle Freunde
- Abgleich zwischen mehreren Geräten mit echtem Zusammenführen statt
  Überschreiben
- Datenbankschema mit Zeilenregeln (`supabase/schema.sql`)

**Sicherheit**
- Freigaben werden in der Datenbank durchgesetzt, nicht in der Oberfläche
- Profile sind nur für Verbundene sichtbar; die Suche läuft über eine Funktion
  mit exaktem Treffer statt über eine durchblätterbare Nutzerliste
- Ein Trigger friert die Beteiligten einer Freundschaft ein – ohne ihn ließe
  sich beim Annehmen der Absender austauschen und so eine Verbindung zu einem
  Dritten erzwingen
- Hilfsfunktionen mit erhöhten Rechten sind nur für angemeldete Konten
  ausführbar und haben einen festen `search_path`

**Behoben**
- Ein frisch installiertes Gerät brachte seinen eigenen Startplan mit und
  verdoppelte ihn beim Zusammenführen

## Erste Fassung

Vollständiger Trainingstracker als statische Website, auf dem Handy als App
installierbar.

**Neu**
- Beliebig viele Wochenpläne mit Zielvorgaben je Übung, fünf fertige Vorlagen
- Tagesansicht mit den Übungen des aktiven Plans, Satz-Logging mit Gewicht,
  Wiederholungen und RPE, Pausen-Timer
- Letzte Leistung direkt an der Übung, neue Sätze damit vorbelegt
- Auswertungen: Volumen und Sätze je Woche, Verteilung nach Muskelgruppe,
  Gewichtsverlauf, Verlaufsdiagramm und Bestleistungen je Übung
- Übungssuche über 216 eingebaute Einträge plus die freie wger-Datenbank,
  mit Tippfehlertoleranz und eigenen Übungen
- Kalorienverbrauch aus Profildaten (Mifflin-St Jeor bzw. Katch-McArdle) plus
  Training über MET-Werte; Zufuhr manuell, per Yazio-CSV oder eigener Bridge
- Speicherung auf dem Gerät mit Schema-Migration, Export und Import
- PWA mit Service Worker, heller und dunkler Modus, Deploy über GitHub Pages

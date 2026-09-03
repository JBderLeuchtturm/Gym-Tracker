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
`.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `main`.
Einmalig musst du dafür unter *Settings → Pages → Source* den Eintrag
**„GitHub Actions"** auswählen. Danach ist die App unter
`https://<benutzername>.github.io/Gym-Tracker/` erreichbar.

Der Build verwendet relative Pfade, funktioniert also auch in jedem Unterordner
oder bei Netlify, Vercel und Co.

## Aufs Handy holen

Im Browser die Seite öffnen und „Zum Startbildschirm hinzufügen" wählen
(Safari: Teilen-Menü, Chrome: Drei-Punkte-Menü). Danach startet der Tracker im
Vollbild wie eine normale App und funktioniert dank Service Worker auch ohne
Internet – nur die Online-Übungssuche braucht dann eine Verbindung.

## Wo die Daten liegen

Alles bleibt auf deinem Gerät, im `localStorage` des Browsers. Es gibt keinen
Server, kein Konto und keine Übertragung an Dritte. Die Daten überstehen das
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
├── components/    UI-Bausteine, Übungssuche, Detailansicht, Diagramme
├── data/          Übungskatalog (216 Einträge) und Planvorlagen
├── lib/           Datum, Suche, Kalorien- und Statistikberechnung
├── pages/         Heute, Pläne, Fortschritt, Kalorien, Profil, Verlauf
├── storage/       Speicherung, Migration, globaler Zustand
└── types.ts       Datenmodell
```

Keine Laufzeit-Abhängigkeiten außer React – Diagramme, Icons und Suche sind
selbst geschrieben, damit die App klein und offline-fähig bleibt.

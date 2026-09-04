# Änderungen

Alle nennenswerten Änderungen an diesem Projekt, neueste zuerst.

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

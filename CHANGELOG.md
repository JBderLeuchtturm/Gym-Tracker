# Änderungen

Alle nennenswerten Änderungen an diesem Projekt, neueste zuerst.

## Feste Leisten, aufgeräumte Abstände, ein Rang zum Weitermachen

*Branch `claude/layout-fixes`*

**Die untere Leiste bleibt stehen.** Die App ist jetzt eine Hülle in
Bildschirmgröße statt eines langen Dokuments: Kopfzeile und Reiterleiste sind
eigene Zeilen eines Rasters, gescrollt wird nur der Bereich dazwischen. Vorher
lag die Reiterleiste als fest positioniertes Band über der Seite – und
verschwand aus dem Bild, sobald der Browser den Ausschnitt verschob.

**Nichts ragt mehr heraus.** Zwei echte Überläufe gefunden und behoben:

- Die Knopfreihe an der Übungskarte („Satz · Pause · Rechner · Mehr") passte auf
  schmalen Geräten nie in eine Zeile – „Mehr" stand halb außerhalb der Karte.
  Sie bricht jetzt um.
- Die fünf Stufennamen unter dem Rangbalken lagen in einem starren
  Fünfer-Raster; „Fortgeschritten" passte dort nicht und lief in „Stark" hinein.
  Jetzt sind es umbrechende Marken.

Herauszoomen unter die eigene Breite ist gesperrt (`minimum-scale=1`). Ohne das
lässt Chrome auf ein Viertel verkleinern – dann steht die App klein in der Ecke,
lässt sich seitlich verschieben, und die Leisten rutschen aus dem Bild.
Hineinzoomen bleibt möglich; wer schlecht sieht, braucht das.

**Abstände.** Der Fund dahinter: `.split__main` bekam seinen Abstand nur in der
Breitbild-Regel. Unterhalb von 900 Pixeln – also auf jedem Handy – standen die
Abschnitte auf „Fortschritt" und „Heute" ohne einen einzigen Pixel Luft
aufeinander. Der Abstand liegt jetzt in einer Zahl (`--gap-section`) und gilt
überall. Dazu ein Stil für Aufklapper, die bündig unter ihrer Überschrift stehen
sollen, statt um ihre eigene Polsterung eingerückt.

**Der Rang zieht jetzt.** Die nackte Zahl blieb: „35 von 100" ist wahr und
entmutigend zugleich. Dazugekommen ist alles, was daraus einen nächsten Schritt
macht:

- **Fortschritt durch die aktuelle Stufe** statt zur fernen Hundert – ein
  Balken, der bei jeder Stufe wieder bei null anfängt.
- **Der nächste Schritt** als eigener Kasten: die Bewegung mit dem kleinsten
  Abstand zur nächsten Stufe, in Kilogramm, mit dem, was sie im Gesamtrang
  bringt. Bewegungen ohne jeden Eintrag stehen davor – dort ist der erste Satz
  der größte Sprung, den es im System gibt.
- **Acht Abzeichen**: erster Rang, alle sechs gewertet, Bank auf Körpergewicht,
  Kniebeuge 1,5×, Kreuzheben 2×, Club der 1000, überall „Stark", zehn Wochen am
  Stück. Bei allem Offenen steht der Anteil dabei. Abgeleitet, nicht
  gespeichert – dieselbe Regel wie bei den Zielen.
- **Auf- und Abstieg** werden einmal gemeldet, wenn sich die Stufe seit dem
  letzten Besuch geändert hat.
- **Der Rang über die Zeit** als Kurve, jeweils mit dem Verlauf gerechnet, der
  damals vorlag.

**Tests.** Die alte Überlaufprüfung maß `scrollWidth` am Dokument – die konnte
seit der neuen Hülle gar nicht mehr anschlagen. Sie fragt jetzt jedes sichtbare
Element, ob es über den Rand steht, und lässt nur ausdrückliche Querscroller
durch. Dazu je Seite eine Prüfung, dass die Leisten beim Scrollen stehen
bleiben, eine auf das Viewport-Meta, vier neue Prüfungen im Rangfeld (nächster
Schritt, überlappungsfreie Stufenleiste, Abzeichen, Verlaufskurve) und acht
neue ohne Browser für Stufenfortschritt, nächsten Schritt, Abzeichen und
Rangverlauf.

## Ränge, Ausgelassenes und eine schlanke Kalorienseite

*Branch `claude/raenge-und-skip`*

**Die Kalorienseite zeigt beim Öffnen nur noch das Nötigste.** Eingetragen
werden zuerst Kalorien und Eiweiß; Kohlenhydrate, Fett, Yazio, „Als Mahlzeit
speichern" und der Verlauf der letzten 30 Tage liegen hinter *Mehr*. Dafür steht
der **geschätzte Verbrauch je Übung** jetzt offen auf der Seite statt in einem
Aufklapper – mit einer Zeile *Training gesamt* darunter. Das ist die Zahl,
wegen der man an einem Trainingstag überhaupt hierher kommt.

**Übungen und einzelne Sätze lassen sich auslassen, nicht nur löschen.**

- *Mehr → Heute auslassen* an der Übung, *⋯ → Satz auslassen* am einzelnen Satz.
- Ausgelassenes bleibt durchgestrichen stehen: Abends sieht man noch, was
  geplant war – und ob man es vergessen oder entschieden hat.
- Es zählt nirgends mit: nicht ins Volumen, nicht in die Satzzahl, nicht in
  Bestleistungen, nicht in den Kalorienverbrauch, nicht in den Verlauf einer
  Übung. Beim Auslassen einer Übung werden offene Haken zurückgenommen; ein
  Haken auf einem ausgelassenen Satz holt ihn ohne Umweg zurück.
- Die Übung auszulassen bietet ein *Rückgängig* an, solange die Meldung steht.

**Ränge je Bewegung und ein Gesamtrang.** Sechs Bewegungen werden gewertet –
Bankdrücken, Kniebeuge, Kreuzheben, Schulterdrücken, Rudern, Bizepscurl. Das
beste geschätzte 1RM geteilt durch das Körpergewicht fällt in eine von fünf
Stufen (*Einsteiger* bis *Elite*), daraus werden 0 bis 100 Punkte. Der
Gesamtrang ist der Schnitt über alle sechs; was nie trainiert wurde, zählt als
null, und ein halbes Jahr alter Bestwert nur noch zu 60 Prozent. Deshalb kann
der Rang steigen und fallen. In der Übungsansicht steht der Rang der jeweiligen
Bewegung mit dabei.

Was diese Zahlen nicht sind, steht hinter dem Fragezeichen im Rangfeld und in
der README: keine Messung, sondern gerundete Richtwerte aus öffentlich
verbreiteten Kraftstandard-Tabellen.

**Rangliste gegen alle Konten des Projekts – freiwillig und standardmäßig aus.**
Wer teilnimmt, veröffentlicht seinen Punktestand, die Stufe je Bewegung, seinen
Anzeigenamen und sein Emoji. Keine Gewichte, kein Körpergewicht, keinen
Trainingseintrag – die neue Tabelle `rank_board` hat für ein Gewicht gar keine
Spalte. Sie ist die einzige Tabelle des Projekts, die jedes angemeldete Konto
lesen darf; schreiben darf jeder nur seine eigene Zeile. Den Haken wieder
herauszunehmen löscht sie. Freunde sind in der Liste markiert.

> **Nötig nach dem Merge:** [`supabase/schema.sql`](supabase/schema.sql) einmal
> neu im SQL-Editor ausführen, damit `rank_board` entsteht. Ohne das läuft alles
> weiter, nur die Rangliste bleibt leer – der eigene Rang wird ohnehin auf dem
> Gerät gerechnet.

**Tests.** Ein neuer Browser-Lauf (`tests/raenge.mjs`, 18 Prüfungen) für die
schlanke Kalorienseite, das Auslassen und die Rangliste mit zwei Konten
nebeneinander – inklusive einer Prüfung, die die veröffentlichte Zeile Feld für
Feld gegen eine Erlaubnisliste hält. Dazu dreizehn neue Prüfungen ohne Browser
für die Rangrechnung und für alles, was Ausgelassenes übergehen muss.

## Kalorienseite neu gestaltet · Lebensmittelsuche

*Branch `claude/kalorien-redesign`*

**Die eine Frage zuerst.** Statt vier gleich großer Kacheln, einer Tabelle und
zwei Diagrammen öffnet die Seite jetzt mit dem Tagesbudget: eine große Zahl
(*Noch übrig*), ein Balken (gegessen gegen Ziel, mit einer Marke, wo das Budget
ohne das heutige Training läge) und ein Satz, der zum Ziel passt – im Defizit,
im Überschuss, nah dran. Direkt darunter das Eiweiß mit seinem Ziel. Alles
Weitere steht darunter und tritt zurück.

- **Der Verbrauch sind drei Posten, die sich addieren** – Grundumsatz, Bewegung
  im Alltag, Training – statt vier Kacheln, von denen zwei einander enthielten.
  „Verbrauch je Übung" liegt jetzt aufklappbar darunter.
- **Der Verlauf zeigt zuerst den Wochenschnitt** (Ø gegessen, Ø verbraucht,
  Ø Bilanz), dann die Balken. Er erscheint nur, wenn überhaupt eine Zufuhr
  eingetragen ist.
- **Ein Makro-Balken statt zweier.** Das Eiweißziel hat seinen eigenen Balken
  oben; der Balken bei den Feldern zeigt nur noch die Aufteilung.

**Lebensmittel über einen Suchbegriff finden**, nicht nur über den Barcode. Ein
Feld für beides: eine Ziffernfolge wird als Barcode nachgeschlagen, alles andere
als Suchbegriff. Ergebnisse ohne Namen oder Kalorienangabe fallen raus. Der
Kamera-Scanner bleibt, wo der Browser ihn kann.

## Siebte Runde: Bedienung, Funktionen, Technik

*Branch `claude/siebte-runde`*

Setzt die Abschnitte „Bedienung und Funktionen" und „Technik" aus
[#17](https://github.com/JBderLeuchtturm/Gym-Tracker/issues/17) um.

**Im Studio**
- **Plus/Minus an Gewicht und Wiederholungen** – unter dem Satz, an dem man
  gerade steht, nicht unter jedem. An der Langhantel ist die Schrittweite die
  kleinste Scheibe je Seite.
- **Wischen auf einer Satzzeile**: nach rechts abhaken, nach links zurück. Der
  Haken bleibt zusätzlich.
- **Aufwärmsätze werden angeboten**, sobald ein Arbeitsgewicht steht – statt
  vergraben unter „Mehr".
- **Pause je Übung**: ein eigener Wert an der Übung schlägt Plan und Standard.
- **„Auf alle offenen übernehmen"** – Gewicht und Wiederholungen eines Satzes
  auf den Rest.
- **Supersatz-Zähler**: in welchem Durchgang die Gruppe steht.

**Auswertung**
- **Vergleich zweier Zeiträume nebeneinander** – der Vorzeitraum steht als Zahl
  neben dem aktuellen, nicht nur als Prozentchip versteckt.
- **Volumen je Muskelregion**, nicht nur Sätze. Zwölf Sätze Seitheben und zwölf
  Sätze Kniebeugen sind nicht dieselbe Arbeit.
- **Belastung**, zurückhaltend: aus Volumen und RPE der letzten Woche gegen die
  Woche davor, drei Stufen, kein Trainingsrat.
- **Wochentags-Muster**: an welchem Tag trainiert wird, an welchem es ausfällt.
- **Bestleistungen aller Übungen auf einer Liste**, sortiert nach geschätztem
  Maximum – statt je Übung verstreut.
- **Jahresrückblick** mit den Zahlen des Kalenderjahres, ab fünf Einheiten.

**Pläne**
- **Vorschau, bevor man einen Plan aktiviert**: der ganze Plan zum Durchlesen,
  Tag für Tag mit Vorgaben.
- **Wochenvolumen je Muskelgruppe schon beim Planen** – aus den Vorgaben
  gerechnet, mit Ziel daneben. Man sieht vor dem ersten Training, wo zu wenig
  steht und wo zu viel.
- **Übungen zwischen Tagen verschieben** (Kalendersymbol am Eintrag) statt
  löschen und neu anlegen.
- **Ersatzübungen im Plan hinterlegen**. Der Ersatz-Dialog im Training stellt
  sie nach oben, statt jedes Mal neu zu raten.

**Ernährung**
- **Nährwerte als Balken**: Eiweiß, Kohlenhydrate und Fett im Verhältnis (nach
  Kalorien gewichtet), mit einem Strich für das Eiweißziel.
- **Open Food Facts angebunden**: Barcode eintippen oder mit der Kamera scannen,
  Nährwerte auf eine Menge umrechnen und auf den Tag drauflegen. Kostenlos, ohne
  Konto; übermittelt wird nur der Barcode.
- **Wiederkehrende Mahlzeiten speichern** und mit einem Tipp dazurechnen.

**Freunde**
- **Gemeinsames Training** ohne gemeinsamen Zustand: Jeder hakt auf seinem Gerät
  ab; auf der Heute-Seite steht, wer am selben Tag trainiert hat und was
  zusammengekommen ist – aus dem geteilten Fortschritt.
- **Wochenrückblick als Bild** zum Teilen oder Speichern – die vier Zahlen und
  die Wochen als Balken, in den Farben der App, ohne fremde Bibliothek.

**Technik**
- **Der Übungskatalog liegt fertig geparst als JSON vor**, erzeugt beim Bauen
  aus der kompakten Textfassung. Zur Laufzeit läuft nur noch ein `JSON.parse`
  statt gut zweihundert Zeilen einzeln zu zerlegen.
- **Ein kleiner Zwischenspeicher** für `parseISODate` und `weekdayOf` – in
  langen Listen wird dasselbe Datum sehr oft zerlegt.
- **Fehlerabfang um die Seiten**: Ein Fehler in einer Komponente nimmt nicht
  mehr die ganze App mit. Statt weißem Bildschirm steht da, was los ist, und ein
  Knopf lädt neu; beim nächsten Reiterwechsel setzt es sich zurück.
- **Der Service Worker kennt jetzt alle App-Dateien vorab** – ein Vite-Schritt
  trägt die gebauten Bündel in ihn ein. Wer offline zum ersten Mal die
  Auswertung öffnet, bekommt sie.
- **Ein Browser für alle Testläufe** statt dreizehn – spart je Lauf ein bis
  zwei Sekunden.
- **Läufe ohne Browser für die reine Rechnerei** (`tests/unit.mjs`): Scheiben,
  1RM, Kalorien, Statistik, Belastung, Zusammenführen – zweiundzwanzig
  Prüfungen, in Sekunden statt Minuten.

## Sechste Runde: die Durchsicht vom September

*Branch `claude/gestaltung-durchsicht`*

Setzt die neun Punkte aus [`docs/gestaltung-durchsicht-2026-09.md`](docs/gestaltung-durchsicht-2026-09.md)
um – eine erneute Durchsicht der Oberfläche mit dem Blick von außen: Wo sieht
die App aus wie eine App und nicht wie das Trainingsbuch, das sie sein will?

**Beschriftung**
- **Keine gesperrten Versalien mehr.** Kleine, breit getrackte Großbuchstaben
  markierten fast jede Beschriftung – Blocküberschriften, Kennzahlen,
  Tabellenköpfe, die Spalten der Satzliste, das Wochenblatt. Das ist der
  häufigste Griff generierter Oberflächen und widersprach dem eigenen Grundsatz,
  dass nichts dekoriert wird. Jetzt überall dieselbe Lesart wie bei den
  Abschnittsüberschriften: normale Schreibung, eine Stufe leiser.

**Die großen Zahlen**
- **Ein eigener Schnitt für die Zahlen.** Kennzahlen, Tagesbilanz und Pausenuhr
  stehen jetzt in einem leichten, eng gesetzten Schnitt in großem Grad – dieselbe
  Haltung wie die Zahl der Vollbild-Pausenuhr. Versalziffern, damit nichts unter
  die Grundlinie fällt. Der Seitentitel ist schwerer und enger und hebt sich
  damit klar von den Abschnittsüberschriften ab.
- **Die Schriftkette ist gekürzt** auf die vier Systemschriften, die es
  wirklich gibt.

**Breite Fenster**
- **Die Reiterleiste ist ein Band über die volle Breite** – Fläche und
  Trennlinie wie der Kopfbalken darüber, statt zentriert in leeren Bahnen zu
  hängen. Die Reiter selbst sitzen mittig.
- **Die Wochenleiste bläht sich nicht mehr auf.** Sieben Tage brauchen auf
  1280 Pixeln nicht mehr Platz als auf 400 – sonst wird jeder Tag zu einer
  großen leeren Kachel.
- **Die Satzzeile bleibt schmal**, auch wenn die Spalte breit wird. Sonst
  stehen Gewicht, Wiederholungen und RPE weit weg von ihrer Kopfzeile.
- **Die Achsenbeschriftung der Diagramme klebt nicht mehr am Rand.**

**Kleinigkeiten**
- **Kein Begrüßungstitel mehr.** „Hallo Jan" über der Startseite sagte nichts –
  ein Trainingsbuch begrüßt einen nicht. Der Titel heißt „Training", wo man
  steht, sagt die Zeile darunter.
- **Die Vorleistung steht auf einer eigenen Zeile** in der Übungskarte, nicht
  mit Mittelpunkten an Kategorie und Sollwert gehängt – sie ist die Angabe, die
  man zwischen zwei Sätzen wirklich abliest.
- **„Sätze je Woche" ist ein flacher Streifen** unter dem Volumendiagramm. Die
  Satzzahl je Woche schwankt kaum; ein zweites Diagramm in voller Höhe daneben
  doppelte nur die Form darüber.

## Fünfte Runde: die Funde und die Gestaltung

*Branch `claude/fuenfte-runde`*

Setzt die Abschnitte „Was beim Durchsehen aufgefallen ist" und „Gestaltung"
aus [#17](https://github.com/JBderLeuchtturm/Gym-Tracker/issues/17) um.

**Die neun Funde**
- **Körpergewichtsübungen zeigten „0 kg × 9".** Null Kilo ist keine Angabe,
  sondern eine fehlende. Dieselbe Zeile stand an neun Stellen im Code – das
  war der Grund, warum der Fehler an neun Stellen zu sehen war. Jetzt einmal
  in `src/lib/setFormat.ts`: „9 Wdh" bei Körpergewicht, „+10 kg × 9" mit
  Zusatzgewicht.
- **Die Körperkarte war im hellen Thema fast unsichtbar** – 1,14 zu 1. Sie hat
  jetzt eigene Farbtöne, der Umriss erreicht in beiden Themen 3 zu 1.
- **Der Wochenplan verrät seine Tage.** Statt einer Zahl je Tag steht der Name
  darin, in derselben Form wie das Wochenblatt.
- **Der Planeditor öffnet auf einem Trainingstag**, nicht auf dem heutigen
  Ruhetag mit leerem Inhalt.
- **Der Kalorienverlauf besteht aus Balken.** Eine Linie zwischen Trainings-
  und Ruhetagen behauptet einen Übergang, den es nicht gibt.
- **Die Kalorienseite ist gegliedert** wie die Auswertung – Überschriften mit
  Linie statt Kartenstapel.
- **„Kein Vergleichszeitraum" steht einmal** statt dreimal „neu".
- **Die Freunde-Seite zeigt erst, wozu es gut ist.** Die Einrichtung mit
  SQL-Editor und Schlüsseln liegt dahinter, hinter einem Knopf.
- **Breite Fenster laufen nicht mehr auseinander.** Lesebreite 760 Pixel; wo
  zwei Spalten sinnvoll sind, gibt es zwei.

**Struktur und Raum**
- **Zwei Spalten ab 900 Pixel** auf Training und Auswertung: links das
  Laufende, rechts das Nachschlagende. Darunter löst sich das Raster auf.
- **Eine Kopfzeile weniger.** Wochenleiste und Tagesnavigation sagten dasselbe;
  jetzt tragen die Pfeile an der Wochenleiste ganze Wochen, und darunter steht
  eine Zeile mit Tag, Plantitel und Zykluswoche.
- **Die Körperkarte auf der Startseite ist ein Streifen** aus Punkten und
  Namen. Zwei ganze Körper waren dort fast ein Bildschirm; die Karte ist einen
  Tipper entfernt.
- **Eine Rahmensorte weniger.** Abschnitte gliedern die Seite, Karten sind für
  Dinge, die man einzeln anfassen kann.

**Satzliste**
- **Erledigte Sätze treten zurück**, der nächste offene bekommt einen Strich
  am linken Rand.
- **Zahlenfelder ohne Dauerrahmen** – sichtbar wird der Rahmen dort, wo man
  gerade steht.
- **Einheiten nur in der Kopfzeile**, nicht zusätzlich in jedem Feld.
- **Größere Ziffern**: 17 px statt 16, halbfett. Es ist eine Zahlenliste.

**Farbe und Schrift**
- **Messing bedeutet nur noch Bedienung.** Kalender, Wochenblatt und die
  Diagramme über die Zeit haben einen eigenen, kühlen Ton bekommen; der
  Tagesbalken ist grün wie ein abgehakter Satz.
- **Drei Muskelgruppen-Farben lagen auf Systemfarben** – Terrakotta drei Grad
  neben „Gefahr", Ocker fünf neben dem Akzent. Eine Brustübung sah aus wie ein
  Fehler, eine Schulterübung wie ein Knopf. Die Palette ist umgeräumt, jeder
  Ton erreicht auf hellem wie dunklem Grund mindestens 4 zu 1.
- **Die Kategorie steht als Punkt daneben**, der Name bleibt neutral. Farbe im
  Text trägt sonst eine Bedeutung, die sie hier nicht hat.
- **Vier Überschriftengrößen statt sechs.**

**Rückmeldung**
- **Übungskarten klappen auf**, statt zu erscheinen – über die Zeilenhöhe eines
  Rasters, dem einzigen Weg, in reinem CSS auf eine unbekannte Höhe zu blenden.
  Zugeklappt ist der Inhalt auch für Tastatur und Vorleseprogramm weg; vorher
  wären es zwölf unsichtbare Eingabefelder je Karte gewesen.
- **Bestleistungen blitzen in der Zeile auf**, in der sie passiert sind.
- **Leere Zustände bieten einen Weg an** statt nur festzustellen, dass nichts
  da ist.
- **Ladeplatzhalter in der Form dessen, was kommt.**

**Geprüft**
- Dreizehnter Testlauf `tests/fuenfte.mjs`, vierzehn Prüfungen – darunter
  Kontrast der Silhouette und Abstand der Kategorienfarben zu den
  Systemfarben, beide im laufenden Browser gerechnet.

## Vierte Runde: Rechner, Studio-Handgriffe, Anleitungen, Wetter

*Branch `claude/vierte-runde`*

Setzt die übrigen Punkte aus
[#13](https://github.com/JBderLeuchtturm/Gym-Tracker/issues/13) um – Bedienung
im Studio, Gestaltung, Funktionen, Technik – und bindet die beiden
gewünschten Schnittstellen an.

**Im Studio**
- **Scheibenrechner.** „82,5 kg" heißt an der Langhantel: pro Seite 25 + 5 +
  1,25. Gerechnet wird exakt statt gierig – 30 kg je Seite sind mit 20 + 15
  nicht zu machen, mit 15 + 15 schon. Die Scheiben stehen auch klein unter dem
  Gewichtsfeld, sobald man einen Satz aufklappt.
- **1RM-Rechner mit Prozenttabelle**, 60 bis 100 %, mit den rechnerisch
  möglichen Wiederholungen daneben. Aus derselben Formel wie der Verlauf –
  eine fremde Tabelle danebenzulegen würde nur widersprüchliche Zahlen
  erzeugen.
- **Pausenuhr als Vollbild.** Eine Zahl, von der Bank aus lesbar. Wer das
  einmal will, will es meistens immer, deshalb merkt die App die Entscheidung.
- **Größere Trefferflächen.** Der Haken war 34 Pixel breit, jetzt 44 – das
  Maß, auf das sich Apple und Google unabhängig voneinander geeinigt haben.
  Dazu ein kurzer Rüttler beim Abhaken.
- **Bildschirm bleibt wach**, solange die Zeitmessung läuft.
- **„Letztes Training wiederholen"** übernimmt den letzten gleichen Trainingstag
  samt Gewichten – abgehakt wird nichts.
- **Satz duplizieren** statt neu eintippen.
- **Zuletzt benutzte Übungen** stehen oben in der Suche.

**Anleitungen und Wetter**
- **Ausführung nachschlagen**: Text und Bilder aus dem wger-Bestand, direkt in
  der Übungsansicht. Einmal geladen, bleiben sie im Gerät – im Keller mit einem
  Balken Empfang ist eine Anleitung, die erst geladen werden muss, keine
  Anleitung. Für den ganzen Trainingstag lässt sich das mit einem Knopf
  vorladen.
- **Wetter zum Trainingstag** über [Open-Meteo](https://open-meteo.com),
  kostenlos und ohne Konto. Erscheint nur an Tagen, an denen etwas draußen
  ansteht – wer im Studio Bankdrücken macht, dem ist Regen egal. Der Ort geht
  auf zwei Nachkommastellen gerundet hinaus, rund anderthalb Kilometer.

**Funktionen**
- **RIR neben RPE.** Gespeichert wird weiterhin ein Wert; RIR ist die andere
  Leserichtung (RIR 2 = RPE 8). Alte Einträge bleiben gültig.
- **Übungsvarianten zusammengefasst.** Flach, schräg und mit Kurzhanteln sind
  drei dünne Verläufe; zusammen ist es eine Linie, an der man etwas sieht.
- **Dauerhafte Notiz je Übung** („Bank auf Stufe 3, Griff außen").
- **Ziele mit Datum** samt Hochrechnung, ob das Tempo reicht.
- **Erinnerung an den Trainingstag** – beim Öffnen, plus Export der
  Trainingstage als Kalenderdatei mit Voranmeldung. Siehe unten.

**Gestaltung**
- **Tabellenziffern** überall dort, wo Zahlen untereinander stehen.
- **Die Auswertung ist gegliedert** – Überschriften mit Linie statt eines
  Stapels aus neun gleich schweren Karten.
- **Wochenblatt** im Verlauf: sieben Tage nebeneinander, statt Tag für Tag zu
  blättern. Die leeren Tage sind der eigentliche Punkt.
- **Druckansicht für den Plan**, mit leeren Spalten zum Eintragen.

**Technik**
- **Kontraste geprüft und nachgezogen.** Die blasseste Schrift lag bei 3,2 zu
  1; jetzt erreicht jede Textfarbe auf jedem Untergrund mindestens 4,5 zu 1.
- **Diagramme für Vorleseprogramme**: dieselben Zahlen als unsichtbare
  Tabelle. Der Trainingskalender hat statt 189 Haltepunkten nur noch die Tage
  mit Training.
- **Sprungmarke zum Inhalt**, sichtbarer Fokusrahmen überall, und wer Bewegung
  abgestellt hat, bekommt keine.
- **Automatische Sicherung am Konto**, täglich, vierzehn Tage lang. Der
  laufende Abgleich ist eine Spiegelung, keine Sicherung: Was man löscht, ist
  Sekunden später auch dort gelöscht.
- **Ladezeit halbiert.** Nur „Heute" wird mitgeliefert; alle anderen Seiten,
  die Dialoge und das englische Wörterbuch kommen beim ersten Antippen nach.
  Beim Start: 506 kB statt 725 kB, gepackt 150 kB statt 204 kB.
- Zwölfter Testlauf `tests/vierte.mjs`, vierzehn Prüfungen

**Nebenbei behoben**
- Ein Dialog, der aus einer Übungskarte heraus aufging, klebte an der Karte
  statt am Bildschirm. Ursache war eine Einblend-Animation mit `both` statt
  `backwards`: Der Endzustand blieb als `transform` stehen, und ein Element mit
  `transform` ist Bezugsrahmen für alles darin, was `position: fixed` benutzt.
  Dialoge hängen jetzt zusätzlich am Dokument statt an der Stelle, von der sie
  geöffnet wurden.
- Rechtsbündige Tabellenköpfe waren linksbündig – `table.data th` schlug
  `.right`.

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

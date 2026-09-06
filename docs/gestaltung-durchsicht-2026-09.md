# Gestaltung: Durchsicht September 2026

Eine erneute Durchsicht der Oberfläche, diesmal mit dem Blick von außen: Wo
sieht die App aus wie eine App, und nicht wie das Trainingsbuch, das sie sein
will? Grundlage sind Screenshots aller sechs Reiter in beiden Themen, dazu die
Übungskarte im aufgeklappten Zustand und die Auswertung in voller Höhe, jeweils
auf schmalem Gerät (430 px) und am breiten Fenster (1280 px).

Das Leitbild steht und trägt. Der einzelne Akzent, die Haarlinien statt
Schatten, die kleinen Radien, die Bedeutung der Farbe, das Papier statt Weiß im
hellen Thema – das ist konsequent durchgehalten und liest sich als Haltung, nicht
als Vorlage. Die folgenden Punkte sind das, was trotzdem noch nach Baukasten
aussieht, und ein paar Stellen, an denen das Handwerk auf breiten Fenstern
nachlässt.

---

## 1. Versalien als Mikrobeschriftung

Das ist der auffälligste verbliebene Serientell. Kleine, gesperrte
Großbuchstaben markieren in der App fast jede Beschriftung:

- `.section-label`, `.block__title`
- `.stat__label` (Auswertung, Kalorien)
- `.tally__label` (Tagesbilanz auf „Heute")
- `.set-header` (`#  KG  WDH  RPE` über der Satzliste)
- `table.data th`
- `.weeksheet__wd`, `.heatmap__month`

Gesperrte Versalien in 0,66 rem sind der häufigste Griff generierter
Oberflächen, und sie widersprechen dem eigenen Anspruch, dass nichts dekoriert
und alles zurücktritt. Ein Trainingsbuch beschriftet seine Spalten nicht in
Kapitälchen – es schreibt „kg" und „Wdh" klein und mager an den Kopf der Spalte,
oder es lässt die Beschriftung ganz weg, weil die Einheit im Feld schon steht.

Die App hat bereits ein besseres Muster und wendet es an anderer Stelle an: die
Abschnittsüberschrift in normaler Schreibung mit einer Linie darunter
(`.section__head` – „Verteilung", „Rückblick", „Trainingskalender"). Das ist
ruhig, gliedert und trägt Information. Dieses Muster gehört nach unten
durchgezogen, und die Versalien-Stufe gehört gestrichen:

- `.section-label` / `.block__title` → normale Schreibung, `--text-muted`,
  0,8 rem, halbfett. Keine `text-transform`, keine `letter-spacing`.
- `.stat__label` / `.tally__label` → dasselbe. Die große Zahl darunter trägt
  den Blick ohnehin; das Label darf klein und unauffällig sein, muss aber nicht
  schreien.
- `.set-header` → magere Kleinschreibung, direkt an die Spalten gesetzt.
- `table.data th` → halbfett, normale Schreibung, Haarlinie darunter (die ist
  schon da).

Das ist ein spürbarer Eingriff – er betrifft jeden Screen –, aber er ist der
mit dem größten Ertrag. Danach sieht die App an keiner Stelle mehr nach
Dashboard-Vorlage aus.

## 2. Mittelpunkt-Ketten in den Metazeilen

Jede Übungskarte trägt unter dem Namen eine Zeile der Form

> Rücken · 4 Sätze · zuletzt 26.08.26: 4× 8 Wdh

Drei bis vier Angaben, mit Mittelpunkten aneinandergehängt, alles in derselben
gedämpften Farbe und Größe. Auch das ist ein Serienmuster („A · B · C"), und es
steckt hier gleich dreifach übereinander: Kategorie, geplanter Umfang,
Vorleistung. Beim Durchblättern von acht Karten ist das viel graue
Kleinschrift, die man jedes Mal neu sortieren muss.

Vorschlag: die Vorleistung ist die einzige Angabe, die man beim Training
wirklich abliest – sie gehört auf eine eigene Zeile und darf etwas kräftiger
sein (`--text-muted` statt `--text-dim`). Kategorie und Sollwert bleiben in der
dünnen Zeile, aber ohne die Vorleistung ist die kurz genug, dass die
Mittelpunkte nicht mehr wie eine Aufzählung wirken. Oder: den Sollwert als
kleinen Chip rechts in die Kopfzeile, dann bleibt links nur „Rücken" und die
Vorleistung.

## 3. Der Begrüßungstitel

„Hallo Jan" als Seitentitel über dem wichtigsten Screen ist freundlich, aber
inhaltsleer – ein Trainingsbuch begrüßt einen nicht. Der Titel könnte die Sache
benennen, um die es geht: das Datum und der Plantag („Mittwoch · Pull") oder
schlicht „Heute". Die Anrede, wenn sie sein soll, passt besser ins Profil.

---

## 4. Wochenleiste auf dem breiten Fenster

Auf dem Desktop zieht sich die Wochenleiste (`.day-strip`) über die volle
Seitenbreite, und jeder der sieben Tage wird zu einer großen, fast leeren
Kachel (ca. 150 px breit, viel Luft um die Ziffer). Das sieht unfertig aus –
die Leiste braucht auf 1280 px nicht mehr Platz als auf 430 px. Eine
`max-width` von etwa 520 px, linksbündig unter dem Seitentitel, hält die Tage
in Griffweite beieinander.

## 5. Navigationsleiste auf dem breiten Fenster

Auf dem Desktop steht die Reiterleiste (`max-width: 900px; margin: 0 auto`)
zentriert unter einem Kopfbalken, der über die volle Breite läuft. Das ergibt
eine schwebende Leiste mit leeren Bahnen links und rechts gegen den nackten
`--bg`. Entweder die Leiste an denselben linken Rand wie den Inhalt setzen und
mit dem Kopfbalken bündig führen, oder ihr eine eigene Fläche
(`--surface`/Haarlinie) geben, damit sie nicht in der Luft hängt.

## 6. Zwei fast gleiche Balkendiagramme

In der Auswertung stehen „Volumen je Woche" und „Sätze je Woche" direkt
übereinander, beide als blaugrauer Balkensatz in nahezu gleicher Form und
Farbe. Nebeneinandergestellt liest sich das monoton, und der Unterschied
zwischen den beiden Tönen (`--time` hell / dunkler Schiefer) ist so klein, dass
er nicht als Aussage ankommt.

Ideen: die beiden zu einem Diagramm zusammenfassen (Balken = Volumen, eine
dünne Linie darüber = Sätze), oder das Satz-Diagramm auf eine flache
Sparkline-Höhe reduzieren, weil die Satzzahl je Woche ohnehin wenig schwankt.
Wenn beide bleiben, sollte mindestens der zeitliche Ton konsequent für beide
gelten – im Moment wirkt es wie zwei zufällig verschiedene Blaus.

## 7. Achsenbeschriftung klebt am Rand

In den Diagrammen der Auswertung sitzen die Y-Achsen-Werte („40k", „20k", „0")
hart am linken Kartenrand, teils angeschnitten. Dem Diagramm-`svg` fehlt links
Innenabstand für die Beschriftung – ca. 8–10 px reichen.

## 8. Satzzeilen laufen auf breiten Spalten auseinander

Das Raster der Satzzeile (`34px 1fr 1fr 60px 82px`) verteilt sich in der
linken Spalte der Zweispaltenansicht auf gut 600 px. Dadurch stehen Gewicht,
Wiederholungen und RPE weit auseinander und weit weg von ihrer
Spaltenüberschrift – die Zeile franst aus. Eine `max-width` auf `.set-row` /
`.set-header` (etwa 440 px, linksbündig) hält die Zahlen zusammen; im Querformat
gibt es die Begrenzung über `.exercise__body` schon.

---

## 9. Eine typografische Stimme fehlt

Die Entscheidung gegen eine Webschrift ist nachvollziehbar und dokumentiert
(Offline-Start, kein Ladeumweg). Der Preis ist, dass die App typografisch
anonym bleibt: ein System-Sans in einem Schnitt, `font-weight: 640` für alle
Überschriften, sonst nichts Eigenes. Farbe und Struktur tragen die ganze
Persönlichkeit.

Innerhalb der Selbstbeschränkung ginge trotzdem ein charakteristischer Griff:

- Die Seitentitel (`h1`) deutlich schwerer und enger setzen (`700`,
  `letter-spacing: -0.03em`, etwas größer) und damit klar von den
  Abschnittsüberschriften absetzen – im Moment liegen `h1` (1,45 rem/640) und
  `.card__title` (0,95 rem/640) nur in der Größe auseinander, nicht im Ton.
- Die großen Zahlen (`.stat__value`, `.tally__value`, die Pausenuhr) tragen die
  App – hier lohnt ein eigener Schnitt am meisten. `font-feature-settings`
  für echte Versalziffern und ein enger, leichter Schnitt (`300`–`400` bei
  großem Grad, wie es die Vollbild-Pausenuhr schon macht) geben den Zahlen ein
  Gesicht, ohne eine Datei zu laden.
- Eine der System-Stacks bewusst wählen statt der langen Fallback-Kette: auf
  Apple `ui-rounded` oder `-apple-system` gezielt, auf Windows `Segoe UI` – die
  Kette „−apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, …" ist die
  Standardkette, die jede Bootstrap-Seite hat.

Das ist die Stelle, an der „eine Sache darf mutig sein" gilt: die Zahlen. Alles
andere bleibt so ruhig, wie es ist.

---

## Reihenfolge

1. **Versalien-Beschriftung streichen** (Punkt 1). Größter Ertrag, betrifft
   jeden Screen, macht die App auf einen Schlag weniger nach Vorlage.
2. **Desktop-Handwerk** (Punkte 4, 5, 7, 8). Kleine, klar umrissene Eingriffe,
   die das breite Fenster von „läuft auch" auf „ist gemeint" heben.
3. **Metazeile der Übungskarte entzerren** (Punkt 2). Betrifft den meist­
   benutzten Screen.
4. **Zahlen bekommen einen Schnitt** (Punkt 9). Der eine mutige Griff.
5. Begrüßungstitel und Diagramm-Dopplung (Punkte 3, 6) nach Geschmack.

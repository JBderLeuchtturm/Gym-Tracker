# Gym Tracker

Ein persönlicher Trainingstracker als Website – funktioniert im Browser am Rechner
genauso wie auf dem Handy, wo sie sich als App auf den Startbildschirm legen lässt.

## Was drin ist

**Wochenpläne**
Beliebig viele Pläne anlegen, benennen und jederzeit zwischen ihnen wechseln.
Jeder Wochentag bekommt einen Namen (z. B. „Push"), Übungen mit Zielvorgaben
(Sätze, Wiederholungsbereich, Zielgewicht, Pausenzeit) und lässt sich auf andere
Tage kopieren – auch auf mehrere gleichzeitig. Ein Plan lässt sich als
Textbaustein weitergeben und woanders wieder einfügen; das läuft ohne Server
und ohne Konto, mitgeschickte eigene Übungen kommen mit. Fünf fertige Vorlagen
sind dabei: Push/Pull/Legs, Oberkörper/
Unterkörper, Ganzkörper, 5er-Split und ein reines Körpergewichts-Programm.

**Training aufzeichnen**
Die Startseite zeigt genau die Übungen, die laut aktivem Plan heute anstehen.
Jeder Satz wird mit Gewicht, Wiederholungen und optional RPE eingetragen und
abgehakt; wer lieber in Wiederholungen in Reserve rechnet, stellt unter
*Profil → Im Studio* auf RIR um – gespeichert wird derselbe Wert, nur anders
gelesen. Aufwärmsätze lassen sich markieren und zählen nicht ins Volumen.
Zwischen den Sätzen läuft auf Wunsch ein Pausen-Timer, auf Wunsch als Vollbild
mit einer Zahl, die man von der Bank aus liest. Ein Satz lässt sich duplizieren,
und „Training vom … wiederholen" übernimmt den letzten gleichen Trainingstag
samt Gewichten. Spontane Zusatzübungen gehen jederzeit, auch an Ruhetagen.

**Rechner für zwischen den Sätzen**
Der *Rechner* an jeder Übung beantwortet die zwei Fragen, die man sonst im Kopf
löst. Erstens: Was muss auf die Stange? „82,5 kg" heißt je Seite 25 + 5 + 1,25.
Gerechnet wird exakt und nicht gierig – 30 kg je Seite sind mit 20 + 15 nicht zu
machen, mit 15 + 15 schon. Welche Scheiben im Studio hängen und wie schwer die
Stange ist, lässt sich einstellen. Zweitens: Was sind 70 % davon? Dazu eine
Prozenttabelle von 60 bis 100 % mit den rechnerisch möglichen Wiederholungen –
aus derselben Formel wie der Verlauf.

**Ausführung nachschlagen**
In der Übungsansicht lässt sich die Beschreibung samt Bildern aus dem
[wger-Bestand](https://wger.de) holen (CC BY-SA). Einmal geladen, bleibt sie im
Gerät: Im Studio-Keller mit einem Balken Empfang ist eine Anleitung, die erst
geladen werden muss, keine Anleitung. Für den ganzen heutigen Trainingstag geht
das mit einem Knopf auf einmal – gedacht für zu Hause, bevor man losfährt.

**Letzte Leistungen direkt an der Übung**
Unter jeder Übung steht, was beim letzten Mal lief – Datum, Gewichte, Wiederholungen,
geschätztes 1RM und die Veränderung des Volumens gegenüber der Einheit davor.
Neue Sätze sind mit den Werten vom letzten Mal vorbelegt, du korrigierst nur noch.

**Fortschritt**
Volumen und Sätze je Woche, Verteilung auf die Muskelgruppen, Körpergewichtsverlauf
und für jede einzelne Übung ein Verlaufsdiagramm – wahlweise nach geschätztem 1RM,
bestem Gewicht, Volumen, Wiederholungen oder Zeit. Dazu persönliche Bestleistungen
und eine Tabelle der letzten Einheiten.

**Muskelkarte und Wochenziele**
Eine Körperkarte von vorne und hinten zeigt bei jeder Übung, welche Muskeln
das Ziel sind (kräftig) und welche mitarbeiten (blass). Auf der Startseite
steht dieselbe Karte für den heutigen Tag – kräftig ist, was schon abgehakt
ist. In der Übungssuche lässt sich eine Region antippen und man bekommt
passende Übungen vorgeschlagen, Zielmuskel zuerst.

In der Auswertung wird daraus eine Ampel gegen dein **Wochenziel**: rot heißt
deutlich zu wenig, gelb knapp drunter, grün im Ziel, violett darüber. Grau
heißt schlicht „diese Woche noch nichts" – am Montagmorgen wäre ein komplett
roter Körper wenig hilfreich. Darunter steht im Klartext, was noch fehlt und
welche Region am längsten nicht dran war. Die Ziele stehen unter
*Profil → Wochenziele je Muskelgruppe*; voreingestellt sind die üblichen
10 bis 20 Sätze je Woche, auf 0 gesetzt verschwindet eine Gruppe aus der Ampel.
Die Zeichnung ist selbst gemacht, damit keine fremden Abbildungen im Spiel sind.

**Zyklen und Progression**
Ein Plan kann über mehrere Wochen laufen: Die Zielgewichte steigen Woche für
Woche um einen festen Prozentsatz und fallen in der Entlastungswoche zurück.
Auf der Startseite steht, in welcher Woche du gerade bist. Je Übung lässt sich
außerdem eine Steigerung hinterlegen – schaffst du in allen Sätzen das obere
Ende des Wiederholungsbereichs, schlägt die App beim nächsten Mal so viel mehr
vor (doppelte Progression). Auf 0 gesetzt bleibt das Gewicht, wo es ist.

**Ersatzübungen und Geräteprofil**
Ist die Bank besetzt, zeigt *Ersatz* Übungen mit denselben Zielmuskeln; die
schon eingetragenen Sätze bleiben stehen. Wer unter *Profil → Verfügbare
Geräte* ankreuzt, was er hat, bekommt in der Suche zuerst das, was auch
machbar ist – und sieht im Ersatz-Dialog, was ihm fehlt.

**Körpermaße und Fotos**
Umfänge für Hals, Brust, Oberarm, Taille, Hüfte, Oberschenkel und Wade, jeweils
mit Verlauf – das Gewicht allein steht bei Muskelaufbau wochenlang still.
Dazu Fortschrittsfotos, die sich zu zweit nebeneinander legen lassen. Die
Bilder bleiben ausdrücklich auf dem Gerät: kein Server, keine Freigabe, kein
Backup-JSON.

**Ziele mit Datum**
„100 kg Bankdrücken bis Juni" – die App rechnet aus dem bisherigen Verlauf hoch
und sagt, ob das Tempo reicht, knapp wird oder so nichts wird. Bei zu dünner
Datenlage sagt sie lieber nichts. Ob ein Ziel erreicht ist, wird abgeleitet und
nirgends vermerkt: Ein gespeichertes „geschafft" kann zwischen zwei Geräten
auseinanderlaufen, ein abgeleitetes nie.

**Übungsvarianten zusammen betrachten**
Flach, schräg und mit Kurzhanteln sind drei dünne Verläufe mit je wenigen
Punkten. Im Verlauf lässt sich auf „alle Spielarten" umschalten, dann ist es
eine Linie, an der man etwas sieht. Zugeordnet wird über eine feste,
überschaubare Liste von Bewegungen statt über Namensähnlichkeit – Ähnlichkeit
hätte Beinstrecker und Beinbeuger in einen Topf geworfen.

**Wetter, wenn draußen trainiert wird**
Steht an einem Tag etwas draußen an – Laufen, Sprints, Radfahren –, zeigt die
Startseite das Wetter dazu, von [Open-Meteo](https://open-meteo.com), kostenlos
und ohne Konto. An allen anderen Tagen steht dort nichts: Wer im Studio
Bankdrücken macht, dem ist Regen egal. Der Ort wird auf zwei Nachkommastellen
gerundet gespeichert und übertragen, rund anderthalb Kilometer; für die Frage,
ob es beim Laufen regnet, reicht das.

**Kalender, Hochrechnung, Export**
Ein Trainingskalender über 27 Wochen zeigt Lücken auf einen Blick, und ein
Wochenblatt im Verlauf legt sieben Tage nebeneinander – Lücken sieht man nur,
wenn man sie nicht Tag für Tag durchblättert. Bei jeder Übung steht, wie viel im
Monat dazukommt und wann das nächste runde Ziel erreicht wäre – mit ehrlicher
Angabe, wie gleichmäßig der Verlauf ist. Alles lässt sich als CSV mitnehmen;
Bericht und Trainingsplan gehen über den Druckdialog als PDF oder auf Papier,
der Plan mit leeren Spalten zum Eintragen.

**Erinnerung an den Trainingstag**
Zwei Wege, und nur einer davon ist die App. Beim Öffnen an einem Trainingstag,
an dem noch nichts steht, erscheint ab einer eingestellten Uhrzeit ein Hinweis.
Verlässlich erinnert aber der Kalender des Telefons: Unter *Profil → Erinnerung*
lassen sich die Trainingstage als Kalenderdatei mit Voranmeldung herunterladen.
Eine Web-App kann sich nicht selbst wecken, solange sie geschlossen ist – alles,
was ohne fremden Server ginge, setzt voraus, dass sie gerade offen ist, und dann
braucht man keine Erinnerung mehr.

**Trainingspartner**
Steht unter *Profil → Trainingspartner* ein Name, lässt sich jeder Satz dem
Partner zuordnen. Die Sätze stehen mit im Training, zählen aber nicht in dein
Volumen, deine Bestleistungen oder deinen Kalorienverbrauch.

**Kalorienverbrauch**
Aus den Profildaten wird der Grundumsatz berechnet, daraus der Alltagsumsatz, und
das Training kommt über MET-Werte je Übung obendrauf. Eine gemessene
Trainingsdauer skaliert die Schätzung – sie muss aber mindestens so lang sein
wie die reine Hebezeit, sonst ist sie nachweislich falsch und wird verworfen. Die Zufuhr kann von Hand,
per Yazio-CSV-Export oder über eine eigene Bridge dazukommen (siehe unten).

**Übungssuche mit vielen Vorschlägen**
Über 200 Übungen sind fest eingebaut – deutsch und englisch benannt, mit Muskeln,
Geräten, Synonymen und MET-Wert. Gesucht wird über all diese Felder gleichzeitig,
inklusive Tippfehlertoleranz: „latissimus", „kurzhantel", „bench", „bd" oder
„kniebeuge" führen alle zum Ziel. Zusätzlich wird live die freie
[wger-Datenbank](https://wger.de) abgefragt (kostenlos, ohne Konto, ohne API-Key),
die noch einmal mehrere tausend Übungen beisteuert. Findest du trotzdem nichts,
legst du die Übung in zehn Sekunden selbst an.

## Gestaltung

Die Oberfläche folgt dem Bild eines Trainingsbuchs, nicht dem einer
Software-Oberfläche: warme Graustufen, ein einziger Akzent, Haarlinien statt
Schatten, kleine Radien. Farbe bedeutet etwas – erledigt, Warnung, aktiv – und
ist nie Dekoration. Das helle Thema ist Papier, kein Weiß.

Symbole sind gezeichnet, nicht aus Emoji zusammengesetzt. Wo ein Emoji auftaucht,
hat es jemand selbst gewählt: das Profilbild, das Zeichen einer Gruppe, eine
Reaktion auf ein Training.

Zahlen stehen in Tabellenziffern, damit Spalten untereinander stehen. Eine
eigene Schrift dafür wäre schöner, kostet aber einen Ladevorgang, den eine App,
die offline starten soll, nicht braucht – die Systemschriften von Apple, Google
und Microsoft bringen tabellarische Ziffern alle mit.

**Farbe hat eine Bedeutung, und zwar genau eine.** Messing heißt Bedienung:
hier bist du, hier drückst du. Grün heißt erledigt. Gelb und Rot heißen sieh
her. Ein kühler Ton trägt alles Zeitliche – Kalender, Wochenblatt, Verläufe.
Die Farben der Muskelgruppen erscheinen nur als Punkt neben einem neutral
gesetzten Namen: Farbe im Text würde eine Bedeutung tragen, die sie dort nicht
hat, und drei von ihnen lagen so nah an Akzent und Warnfarbe, dass eine
Brustübung wie ein Fehler aussah.

**Auf breiten Fenstern stehen zwei Spalten**, links das Laufende und rechts das
Nachschlagende. Sonst bleibt der Text auf Lesebreite: Eine Zeile ist bei etwa
65 Zeichen am besten zu lesen, und eine Eingabemaske über den halben Monitor
zwingt die Augen bei jeder Zeile einmal quer.

## Zugänglichkeit

Jede Textfarbe erreicht auf jedem Untergrund mindestens 4,5 zu 1 nach WCAG AA;
die blasseste lag vorher bei 3,2. Alles Anspringbare hat einen sichtbaren
Fokusrahmen, die erste Tabulatorstelle ist eine Sprungmarke am Menü vorbei, und
wer im System Bewegung abgestellt hat, bekommt keine.

Die Diagramme sind für Vorleseprogramme als Grafik ausgeblendet und tragen
dieselben Zahlen als unsichtbare Tabelle daneben. Eine Kurzbeschreibung
(„steigt leicht") wäre eine Auslegung; die Zahlen selbst sind es nicht. Im
Trainingskalender sind nur die Tage mit Training anspringbar – sonst wären es
189 Haltepunkte, von denen die meisten nichts zu sagen haben.

Zugeklappte Übungskarten sind auch für Tastatur und Vorleseprogramm zu; sonst
stünden dort zwölf Eingabefelder je Karte, die man anspringen kann, ohne sie zu
sehen. Die Körperkarte hebt sich in beiden Themen mit mindestens 3 zu 1 vom
Untergrund ab – das Maß für Grafik, die etwas bedeutet.

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

Dreizehn Läufe im echten Browser decken Grundbedienung, Trainingsfunktionen,
Übungssuche ohne Netz, Layout auf schmalen Geräten, Muskelkarte, Wochenziele
und Zyklen, Rückgängig und Querformat, Rechner und Studio-Handgriffe,
Gestaltung und Zugänglichkeit, Mehrsprachigkeit, Freunde und Freigaben,
Gruppen und Challenges sowie Einladungslinks ab. Kontraste und Farbabstände
werden dabei im laufenden Browser nachgerechnet, nicht nach Augenmaß beurteilt.

Kein Testlauf fasst einen fremden Dienst an: Die Läufe mit Konto arbeiten gegen
ein nachgebautes Supabase unter
[`tests/mockBackend.mjs`](tests/mockBackend.mjs), und wger wie Open-Meteo werden
im Browser abgefangen. Ein Test, der an einem fremden Server hängt, ist kein
Test – er ist eine Wettervorhersage. Bei jedem Push und Pull Request laufen sie
zusätzlich in GitHub Actions.

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

**Updates** kommen von selbst: Die installierte App prüft beim Öffnen und
stündlich, ob eine neuere Fassung online steht, lädt sie im Hintergrund und
meldet sich dann mit einem Balken *Neue Version verfügbar*. Erst ein Tipp
darauf schaltet um – so springt mitten im Satz nichts weg. Welcher Stand
gerade läuft, steht unter *Profil → App-Version*.

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

**Passwort vergessen** steht direkt unter dem Anmeldeformular. Ein Tipp darauf
schickt einen Link an die hinterlegte Adresse; wird er auf demselben Gerät
geöffnet, erscheint in der App ein Feld für das neue Passwort. Damit das
funktioniert, muss die Adresse der Seite in Supabase unter
*Authentication → URL Configuration → Redirect URLs* eingetragen sein.

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

## Push-Nachrichten

Ohne Einrichtung meldet sich die App nur, solange sie geöffnet ist. Für echte
Benachrichtigungen – auch bei geschlossener App – braucht es ein
VAPID-Schlüsselpaar und eine kleine Funktion auf dem Supabase-Projekt. Das ist
einmalige Arbeit von etwa zehn Minuten und kostet nichts.

1. **Schlüsselpaar erzeugen.** Am schnellsten geht das im Browser, ganz ohne
   Installation: *F12* drücken, Reiter **Console**, das hier einfügen und Enter.
   Die Schlüssel entstehen dabei auf deinem Rechner und verlassen ihn nicht.

   ```js
   const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)))
     .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const p = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'}, true, ['sign','verify']);
   console.log('PUBLIC :', b64(await crypto.subtle.exportKey('raw', p.publicKey)));
   console.log('PRIVATE:', (await crypto.subtle.exportKey('jwk', p.privateKey)).d);
   ```

   Der Schlüssel ist jeweils nur der Teil hinter `PUBLIC :` bzw. `PRIVATE:` –
   die Herkunftsangabe, die Chrome links danebenschreibt, gehört nicht dazu.

   Wer Node zur Hand hat, kann stattdessen `npx web-push generate-vapid-keys`
   nehmen; das Ergebnis ist dasselbe.

2. **Öffentlichen Schlüssel eintragen** in `public/sync-config.json` unter
   `vapidPublicKey`. Der gehört dorthin – er ist öffentlich, genau wie der
   `anon`-Key. Der **private** Schlüssel darf niemals in dieses Repository.

3. **Private Schlüssel als Supabase-Secret hinterlegen** und die Funktion
   ausrollen:

   ```bash
   supabase secrets set \
     VAPID_PUBLIC_KEY=... \
     VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:du@example.com
   supabase functions deploy notify-friends
   ```

4. **`supabase/schema.sql` noch einmal ausführen** – dabei entsteht die Tabelle
   `push_subscriptions`. Das Skript ist wiederholbar und ändert an vorhandenen
   Daten nichts.

5. In der App unter *Freunde* auf **„Bescheid geben, wenn Freunde trainiert
   haben"** tippen. Jedes Gerät meldet sich einzeln an.

Verschickt wird bewusst **nur ein Anstupser ohne Inhalt**: Bei den Push-Diensten
von Google und Apple sollen keine Trainingsdaten liegen. Die Benachrichtigung
lautet deshalb allgemein „Bei deinen Freunden hat sich etwas getan"; was
tatsächlich passiert ist, holt sich die App beim Öffnen selbst.

Auf dem iPhone funktioniert Push nur, wenn die App über *Zum Startbildschirm
hinzufügen* installiert wurde – das ist eine Vorgabe von Apple, keine der App.

## Wenn etwas schiefgeht

Gelöschtes lässt sich zurückholen: Nach dem Löschen einer Übung, eines
Trainings, eines Satzes, eines Plans, eines Gewichtseintrags, der Körpermaße
oder eines Fotos steht sieben Sekunden lang **Rückgängig** in der Meldung
unten. Danach ist es weg.

Das Datum eines Trainings lässt sich nachträglich ändern – *Datum ändern* in
der Trainingskarte. Steht am Zieltag schon etwas, sagt die App das vorher,
statt beides still zusammenzuwerfen.

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

**Automatische Sicherung am Konto.** Mit eingerichteter Synchronisierung lässt
sich unter *Profil → Daten* eine tägliche Sicherung einschalten; die letzten
vierzehn Tage bleiben liegen und lassen sich einzeln wiederherstellen. Das ist
etwas anderes als der laufende Abgleich: Der ist eine Spiegelung, und was man
löscht, ist Sekunden später auch dort gelöscht. Fortschrittsfotos sind wie
gehabt nicht dabei.

**Was an fremde Dienste geht.** Ohne Zutun: nichts. Die Übungssuche fragt
wger nur, während man tippt, und Anleitungen nur auf ausdrückliches Antippen.
Das Wetter ist standardmäßig aus; ist es an, geht der Ort auf zwei
Nachkommastellen gerundet an Open-Meteo – rund anderthalb Kilometer, ohne Konto
und ohne Kennung. Trainingsdaten verlassen das Gerät in keinem dieser Fälle.

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
├── api/           wger (Suche + Anleitungen), Open-Meteo (Wetter), Yazio
├── sync/          Konto, Freunde, Freigaben, Einladungslinks, Zusammenführen
├── components/    UI-Bausteine, Übungssuche, Detailansicht, Diagramme, Körperkarte
├── data/          Übungskatalog (216 Einträge) und Planvorlagen
├── lib/           Datum, Suche, Kalorien, Statistik, Muskeln, Scheiben, Ziele, ZIP, iCal
├── pages/         Heute, Pläne, Fortschritt, Kalorien, Freunde, Profil, Verlauf
├── storage/       Speicherung, Migration, globaler Zustand
└── types.ts       Datenmodell
```

Dazu `supabase/schema.sql` – das Datenbankschema samt Zugriffsregeln – und
`supabase/functions/notify-friends/` für die Push-Nachrichten.

Abhängigkeiten sind nur React und der Supabase-Client; Diagramme, Icons, Suche,
der ZIP-Schreiber und der Kalender-Export sind selbst geschrieben, damit die App
klein und offline-fähig bleibt. Nachgeladen wird konsequent: Beim Start kommt
nur „Heute" mit, alle anderen Seiten und die Dialoge folgen beim ersten
Antippen, das englische Wörterbuch nur bei englischer Spracheinstellung, und
der Supabase-Client erst, wenn die Synchronisierung wirklich eingerichtet ist.
Zusammen sind das beim Start rund 150 kB gepackt statt 204 kB.

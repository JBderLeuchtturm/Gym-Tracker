/**
 * Kompakter Uebungs-Katalog.
 * Format je Zeile:
 * name | nameEn | kategorie | art | primaerMuskeln | sekundaerMuskeln | equipment | met | aliase
 * Muskeln/Equipment/Aliase mit ";" getrennt.
 */
export const CATALOG_RAW = String.raw`
Bankdrücken (Langhantel)|Barbell Bench Press|chest|strength|Brust groß|Trizeps;Vordere Schulter|Langhantel;Flachbank|6|bench;bankdrücken flach;bd
Schrägbankdrücken (Langhantel)|Incline Barbell Bench Press|chest|strength|Brust groß (oberer Teil)|Vordere Schulter;Trizeps|Langhantel;Schrägbank|6|incline bench;schrägbank
Negativbankdrücken (Langhantel)|Decline Barbell Bench Press|chest|strength|Brust groß (unterer Teil)|Trizeps|Langhantel;Negativbank|6|decline bench
Bankdrücken (Kurzhantel)|Dumbbell Bench Press|chest|strength|Brust groß|Trizeps;Vordere Schulter|Kurzhanteln;Flachbank|6|kh bankdrücken;db press
Schrägbankdrücken (Kurzhantel)|Incline Dumbbell Press|chest|strength|Brust groß (oberer Teil)|Vordere Schulter;Trizeps|Kurzhanteln;Schrägbank|6|incline db press
Kurzhantel-Fliegende|Dumbbell Fly|chest|strength|Brust groß|Vordere Schulter|Kurzhanteln;Flachbank|5|flys;fliegende
Schrägbank-Fliegende|Incline Dumbbell Fly|chest|strength|Brust groß (oberer Teil)|Vordere Schulter|Kurzhanteln;Schrägbank|5|incline fly
Kabelzug-Fliegende (Crossover)|Cable Crossover|chest|strength|Brust groß|Vordere Schulter|Kabelzug|5|crossover;cable fly
Kabelzug-Fliegende von unten|Low Cable Fly|chest|strength|Brust groß (oberer Teil)|Vordere Schulter|Kabelzug|5|low fly
Butterfly (Maschine)|Pec Deck Machine|chest|strength|Brust groß|Vordere Schulter|Maschine|5|pec deck;peck deck
Brustpresse (Maschine)|Chest Press Machine|chest|strength|Brust groß|Trizeps;Vordere Schulter|Maschine|5.5|chest press
Liegestütze|Push-up|chest|bodyweight|Brust groß|Trizeps;Vordere Schulter;Rumpf|Körpergewicht|4|pushups;push ups;liegestütz
Liegestütze eng (Diamant)|Diamond Push-up|chest|bodyweight|Trizeps|Brust groß|Körpergewicht|5|diamond pushup
Liegestütze erhöht|Decline Push-up|chest|bodyweight|Brust groß (oberer Teil)|Trizeps;Vordere Schulter|Körpergewicht|5|decline pushup
Dips (Brustversion)|Chest Dips|chest|bodyweight|Brust groß (unterer Teil)|Trizeps;Vordere Schulter|Dip-Barren|6|dips brust
Überzüge (Kurzhantel)|Dumbbell Pullover|chest|strength|Brust groß|Latissimus;Trizeps|Kurzhantel;Flachbank|5|pullover
Klimmzüge (Obergriff)|Pull-up|back|bodyweight|Latissimus|Bizeps;Unterer Trapez|Klimmzugstange|8|pullups;pull ups;klimmzug
Klimmzüge (Untergriff)|Chin-up|back|bodyweight|Latissimus;Bizeps|Unterer Trapez|Klimmzugstange|8|chinups;chin ups
Klimmzüge weit|Wide Grip Pull-up|back|bodyweight|Latissimus|Bizeps;Rautenmuskeln|Klimmzugstange|8|wide pullup
Latzug (breit)|Lat Pulldown|back|strength|Latissimus|Bizeps;Unterer Trapez|Kabelzug;Latzugstange|5|latzug;pulldown
Latzug eng (Untergriff)|Close Grip Lat Pulldown|back|strength|Latissimus|Bizeps|Kabelzug|5|latzug eng
Langhantelrudern vorgebeugt|Barbell Bent Over Row|back|strength|Latissimus;Mittlerer Trapez|Bizeps;Rückenstrecker|Langhantel|6|barbell row;lh rudern
Langhantelrudern Untergriff|Underhand Barbell Row|back|strength|Latissimus|Bizeps|Langhantel|6|yates row
Kurzhantelrudern einarmig|One Arm Dumbbell Row|back|strength|Latissimus|Bizeps;Hintere Schulter|Kurzhantel;Flachbank|6|db row;kh rudern
T-Bar-Rudern|T-Bar Row|back|strength|Latissimus;Mittlerer Trapez|Bizeps|T-Bar;Langhantel|6|t bar row
Kabelrudern sitzend|Seated Cable Row|back|strength|Mittlerer Trapez;Latissimus|Bizeps;Rautenmuskeln|Kabelzug|5|cable row;rudern sitzend
Rudern (Maschine)|Machine Row|back|strength|Latissimus;Mittlerer Trapez|Bizeps|Maschine|5|machine row
Überzüge am Kabel|Straight Arm Pulldown|back|strength|Latissimus|Trizeps (lang)|Kabelzug|5|straight arm pulldown
Face Pulls|Face Pull|back|strength|Hintere Schulter;Mittlerer Trapez|Rotatorenmanschette|Kabelzug;Seil|5|face pull
Kreuzheben (konventionell)|Deadlift|back|strength|Rückenstrecker;Gesäß|Beinbizeps;Latissimus;Trapez|Langhantel|6|deadlift;kh heben
Sumo-Kreuzheben|Sumo Deadlift|legs|strength|Gesäß;Adduktoren|Quadrizeps;Rückenstrecker|Langhantel|6|sumo deadlift
Rumänisches Kreuzheben|Romanian Deadlift|legs|strength|Beinbizeps;Gesäß|Rückenstrecker|Langhantel|6|rdl;romanian deadlift
Kreuzheben gestreckte Beine|Stiff Leg Deadlift|legs|strength|Beinbizeps|Gesäß;Rückenstrecker|Langhantel|6|sldl
Rack Pulls|Rack Pull|back|strength|Rückenstrecker;Trapez|Gesäß|Langhantel;Power Rack|6|rack pull
Hyperextensions|Back Extension|back|bodyweight|Rückenstrecker|Gesäß;Beinbizeps|Römischer Stuhl|4|hyperextension;rückenstrecker
Good Mornings|Good Morning|back|strength|Beinbizeps;Rückenstrecker|Gesäß|Langhantel|5|good morning
Shrugs (Langhantel)|Barbell Shrug|back|strength|Trapez|Nacken|Langhantel|4.5|shrugs;nackenheben
Shrugs (Kurzhantel)|Dumbbell Shrug|back|strength|Trapez|Nacken|Kurzhanteln|4.5|kh shrugs
Kniebeugen (Langhantel)|Barbell Back Squat|legs|strength|Quadrizeps;Gesäß|Beinbizeps;Rückenstrecker|Langhantel;Squat Rack|6|squat;kniebeuge
Frontkniebeugen|Front Squat|legs|strength|Quadrizeps|Gesäß;Rumpf|Langhantel|6|front squat
Goblet Squat|Goblet Squat|legs|strength|Quadrizeps;Gesäß|Rumpf|Kurzhantel;Kettlebell|5.5|goblet
Beinpresse|Leg Press|legs|strength|Quadrizeps;Gesäß|Beinbizeps|Maschine|5.5|leg press
Hackenschmidt-Kniebeuge|Hack Squat|legs|strength|Quadrizeps|Gesäß|Maschine|5.5|hack squat
Beinstrecker|Leg Extension|legs|strength|Quadrizeps|-|Maschine|4.5|leg extension;beinstrecken
Beinbeuger liegend|Lying Leg Curl|legs|strength|Beinbizeps|Wade|Maschine|4.5|leg curl;beinbeugen
Beinbeuger sitzend|Seated Leg Curl|legs|strength|Beinbizeps|Wade|Maschine|4.5|seated leg curl
Ausfallschritte (Kurzhantel)|Dumbbell Lunge|legs|strength|Quadrizeps;Gesäß|Beinbizeps|Kurzhanteln|6|lunges;ausfallschritt
Gehende Ausfallschritte|Walking Lunge|legs|strength|Quadrizeps;Gesäß|Beinbizeps|Kurzhanteln|6.5|walking lunge
Bulgarische Kniebeuge|Bulgarian Split Squat|legs|strength|Quadrizeps;Gesäß|Beinbizeps|Kurzhanteln;Bank|6|split squat;bulgarian
Step-Ups|Step-Up|legs|strength|Quadrizeps;Gesäß|Beinbizeps|Kurzhanteln;Box|6|step up
Wadenheben stehend|Standing Calf Raise|legs|strength|Wade (Gastrocnemius)|Wade (Soleus)|Maschine|4|wadenheben;calf raise
Wadenheben sitzend|Seated Calf Raise|legs|strength|Wade (Soleus)|Wade (Gastrocnemius)|Maschine|4|seated calf
Wadenheben in der Beinpresse|Calf Press on Leg Press|legs|strength|Wade|-|Maschine|4|calf press
Adduktorenmaschine|Hip Adduction Machine|legs|strength|Adduktoren|-|Maschine|4|adduktoren
Abduktorenmaschine|Hip Abduction Machine|glutes|strength|Gesäß (mittel)|Abduktoren|Maschine|4|abduktoren
Hip Thrust|Barbell Hip Thrust|glutes|strength|Gesäß|Beinbizeps|Langhantel;Bank|5.5|hip thrust
Glute Bridge|Glute Bridge|glutes|bodyweight|Gesäß|Beinbizeps|Körpergewicht|4|bridge
Kickbacks am Kabel|Cable Glute Kickback|glutes|strength|Gesäß|Beinbizeps|Kabelzug|4.5|kickback
Nordic Hamstring Curl|Nordic Curl|legs|bodyweight|Beinbizeps|Gesäß|Körpergewicht|5|nordic curl
Schulterdrücken (Langhantel)|Overhead Press|shoulders|strength|Vordere Schulter;Seitliche Schulter|Trizeps;Rumpf|Langhantel|6|ohp;military press;schulterdrücken
Schulterdrücken (Kurzhantel)|Dumbbell Shoulder Press|shoulders|strength|Vordere Schulter;Seitliche Schulter|Trizeps|Kurzhanteln|6|db shoulder press
Arnold-Drücken|Arnold Press|shoulders|strength|Vordere Schulter;Seitliche Schulter|Trizeps|Kurzhanteln|6|arnold press
Schulterpresse (Maschine)|Shoulder Press Machine|shoulders|strength|Vordere Schulter|Trizeps|Maschine|5.5|shoulder press machine
Seitheben (Kurzhantel)|Dumbbell Lateral Raise|shoulders|strength|Seitliche Schulter|Trapez|Kurzhanteln|4.5|seitheben;lateral raise
Seitheben am Kabel|Cable Lateral Raise|shoulders|strength|Seitliche Schulter|Trapez|Kabelzug|4.5|cable lateral
Frontheben|Front Raise|shoulders|strength|Vordere Schulter|Brust groß|Kurzhanteln|4.5|frontheben
Reverse Flys (Kurzhantel)|Bent Over Reverse Fly|shoulders|strength|Hintere Schulter|Mittlerer Trapez|Kurzhanteln|4.5|reverse fly;butterfly reverse
Reverse Butterfly (Maschine)|Reverse Pec Deck|shoulders|strength|Hintere Schulter|Rautenmuskeln|Maschine|4.5|reverse pec deck
Aufrechtes Rudern|Upright Row|shoulders|strength|Seitliche Schulter;Trapez|Bizeps|Langhantel;SZ-Stange|5|upright row
Handstand-Liegestütze|Handstand Push-up|shoulders|bodyweight|Vordere Schulter|Trizeps;Rumpf|Körpergewicht|7|hspu
Langhantelcurls|Barbell Curl|arms|strength|Bizeps|Unterarm|Langhantel|4.5|curls;bizepscurls
SZ-Curls|EZ Bar Curl|arms|strength|Bizeps|Unterarm|SZ-Stange|4.5|ez curl;sz curls
Kurzhantelcurls|Dumbbell Curl|arms|strength|Bizeps|Unterarm|Kurzhanteln|4.5|db curl
Hammercurls|Hammer Curl|arms|strength|Bizeps;Brachialis|Unterarm|Kurzhanteln|4.5|hammer curl
Konzentrationscurls|Concentration Curl|arms|strength|Bizeps|-|Kurzhantel|4|concentration curl
Scottcurls (Preacher)|Preacher Curl|arms|strength|Bizeps|Unterarm|SZ-Stange;Scottbank|4.5|preacher curl;scottcurl
Schrägbankcurls|Incline Dumbbell Curl|arms|strength|Bizeps (langer Kopf)|Unterarm|Kurzhanteln;Schrägbank|4.5|incline curl
Kabelcurls|Cable Curl|arms|strength|Bizeps|Unterarm|Kabelzug|4.5|cable curl
Trizepsdrücken am Kabel|Triceps Pushdown|arms|strength|Trizeps|-|Kabelzug|4.5|pushdown;trizepsdrücken
Trizepsdrücken mit Seil|Rope Pushdown|arms|strength|Trizeps|-|Kabelzug;Seil|4.5|rope pushdown
Französisches Drücken|Skull Crusher|arms|strength|Trizeps|-|SZ-Stange;Flachbank|4.5|skullcrusher;french press
Überkopf-Trizepsdrücken|Overhead Triceps Extension|arms|strength|Trizeps (langer Kopf)|Schulter|Kurzhantel;Kabelzug|4.5|overhead extension
Enges Bankdrücken|Close Grip Bench Press|arms|strength|Trizeps|Brust groß;Vordere Schulter|Langhantel;Flachbank|6|close grip bench
Dips (Trizepsversion)|Triceps Dips|arms|bodyweight|Trizeps|Brust groß;Vordere Schulter|Dip-Barren|6|dips trizeps
Bankdips|Bench Dips|arms|bodyweight|Trizeps|Vordere Schulter|Bank|5|bench dips
Kickbacks (Trizeps)|Triceps Kickback|arms|strength|Trizeps|-|Kurzhanteln|4|triceps kickback
Unterarmcurls|Wrist Curl|arms|strength|Unterarm (Beuger)|-|Langhantel|3.5|wrist curl
Reverse Curls|Reverse Curl|arms|strength|Unterarm (Strecker);Brachialis|Bizeps|SZ-Stange|4|reverse curl
Farmers Walk|Farmers Walk|fullbody|strength|Unterarm;Trapez|Rumpf;Beine|Kurzhanteln|6|farmers walk
Plank|Plank|core|time|Rumpf (gerade)|Gesäß;Schulter|Körpergewicht|3.5|planke;unterarmstütz
Seitstütz|Side Plank|core|time|Rumpf (schräg)|Gesäß|Körpergewicht|3.5|side plank;seitliche planke
Crunches|Crunch|core|bodyweight|Rumpf (gerade)|-|Körpergewicht|3.5|crunch;bauchpressen
Beinheben hängend|Hanging Leg Raise|core|bodyweight|Rumpf (unterer Teil);Hüftbeuger|Unterarm|Klimmzugstange|4.5|leg raise;beinheben
Knieheben hängend|Hanging Knee Raise|core|bodyweight|Rumpf (unterer Teil)|Hüftbeuger|Klimmzugstange|4|knee raise
Beinheben liegend|Lying Leg Raise|core|bodyweight|Rumpf (unterer Teil)|Hüftbeuger|Körpergewicht|3.5|lying leg raise
Russian Twist|Russian Twist|core|bodyweight|Rumpf (schräg)|Rumpf (gerade)|Medizinball|4|russian twist
Bauchpresse am Kabel|Cable Crunch|core|strength|Rumpf (gerade)|-|Kabelzug;Seil|4|cable crunch
Ab Wheel Rollout|Ab Wheel Rollout|core|bodyweight|Rumpf (gerade)|Latissimus;Schulter|Bauchroller|4.5|ab wheel;rollout
Mountain Climbers|Mountain Climber|core|cardio|Rumpf|Schulter;Beine|Körpergewicht|8|mountain climber
Käfer (Dead Bug)|Dead Bug|core|bodyweight|Rumpf (tief)|Hüftbeuger|Körpergewicht|3|dead bug
Bird Dog|Bird Dog|core|bodyweight|Rumpf;Rückenstrecker|Gesäß|Körpergewicht|3|bird dog
Pallof Press|Pallof Press|core|strength|Rumpf (schräg)|Schulter|Kabelzug|3.5|pallof
Sit-ups|Sit-up|core|bodyweight|Rumpf (gerade)|Hüftbeuger|Körpergewicht|4|situps
Laufband|Treadmill Run|cardio|cardio|Herz-Kreislauf|Beine|Laufband|9.8|laufen;running;treadmill
Joggen draußen|Outdoor Running|cardio|cardio|Herz-Kreislauf|Beine|-|9.8|joggen;laufen
Gehen / Walking|Walking|cardio|cardio|Herz-Kreislauf|Beine|-|3.8|gehen;walken
Fahrrad-Ergometer|Stationary Bike|cardio|cardio|Herz-Kreislauf|Beine|Ergometer|7|radfahren;bike;fahrrad
Crosstrainer|Elliptical Trainer|cardio|cardio|Herz-Kreislauf|Beine;Arme|Crosstrainer|5|elliptical;crosstrainer
Rudergerät|Rowing Machine|cardio|cardio|Herz-Kreislauf|Rücken;Beine|Rudergerät|7|rudern ergometer;rowing
Stairmaster|Stair Climber|cardio|cardio|Herz-Kreislauf|Beine;Gesäß|Stairmaster|9|treppensteiger
Seilspringen|Jump Rope|cardio|cardio|Herz-Kreislauf|Waden|Springseil|11|seilspringen;rope skipping
Burpees|Burpee|fullbody|cardio|Ganzkörper|Brust;Beine|Körpergewicht|8|burpee
Battle Ropes|Battle Ropes|fullbody|cardio|Schulter;Rumpf|Arme|Seile|9|battle rope
Kettlebell Swing|Kettlebell Swing|fullbody|strength|Gesäß;Beinbizeps|Rumpf;Schulter|Kettlebell|9.8|kb swing;swings
Clean and Press|Clean and Press|fullbody|strength|Ganzkörper|Schulter;Beine|Langhantel|7|clean and press
Power Clean|Power Clean|fullbody|strength|Ganzkörper|Trapez;Beine|Langhantel|7|power clean
Snatch|Snatch|fullbody|strength|Ganzkörper|Schulter;Beine|Langhantel|7|reißen
Thruster|Thruster|fullbody|strength|Quadrizeps;Schulter|Rumpf;Trizeps|Langhantel;Kurzhanteln|8|thruster
Wall Balls|Wall Ball|fullbody|cardio|Quadrizeps;Schulter|Rumpf|Medizinball|8|wall ball
Box Jumps|Box Jump|legs|cardio|Quadrizeps;Waden|Gesäß|Box|8|box jump
Sprünge (Jump Squat)|Jump Squat|legs|cardio|Quadrizeps;Gesäß|Waden|Körpergewicht|8|jump squat
Sled Push|Sled Push|fullbody|cardio|Beine;Gesäß|Rumpf|Schlitten|9|prowler
Hüftbeuger-Dehnung|Hip Flexor Stretch|mobility|mobility|Hüftbeuger|Gesäß|Körpergewicht|2.3|hüftbeuger dehnen
Brustdehnung an der Wand|Doorway Chest Stretch|mobility|mobility|Brust groß|Vordere Schulter|-|2.3|brust dehnen
Katze-Kuh|Cat Cow|mobility|mobility|Wirbelsäule|Rumpf|Körpergewicht|2.3|cat cow
Foam Rolling|Foam Rolling|mobility|mobility|Faszien|-|Faszienrolle|2.5|blackroll;faszienrolle
Beinbizeps-Dehnung|Hamstring Stretch|mobility|mobility|Beinbizeps|Waden|-|2.3|hamstring stretch
Schulterkreisen|Shoulder Circles|mobility|mobility|Schulter|Trapez|-|2.5|schulterkreisen
90/90 Hüftmobilisation|90/90 Hip Mobility|mobility|mobility|Hüfte|Gesäß|-|2.5|90 90 hip
Landmine Press|Landmine Press|shoulders|strength|Vordere Schulter|Trizeps;Rumpf|Langhantel;Landmine|5.5|landmine press
Pendlay Row|Pendlay Row|back|strength|Latissimus;Mittlerer Trapez|Bizeps|Langhantel|6|pendlay
Meadows Row|Meadows Row|back|strength|Latissimus|Hintere Schulter;Bizeps|Langhantel;Landmine|6|meadows row
Chest Supported Row|Chest Supported Row|back|strength|Mittlerer Trapez;Latissimus|Bizeps;Hintere Schulter|Kurzhanteln;Schrägbank|5.5|chest supported row
Inverted Row|Inverted Row|back|bodyweight|Latissimus;Mittlerer Trapez|Bizeps|Smith-Maschine;Stange|5|australian pullup;ruderzug liegend
Zercher Squat|Zercher Squat|legs|strength|Quadrizeps;Rumpf|Gesäß|Langhantel|6|zercher
Sissy Squat|Sissy Squat|legs|bodyweight|Quadrizeps|Rumpf|Körpergewicht|5|sissy squat
Pistol Squat|Pistol Squat|legs|bodyweight|Quadrizeps;Gesäß|Rumpf|Körpergewicht|6|pistol squat;einbeinige kniebeuge
Smith-Maschine Kniebeuge|Smith Machine Squat|legs|strength|Quadrizeps;Gesäß|Beinbizeps|Smith-Maschine|5.5|smith squat
Smith-Maschine Bankdrücken|Smith Machine Bench Press|chest|strength|Brust groß|Trizeps|Smith-Maschine|5.5|smith bench
Trap-Bar-Kreuzheben|Trap Bar Deadlift|legs|strength|Quadrizeps;Gesäß|Rückenstrecker;Trapez|Trap Bar|6|trap bar deadlift;hex bar
Hip Abduction am Kabel|Cable Hip Abduction|glutes|strength|Gesäß (mittel)|Abduktoren|Kabelzug|4|cable abduction
Frog Pumps|Frog Pump|glutes|bodyweight|Gesäß|Beinbizeps|Körpergewicht|3.5|frog pump
Reverse Hyperextension|Reverse Hyper|glutes|strength|Gesäß;Rückenstrecker|Beinbizeps|Maschine|4.5|reverse hyper
Nackendrücken|Behind the Neck Press|shoulders|strength|Seitliche Schulter|Trizeps|Langhantel|5.5|nackendrücken
Cuban Press|Cuban Press|shoulders|strength|Rotatorenmanschette|Seitliche Schulter|Kurzhanteln|4|cuban press
Außenrotation am Kabel|Cable External Rotation|shoulders|strength|Rotatorenmanschette|Hintere Schulter|Kabelzug;Theraband|3.5|external rotation
Bizepscurl am Kabel über Kopf|Overhead Cable Curl|arms|strength|Bizeps|-|Kabelzug|4|overhead curl
Spider Curl|Spider Curl|arms|strength|Bizeps (kurzer Kopf)|Unterarm|Schrägbank;Kurzhanteln|4.5|spider curl
Zottman Curl|Zottman Curl|arms|strength|Bizeps;Unterarm|Brachialis|Kurzhanteln|4.5|zottman
JM Press|JM Press|arms|strength|Trizeps|Brust groß|Langhantel|5.5|jm press
Tate Press|Tate Press|arms|strength|Trizeps|-|Kurzhanteln|4.5|tate press
Handgelenk-Rollen|Wrist Roller|arms|strength|Unterarm|-|Wrist Roller|4|wrist roller
Toes to Bar|Toes to Bar|core|bodyweight|Rumpf (unterer Teil)|Latissimus;Hüftbeuger|Klimmzugstange|6|t2b;toes to bar
Hollow Hold|Hollow Body Hold|core|time|Rumpf (gerade)|Hüftbeuger|Körpergewicht|3.5|hollow hold
L-Sit|L-Sit|core|time|Rumpf;Hüftbeuger|Trizeps|Barren|4|l sit
Windmühle (Kettlebell)|Kettlebell Windmill|core|strength|Rumpf (schräg)|Schulter;Beinbizeps|Kettlebell|4|windmill
Woodchopper am Kabel|Cable Woodchopper|core|strength|Rumpf (schräg)|Schulter|Kabelzug|4|woodchop
Muscle-Up|Muscle-Up|fullbody|bodyweight|Latissimus;Trizeps|Brust groß;Rumpf|Klimmzugstange;Ringe|9|muscle up
Ring Dips|Ring Dips|chest|bodyweight|Brust groß;Trizeps|Vordere Schulter;Rumpf|Ringe|6|ring dips
Australian Pull-up|Ring Row|back|bodyweight|Latissimus;Mittlerer Trapez|Bizeps|Ringe|5|ring row
Sprint-Intervalle|Sprint Intervals|cardio|cardio|Herz-Kreislauf|Beine|-|14|sprints;hiit sprint
Schwimmen|Swimming|cardio|cardio|Herz-Kreislauf|Ganzkörper|Schwimmbad|8|schwimmen
Boxen (Sandsack)|Heavy Bag Boxing|cardio|cardio|Herz-Kreislauf;Schulter|Rumpf|Boxsack|7.8|boxen;sandsack
Assault Bike|Air Bike|cardio|cardio|Herz-Kreislauf|Beine;Arme|Assault Bike|9|air bike;assault bike
Skierg|Ski Erg|cardio|cardio|Herz-Kreislauf|Latissimus;Rumpf|SkiErg|8|ski erg
Wandsitzen|Wall Sit|legs|time|Quadrizeps|Gesäß|Körpergewicht|4|wall sit;wandsitz
Copenhagen Plank|Copenhagen Plank|core|time|Adduktoren;Rumpf (schräg)|Gesäß|Bank|4|copenhagen
Kurzhantel-Überzüge am Kabel|Cable Pullover|back|strength|Latissimus|Trizeps (lang)|Kabelzug|5|cable pullover
Einarmiges Latziehen|Single Arm Lat Pulldown|back|strength|Latissimus|Bizeps|Kabelzug|5|single arm pulldown
Bizeps Drag Curl|Drag Curl|arms|strength|Bizeps|Hintere Schulter|Langhantel|4.5|drag curl
Waden im Stehen (Kurzhantel)|Dumbbell Calf Raise|legs|strength|Wade|-|Kurzhanteln|4|db calf raise
Front Raise am Kabel|Cable Front Raise|shoulders|strength|Vordere Schulter|Brust groß|Kabelzug|4.5|cable front raise
Kniebeuge mit Pause|Pause Squat|legs|strength|Quadrizeps;Gesäß|Rumpf|Langhantel|6|pause squat
Bankdrücken mit Pause|Pause Bench Press|chest|strength|Brust groß|Trizeps|Langhantel|6|pause bench
Defizit-Kreuzheben|Deficit Deadlift|back|strength|Rückenstrecker;Gesäß|Beinbizeps|Langhantel;Plattform|6|deficit deadlift
Hantelbank-Rudern schwer|Seal Row|back|strength|Latissimus;Mittlerer Trapez|Bizeps|Langhantel;Bank|5.5|seal row
Kurzhantel-Schulterdrücken sitzend|Seated Dumbbell Press|shoulders|strength|Vordere Schulter|Trizeps|Kurzhanteln;Bank|5.5|seated db press
Beinpresse einbeinig|Single Leg Press|legs|strength|Quadrizeps;Gesäß|Beinbizeps|Maschine|5.5|single leg press
Hip Thrust einbeinig|Single Leg Hip Thrust|glutes|bodyweight|Gesäß|Beinbizeps|Bank|4.5|single leg hip thrust
Rudern am Kabel eng|Close Grip Cable Row|back|strength|Latissimus|Bizeps;Mittlerer Trapez|Kabelzug|5|close grip row
Kurzhantel-Fliegende am Boden|Floor Fly|chest|strength|Brust groß|Vordere Schulter|Kurzhanteln|4.5|floor fly
Floor Press|Floor Press|chest|strength|Brust groß;Trizeps|Vordere Schulter|Langhantel;Kurzhanteln|5.5|floor press
Klimmzüge mit Zusatzgewicht|Weighted Pull-up|back|strength|Latissimus|Bizeps|Klimmzugstange;Gewichtsgürtel|8|weighted pullup
Dips mit Zusatzgewicht|Weighted Dips|chest|strength|Brust groß;Trizeps|Vordere Schulter|Dip-Barren;Gewichtsgürtel|6.5|weighted dips
Nackenstrecker (Neck Curl)|Neck Curl|other|strength|Nacken|-|Kopfharness|3.5|neck curl
Griffkraft (Gripper)|Grip Trainer|other|strength|Unterarm|-|Handtrainer|3|gripper
Beckenlift auf dem Ball|Stability Ball Hip Raise|glutes|bodyweight|Gesäß|Beinbizeps;Rumpf|Gymnastikball|3.5|ball hip raise
Beinbeuger am Ball|Stability Ball Leg Curl|legs|bodyweight|Beinbizeps|Gesäß|Gymnastikball|4|ball leg curl
Rückwärts gehende Ausfallschritte|Reverse Lunge|legs|strength|Gesäß;Quadrizeps|Beinbizeps|Kurzhanteln|6|reverse lunge
Seitliche Ausfallschritte|Lateral Lunge|legs|strength|Adduktoren;Quadrizeps|Gesäß|Kurzhanteln|5.5|lateral lunge
Curtsy Lunge|Curtsy Lunge|glutes|strength|Gesäß (mittel)|Quadrizeps|Kurzhanteln|5.5|curtsy
Monster Walk (Band)|Banded Monster Walk|glutes|bodyweight|Gesäß (mittel)|Abduktoren|Theraband|4|monster walk
Clamshells|Clamshell|glutes|bodyweight|Gesäß (mittel)|Abduktoren|Theraband|3|clamshell
Superman|Superman|back|bodyweight|Rückenstrecker|Gesäß;Schulter|Körpergewicht|3.5|superman
Scapula Pull-ups|Scapular Pull-up|back|bodyweight|Unterer Trapez|Latissimus|Klimmzugstange|4.5|scap pullup
Y-Raises|Prone Y Raise|shoulders|strength|Unterer Trapez;Hintere Schulter|Rotatorenmanschette|Kurzhanteln;Schrägbank|4|y raise
Trap-3-Raise|Trap 3 Raise|shoulders|strength|Unterer Trapez|Hintere Schulter|Kurzhantel|4|trap 3
Kabelzug-Seitheben einarmig|Single Arm Cable Lateral Raise|shoulders|strength|Seitliche Schulter|Trapez|Kabelzug|4.5|single arm lateral
Bauchmaschine|Ab Crunch Machine|core|strength|Rumpf (gerade)|-|Maschine|4|ab machine
Rumpfrotation Maschine|Torso Rotation Machine|core|strength|Rumpf (schräg)|-|Maschine|4|torso rotation
Hüftheben am Barren|Captains Chair Leg Raise|core|bodyweight|Rumpf (unterer Teil)|Hüftbeuger|Barren|4.5|captains chair
Kurzhantel-Seitbeugen|Dumbbell Side Bend|core|strength|Rumpf (schräg)|Rückenstrecker|Kurzhantel|3.5|side bend
Turkish Get-Up|Turkish Get-Up|fullbody|strength|Ganzkörper|Schulter;Rumpf|Kettlebell|6|tgu;get up
Bear Crawl|Bear Crawl|fullbody|cardio|Rumpf;Schulter|Beine|Körpergewicht|7|bear crawl
Devils Press|Devils Press|fullbody|cardio|Ganzkörper|Schulter|Kurzhanteln|9|devils press
Renegade Row|Renegade Row|fullbody|strength|Latissimus;Rumpf|Bizeps;Schulter|Kurzhanteln|6|renegade row
Man Maker|Man Maker|fullbody|cardio|Ganzkörper|Schulter;Beine|Kurzhanteln|9|man maker
Sandsack-Träger|Sandbag Carry|fullbody|strength|Rumpf;Rücken|Beine|Sandsack|6.5|sandbag carry
Yoke Walk|Yoke Walk|fullbody|strength|Rumpf;Beine|Trapez|Yoke|7|yoke walk
Atlas Stone Lift|Atlas Stone|fullbody|strength|Rückenstrecker;Gesäß|Bizeps;Rumpf|Atlas Stone|7.5|atlas stone
Sled Drag|Sled Drag|legs|cardio|Quadrizeps;Gesäß|Waden|Schlitten|8|sled drag
Hip Airplane|Hip Airplane|mobility|mobility|Hüfte;Gesäß|Rumpf|-|3|hip airplane
Jefferson Curl|Jefferson Curl|mobility|mobility|Rückenstrecker;Beinbizeps|Rumpf|Kurzhantel|3|jefferson curl
Couch Stretch|Couch Stretch|mobility|mobility|Hüftbeuger;Quadrizeps|-|-|2.3|couch stretch
Weltgrößte Dehnung|Worlds Greatest Stretch|mobility|mobility|Hüfte;Brustwirbelsäule|Beinbizeps|-|3|worlds greatest stretch
Ausfallschritt im Gehen mit Rotation|Lunge with Twist|mobility|mobility|Hüfte;Rumpf (schräg)|Quadrizeps|-|3.5|lunge twist
`;

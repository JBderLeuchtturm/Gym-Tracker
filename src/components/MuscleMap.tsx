import { t } from '../i18n';
import { REGION_LABELS, type MuscleRegion } from '../lib/muscles';

/**
 * Koerperkarte von vorne und hinten.
 *
 * Die Figur ist bewusst schlicht gezeichnet - keine anatomische Studie,
 * sondern klar unterscheidbare Flaechen, die auch auf einem Handydisplay
 * lesbar bleiben. Alles ist selbst gezeichnet; fremde Abbildungen waeren
 * urheberrechtlich nicht nutzbar.
 */

/**
 * Faerbung einer Region.
 * - primary/secondary/none: Ziel- und Hilfsmuskeln einer Uebung
 * - off/none/low/mid/good/over: Ampel gegen das Wochenziel
 * - Zahl 0..1: gleitender Verlauf fuer eine reine Belastungskarte
 */
export type Intensity =
  | 'primary' | 'secondary' | 'none'
  | 'off' | 'low' | 'mid' | 'good' | 'over';

interface Shape {
  region: MuscleRegion;
  /** Pfad der linken Koerperhaelfte (Bildseite). */
  d: string;
  /** Wird die Form an der Mittelachse gespiegelt noch einmal gezeichnet? */
  mirror?: boolean;
}

/*
 * Alle Formen sind fuer die linke Bildhaelfte gezeichnet und werden bei Bedarf
 * an x = 100 gespiegelt. Das haelt die Figur zwangslaeufig symmetrisch und
 * halbiert die Pfadarbeit.
 */

const FRONT: Shape[] = [
  { region: 'neck', d: 'M92 44 h8 v15 q-5 3 -8 1 q-2 -8 0 -16 z', mirror: true },
  { region: 'trapezius', d: 'M98 60 q-14 3 -23 11 q12 -4 23 -5 z', mirror: true },
  { region: 'deltoids', d: 'M75 66 q-17 6 -22 23 q-2 9 0 15 q12 -6 17 -18 q4 -12 5 -20 z', mirror: true },
  { region: 'chest', d: 'M98 76 q-16 2 -22 9 q-4 11 0 22 q11 5 22 2 q3 -17 0 -33 z', mirror: true },
  { region: 'biceps', d: 'M55 104 q-12 9 -14 25 q-2 9 0 14 q10 -8 12 -20 q3 -12 2 -19 z', mirror: true },
  { region: 'forearms', d: 'M50 150 q-9 14 -10 32 q-1 10 2 13 q8 -9 10 -26 q2 -13 -2 -19 z', mirror: true },
  { region: 'abs', d: 'M89 116 h11 v50 h-11 q-3 -25 0 -50 z', mirror: true },
  { region: 'obliques', d: 'M86 118 q-7 5 -8 17 q-1 15 3 28 q4 -3 5 -9 q-2 -18 0 -36 z', mirror: true },
  { region: 'adductors', d: 'M91 176 q-4 22 -3 46 q5 3 8 -1 q1 -24 0 -45 z', mirror: true },
  { region: 'quads', d: 'M88 174 q-14 6 -16 30 q-2 26 3 48 q7 3 11 -2 q3 -38 2 -76 z', mirror: true },
  { region: 'calves', d: 'M89 264 q-12 14 -13 34 q-1 13 3 18 q9 -9 12 -27 q2 -17 -2 -25 z', mirror: true },
];

const BACK: Shape[] = [
  { region: 'neck', d: 'M92 44 h8 v14 q-5 3 -8 1 q-2 -8 0 -15 z', mirror: true },
  { region: 'trapezius', d: 'M100 58 q-20 4 -29 14 q11 18 29 24 z', mirror: true },
  { region: 'deltoids', d: 'M75 66 q-17 6 -22 23 q-2 9 0 15 q12 -6 17 -18 q4 -12 5 -20 z', mirror: true },
  { region: 'lats', d: 'M99 100 q-18 3 -24 13 q-1 19 5 33 q10 4 19 -2 q3 -22 0 -44 z', mirror: true },
  { region: 'triceps', d: 'M55 102 q-12 9 -14 25 q-2 9 0 14 q10 -8 12 -20 q3 -12 2 -19 z', mirror: true },
  { region: 'forearms', d: 'M50 150 q-9 14 -10 32 q-1 10 2 13 q8 -9 10 -26 q2 -13 -2 -19 z', mirror: true },
  { region: 'lowerback', d: 'M89 150 h11 v24 h-11 q-3 -12 0 -24 z', mirror: true },
  { region: 'glutes', d: 'M99 174 q-14 1 -20 12 q-1 14 6 21 q9 4 14 -4 q2 -14 0 -29 z', mirror: true },
  { region: 'hamstrings', d: 'M88 212 q-13 6 -15 26 q-2 20 3 36 q7 3 11 -2 q3 -30 1 -60 z', mirror: true },
  { region: 'calves', d: 'M89 270 q-12 14 -13 34 q-1 13 3 18 q9 -9 12 -27 q2 -17 -2 -25 z', mirror: true },
];

/** Umriss: Kopf, Hals und Rumpf mittig, Arm und Bein je Seite gespiegelt. */
const SILHOUETTE_CENTER = [
  'M100 9 q15 0 15 19 q0 19 -15 19 q-15 0 -15 -19 q0 -19 15 -19 z',
  'M91 42 h9 v18 h-9 z',
  // Rumpf mit Taille: Schulter 70, Taille 74, Huefte 71
  'M100 58 C 88 59, 78 63, 71 71 C 67 84, 66 96, 67 108 C 68 122, 72 132, 74 142 C 75 154, 73 162, 72 170 L 100 170 Z',
];

const SILHOUETTE_SIDE = [
  // Arm - deutlich abgesetzt, damit sich die Muskeln zuordnen lassen
  'M72 68 C 58 74, 46 92, 41 122 C 37 152, 35 180, 36 201 C 36 209, 41 212, 45 211 C 49 210, 51 205, 51 198 C 51 176, 53 152, 57 126 C 61 100, 68 82, 78 74 Z',
  // Bein - schlanker, damit zwei Beine erkennbar bleiben
  'M72 168 C 68 192, 65 222, 66 252 C 67 288, 69 318, 73 340 C 74 347, 79 348, 83 346 C 87 344, 89 336, 89 326 C 90 300, 92 274, 94 246 C 95 218, 97 190, 98 168 Z',
];

export function MuscleMap({
  view, intensity, onSelect, selected, size = 190,
}: {
  view: 'front' | 'back';
  /** Farbstaerke je Region. */
  intensity: (region: MuscleRegion) => Intensity | number;
  onSelect?: (region: MuscleRegion) => void;
  selected?: MuscleRegion | null;
  size?: number;
}) {
  const shapes = view === 'front' ? FRONT : BACK;

  const fillFor = (region: MuscleRegion): { fill: string; opacity: number } => {
    const value = intensity(region);
    if (typeof value === 'number') {
      // Zahl zwischen 0 und 1: gleitender Verlauf fuer die Belastungskarte.
      if (value <= 0) return { fill: 'var(--surface-3)', opacity: 1 };
      return { fill: 'var(--accent)', opacity: 0.25 + value * 0.75 };
    }
    switch (value) {
      case 'primary': return { fill: 'var(--accent)', opacity: 1 };
      case 'secondary': return { fill: 'var(--accent)', opacity: 0.42 };
      case 'low': return { fill: 'var(--danger)', opacity: 0.85 };
      case 'mid': return { fill: 'var(--warn)', opacity: 0.85 };
      case 'good': return { fill: 'var(--success)', opacity: 0.9 };
      case 'over': return { fill: 'var(--violet)', opacity: 0.85 };
      default: return { fill: 'var(--surface-3)', opacity: 1 };
    }
  };

  return (
    <svg
      viewBox="0 0 200 360"
      width={size}
      height={size * 1.8}
      role="img"
      aria-label={view === 'front' ? t('Körper von vorne') : t('Körper von hinten')}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <g fill="var(--body-fill)" stroke="var(--body-line)" strokeWidth="1.2" pointerEvents="none">
        {SILHOUETTE_CENTER.map((d, index) => <path key={`c${index}`} d={d} />)}
        {SILHOUETTE_CENTER.map((d, index) => (
          <path key={`cm${index}`} d={d} transform="translate(200,0) scale(-1,1)" />
        ))}
        {SILHOUETTE_SIDE.map((d, index) => <path key={`s${index}`} d={d} />)}
        {SILHOUETTE_SIDE.map((d, index) => (
          <path key={`sm${index}`} d={d} transform="translate(200,0) scale(-1,1)" />
        ))}
      </g>

      {shapes.map((shape) => {
        const { fill, opacity } = fillFor(shape.region);
        const isSelected = selected === shape.region;
        return (
          <g
            key={shape.region}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? t(REGION_LABELS[shape.region]) : undefined}
            aria-pressed={onSelect ? isSelected : undefined}
            onClick={onSelect ? () => onSelect(shape.region) : undefined}
            onKeyDown={onSelect ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(shape.region);
              }
            } : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            <title>{t(REGION_LABELS[shape.region])}</title>
            <path
              d={shape.d}
              fill={fill}
              fillOpacity={opacity}
              stroke={isSelected ? 'var(--text)' : 'var(--body-line)'}
              strokeWidth={isSelected ? 1.6 : 0.7}
            />
            {shape.mirror && (
              <path
                d={shape.d}
                transform="translate(200,0) scale(-1,1)"
                fill={fill}
                fillOpacity={opacity}
                stroke={isSelected ? 'var(--text)' : 'var(--body-line)'}
                strokeWidth={isSelected ? 1.6 : 0.7}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Beide Ansichten nebeneinander. Ueberall dort verwendet, wo der ganze
 * Koerper gezeigt wird - Uebungsdetails, Uebungssuche, Auswertung.
 */
export function BodyMap({
  intensity, onSelect, selected, size = 150,
}: {
  intensity: (region: MuscleRegion) => Intensity | number;
  onSelect?: (region: MuscleRegion) => void;
  selected?: MuscleRegion | null;
  size?: number;
}) {
  return (
    <div className="bodymap">
      {(['front', 'back'] as const).map((view) => (
        <div key={view} className="bodymap__side">
          <MuscleMap
            view={view}
            intensity={intensity}
            onSelect={onSelect}
            selected={selected}
            size={size}
          />
          <div className="tiny dim">{view === 'front' ? t('Vorne') : t('Hinten')}</div>
        </div>
      ))}
    </div>
  );
}

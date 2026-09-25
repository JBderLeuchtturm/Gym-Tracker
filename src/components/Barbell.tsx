import { t } from '../i18n';
import { describePlates, platesFor } from '../lib/plates';
import { fmt } from './ui';

/*
 * Die beladene Stange.
 *
 * Die Scheiben tragen die Farben der Wettkampfscheiben - rot 25, blau 20,
 * gelb 15, gruen 10, weiss 5 - und dieselbe Farbe wie ueberall sonst in der
 * App. Man sieht also nicht nur "82,5", sondern gleich, was man vom Staender
 * holt: je Seite eine rote, eine weisse, eine kleine.
 */

/** Hoehe und Dicke einer Scheibe in px - schwer heisst gross und dick. */
const PLATE_SHAPES: Array<[number, number, number]> = [
  // [ab kg, Hoehe, Dicke]
  [25, 48, 14],
  [20, 44, 13],
  [15, 38, 12],
  [10, 32, 11],
  [5, 24, 9],
  [2.5, 18, 7],
  [1, 14, 6],
  [0, 11, 5],
];

const shapeOf = (kg: number): { height: number; width: number } => {
  const [, height, width] = PLATE_SHAPES.find(([min]) => kg >= min) ?? PLATE_SHAPES[PLATE_SHAPES.length - 1];
  return { height, width };
};

/** Die Farbe folgt dem Gewicht - auch bei den kleinen Wechselscheiben (2,5 rot, 2 blau …). */
export function plateColor(kg: number): string {
  const byWeight: Record<string, string> = {
    25: 'var(--plate-25)', 20: 'var(--plate-20)', 15: 'var(--plate-15)', 10: 'var(--plate-10)', 5: 'var(--plate-5)',
    2.5: 'var(--plate-25)', 2: 'var(--plate-20)', 1.5: 'var(--plate-15)', 1: 'var(--plate-10)', 0.5: 'var(--plate-5)',
  };
  return byWeight[String(kg)] ?? 'var(--plate-chrome)';
}

export function Barbell({
  weightKg, barKg, plates,
}: {
  weightKg: number;
  barKg: number;
  plates: number[];
}) {
  const loaded = platesFor(weightKg, barKg, plates);
  if (!loaded) return null;

  const label = loaded.perSide.length > 0
    ? t('Je Seite: {plates}', { plates: describePlates(loaded.perSide) })
    : t('Nur die Stange');
  /* Die schweren Scheiben sitzen innen am Kragen, die kleinen aussen. */
  const side = (which: 'left' | 'right') => {
    const order = which === 'right' ? loaded.perSide : [...loaded.perSide].reverse();
    return order.map((kg, index) => {
      const { height, width } = shapeOf(kg);
      return (
        <span
          key={`${kg}-${index}`}
          className={`loadbar__plate ${kg === 5 || kg === 0.5 ? 'loadbar__plate--light' : ''}`}
          style={{ height, width, background: plateColor(kg) }}
        />
      );
    });
  };

  return (
    <div className="loadbar" role="img" aria-label={label}>
      <span className="loadbar__sleeve" />
      {side('left')}
      <span className="loadbar__collar" />
      <span className="loadbar__center">
        <span className="loadbar__kg">{loaded.totalKg.toLocaleString('de-DE')}</span>
        <span className="loadbar__sub">
          {loaded.perSide.length > 0 ? describePlates(loaded.perSide) : t('Stange {kg} kg', { kg: fmt(barKg, barKg % 1 ? 1 : 0) })}
        </span>
      </span>
      <span className="loadbar__collar" />
      {side('right')}
      <span className="loadbar__sleeve" />
    </div>
  );
}

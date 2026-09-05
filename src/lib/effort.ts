/**
 * RPE und RIR sind dieselbe Aussage, von zwei Seiten gelesen.
 *
 * RPE 8 heisst "zwei Wiederholungen waeren noch gegangen", RIR 2 sagt genau
 * das. Gespeichert wird nur RPE - zwei Felder fuer eine Aussage laufen frueher
 * oder spaeter auseinander, und dann weiss niemand mehr, welches gilt.
 */

/** Angezeigter Wert aus dem gespeicherten RPE. */
export const fromRpe = (rpe: number | null, useRir: boolean): number | null => {
  if (rpe == null) return null;
  return useRir ? Math.max(0, Math.round((10 - rpe) * 10) / 10) : rpe;
};

/** Eingetippter Wert zurueck nach RPE. */
export const toRpe = (value: number | null, useRir: boolean): number | null => {
  if (value == null) return null;
  const rpe = useRir ? 10 - value : value;
  return Math.min(10, Math.max(1, Math.round(rpe * 10) / 10));
};

export const effortLabel = (useRir: boolean): string => (useRir ? 'RIR' : 'RPE');

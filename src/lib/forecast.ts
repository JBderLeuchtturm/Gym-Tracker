import { t } from '../i18n';
import { parseISODate, toISODate } from './date';

/**
 * Hochrechnung.
 *
 * Eine gerade Linie durch die letzten Einheiten, mehr nicht. Kraftzuwachs
 * verlaeuft nicht linear und flacht mit der Zeit ab - deshalb steht bei jeder
 * Aussage dabei, wie gut die Linie ueberhaupt passt, und weit entfernte Ziele
 * werden gar nicht erst datiert. Lieber keine Zahl als eine erfundene.
 */

export interface Trend {
  /** Steigung in Einheiten pro Tag. */
  slopePerDay: number;
  /** Achsenabschnitt, bezogen auf den ersten Datenpunkt. */
  intercept: number;
  /** Bestimmtheitsmass 0..1 - wie gut die Gerade die Punkte trifft. */
  fit: number;
  first: { date: string; value: number };
  last: { date: string; value: number };
  points: number;
}

export function linearTrend(
  series: Array<{ date: string; value: number }>,
): Trend | null {
  const clean = series.filter((point) => Number.isFinite(point.value) && point.value > 0);
  if (clean.length < 4) return null;

  const originMs = parseISODate(clean[0].date).getTime();
  const xs = clean.map((point) => (parseISODate(point.date).getTime() - originMs) / 86400000);
  const ys = clean.map((point) => point.value);

  const n = clean.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let index = 0; index < n; index += 1) {
    sxy += (xs[index] - meanX) * (ys[index] - meanY);
    sxx += (xs[index] - meanX) ** 2;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let index = 0; index < n; index += 1) {
    const predicted = intercept + slope * xs[index];
    ssRes += (ys[index] - predicted) ** 2;
    ssTot += (ys[index] - meanY) ** 2;
  }
  const fit = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return {
    slopePerDay: slope,
    intercept,
    fit,
    first: clean[0],
    last: clean[clean.length - 1],
    points: n,
  };
}

export interface Projection {
  /** Erwartetes Datum, yyyy-mm-dd. */
  date: string;
  days: number;
  /** Wie belastbar ist die Aussage? */
  confidence: 'gut' | 'grob' | 'vage';
}

/**
 * Wann waere das Ziel erreicht, wenn es so weiterginge?
 *
 * null, wenn es nicht vorangeht, das Ziel schon erreicht ist oder mehr als
 * zwei Jahre entfernt laege - so weit vorauszurechnen waere Kaffeesatz.
 */
export function projectTarget(trend: Trend | null, targetValue: number): Projection | null {
  if (!trend || trend.slopePerDay <= 0) return null;
  if (targetValue <= trend.last.value) return null;

  const days = Math.ceil((targetValue - trend.last.value) / trend.slopePerDay);
  if (!Number.isFinite(days) || days <= 0 || days > 730) return null;

  const date = toISODate(new Date(parseISODate(trend.last.date).getTime() + days * 86400000));
  const confidence = trend.fit >= 0.7 && trend.points >= 6
    ? 'gut'
    : trend.fit >= 0.4
      ? 'grob'
      : 'vage';

  return { date, days, confidence };
}

/** Zuwachs je Monat, wie er sich aus der Steigung ergibt. */
export function perMonth(trend: Trend | null): number | null {
  if (!trend) return null;
  return trend.slopePerDay * 30.44;
}

export const CONFIDENCE_LABELS: Record<Projection['confidence'], string> = {
  gut: 'ziemlich gleichmäßiger Verlauf',
  grob: 'schwankender Verlauf',
  vage: 'sehr schwankend – mit Vorsicht',
};

/** Ein nächstes rundes Ziel oberhalb des aktuellen Werts. */
export function nextRoundGoal(value: number): number {
  if (value <= 0) return 20;
  const step = value < 60 ? 5 : value < 150 ? 10 : 20;
  return Math.floor(value / step) * step + step;
}

export const describeProjection = (projection: Projection): string =>
  t('in etwa {days} Tagen', { days: projection.days });

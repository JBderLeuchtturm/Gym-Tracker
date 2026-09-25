import { exerciseName, t } from '../i18n';
import { useEffect, useState } from 'react';
import type { Exercise, SetLog, TrackingMode } from '../types';
import { fieldsOf, targetText } from '../lib/tracking';
import type { PlanExercise } from '../types';
import { formatClock } from '../lib/date';
import { usesBarbell } from '../lib/plates';
import { useWakeLock } from '../lib/wakeLock';
import { Barbell } from './Barbell';
import { fmt } from './ui';
import { IconCheck, IconChevronLeft, IconChevronRight, IconSettings, IconTrophy, IconX } from './icons';

/*
 * Die Fokus-Ansicht.
 *
 * Zwischen zwei Saetzen will man nur drei Dinge wissen: was liegt drauf, wie
 * oft, und wie lange noch Pause. Die Trainingsseite zeigt alles - den Tag, die
 * anderen Uebungen, die Wochenziele. Hier steht nur der eine Satz, so gross,
 * dass man ihn von der Bank aus liest, und ein Haken, den man mit dem
 * Handschuh trifft.
 */

export interface FocusItem {
  key: string;
  exercise: Exercise | undefined;
  tracking: TrackingMode;
  sets: SetLog[];
  planExercise?: PlanExercise;
}

type BigField = 'weightKg' | 'reps' | 'durationSec' | 'distanceKm';

/** Der Satz, an dem man steht - wie auf der Karte: erster offener Arbeitssatz. */
const currentOf = (sets: SetLog[]): SetLog | null =>
  sets.find((set) => !set.done && !set.skipped) ?? null;

export function FocusView({
  items, activeKey, onActiveChange, restEndsAt, onExtendRest, onEndRest, flashSet,
  barKg, plates, onPatchSet, onToggleSet, onAdjust, onClose,
}: {
  items: FocusItem[];
  activeKey: string;
  onActiveChange: (key: string) => void;
  restEndsAt: number | null;
  onExtendRest: () => void;
  onEndRest: () => void;
  /** Satz, an dem gerade eine Bestleistung passiert ist. */
  flashSet: string | null;
  barKg: number;
  plates: number[];
  onPatchSet: (key: string, setId: string, patch: Partial<SetLog>) => void;
  onToggleSet: (key: string, setId: string) => void;
  onAdjust: (key: string) => void;
  onClose: () => void;
}) {
  useWakeLock(true);
  const [now, setNow] = useState(() => Date.now());
  const [justDone, setJustDone] = useState<string | null>(null);

  useEffect(() => {
    if (!restEndsAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [restEndsAt]);

  /*
   * Escape schliesst - am Rechner, der neben dem Rack steht. Liegt ein Fenster
   * darueber ("Anpassen", Rangaufstieg), schliesst Escape erst das.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.modal')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const position = Math.max(0, items.findIndex((item) => item.key === activeKey));
  const item = items[position];
  if (!item) return null;

  const fields = fieldsOf(item.tracking);
  const working = item.sets.filter((set) => !set.isWarmup);
  const current = currentOf(item.sets);
  const currentNumber = current && !current.isWarmup ? working.indexOf(current) + 1 : 0;
  const setLabel = !current
    ? t('Alle Sätze geschafft')
    : current.isWarmup
      ? t('Aufwärmsatz')
      : t('Satz {n} von {total}', { n: currentNumber, total: working.length });
  const next = items.slice(position + 1).find((candidate) => currentOf(candidate.sets))
    ?? items.slice(0, position).find((candidate) => currentOf(candidate.sets));
  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const resting = restEndsAt !== null && restLeft > 0;

  const kgStep = usesBarbell(item.exercise)
    ? Math.min(...(plates.length > 0 ? plates : [1.25])) * 2
    : 2.5;

  const bump = (field: BigField, delta: number) => {
    if (!current) return;
    const value = current[field] ?? 0;
    const digits = field === 'distanceKm' ? 10 : 100;
    // Leere Stange: Das erste "+" legt die Stange auf.
    const nextValue = field === 'weightKg' && !value && delta > 0 && usesBarbell(item.exercise)
      ? barKg
      : Math.max(0, Math.round((value + delta) * digits) / digits);
    onPatchSet(item.key, current.id, { [field]: nextValue });
  };

  const complete = () => {
    if (!current) return;
    setJustDone(current.id);
    window.setTimeout(() => setJustDone((value) => (value === current.id ? null : value)), 900);
    onToggleSet(item.key, current.id);
  };

  const values: Array<{ field: BigField; label: string; text: string; step: number }> = [];
  if (current) {
    if (fields.weight) {
      values.push({
        field: 'weightKg', label: t('kg'), step: kgStep,
        text: current.weightKg != null ? current.weightKg.toLocaleString('de-DE') : '–',
      });
    }
    if (fields.reps) values.push({ field: 'reps', label: t('Wdh'), step: 1, text: current.reps != null ? String(current.reps) : '–' });
    if (fields.distance) {
      values.push({ field: 'distanceKm', label: t('km'), step: 0.1, text: current.distanceKm != null ? fmt(current.distanceKm, 1) : '–' });
    }
    if (fields.time) {
      const minutes = item.tracking === 'distance_time';
      values.push({
        field: 'durationSec', label: minutes ? t('min') : t('Zeit'), step: minutes ? 60 : 5,
        text: current.durationSec != null ? formatClock(current.durationSec) : '–',
      });
    }
  }

  const record = flashSet != null && item.sets.some((set) => set.id === flashSet);
  const go = (delta: number) => {
    const target = items[position + delta];
    if (target) onActiveChange(target.key);
  };

  return (
    <div className="focus" role="dialog" aria-modal="true" aria-label={t('Fokus-Ansicht')}>
      <div className="focus__top">
        <button className="focus__icon" onClick={onClose} aria-label={t('Fokus-Ansicht schließen')}>
          <IconX />
        </button>
        <span className="focus__count">{t('Übung {n}/{total}', { n: position + 1, total: items.length })}</span>
        <button className="focus__icon" onClick={() => onAdjust(item.key)} aria-label={t('Übung anpassen')}>
          <IconSettings />
        </button>
      </div>

      <div className="focus__head">
        <h2 className="focus__name">{exerciseName(item.exercise)}</h2>
        {item.planExercise && (
          <div className="focus__target">{targetText(item.planExercise, item.tracking)}</div>
        )}
        {/* Die Saetze als Punkte: erledigt gruen, der aktuelle mit Warnstreifen. */}
        <div className="focus__pips">
          {working.map((set) => (
            <span
              key={set.id}
              className={[
                'focus__pip',
                set.done ? 'focus__pip--done' : '',
                set.skipped ? 'focus__pip--skipped' : '',
                current?.id === set.id ? 'focus__pip--now' : '',
              ].filter(Boolean).join(' ')}
            />
          ))}
          <span className="focus__pip-label">{setLabel}</span>
        </div>
      </div>

      {/* Kurzer gruener Stempel: angekommen, abgehakt. */}
      {justDone && <div className="focus__flash" aria-hidden="true"><IconCheck /></div>}

      {record && (
        <div className="focus__record" role="status">
          <IconTrophy /> {t('Neue Bestleistung')}
        </div>
      )}

      {resting ? (
        <div className="focus__rest" role="timer" aria-live="off">
          <span className="focus__rest-label">{t('Pause')}</span>
          <span className="focus__rest-time">{formatClock(restLeft)}</span>
          <span className="focus__rest-next">
            {current ? t('Als Nächstes: {label}', { label: setLabel }) : next ? t('Als Nächstes: {name}', { name: exerciseName(next.exercise) }) : ''}
          </span>
          <div className="focus__rest-actions">
            <button className="btn btn--lg" onClick={onExtendRest}>+30 s</button>
            <button className="btn btn--lg btn--primary" onClick={onEndRest}>{t('Weiter')}</button>
          </div>
        </div>
      ) : current ? (
        <div className="focus__work">
          {values.length === 0 && (
            <div className="focus__only-sets">{setLabel}</div>
          )}
          {values.map((value, index) => (
            <div key={value.field} className="focus__value">
              <button
                className="focus__step"
                onClick={() => bump(value.field, -value.step)}
                aria-label={t('{label} verringern', { label: value.label })}
              >
                −
              </button>
              <span className="focus__number">
                <span className="focus__digits">{value.text}</span>
                <span className="focus__unit">{value.label}</span>
              </span>
              <button
                className="focus__step"
                onClick={() => bump(value.field, value.step)}
                aria-label={t('{label} erhöhen', { label: value.label })}
              >
                +
              </button>
              {index === 0 && value.field === 'weightKg' && usesBarbell(item.exercise)
                && current.weightKg != null && current.weightKg >= barKg && (
                <div className="focus__bar">
                  <Barbell weightKg={current.weightKg} barKg={barKg} plates={plates} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="focus__work focus__work--done">
          <span className="focus__stamp">{t('Geschafft')}</span>
          {next && (
            <button className="btn btn--lg btn--primary" onClick={() => onActiveChange(next.key)}>
              {t('Weiter: {name}', { name: exerciseName(next.exercise) })} <IconChevronRight />
            </button>
          )}
        </div>
      )}

      <div className="focus__bottom">
        {current && !resting && (
          <button
            className="focus__done"
            onClick={complete}
          >
            <IconCheck /> {t('Satz geschafft')}
          </button>
        )}
        <div className="focus__nav">
          <button className="btn" onClick={() => go(-1)} disabled={position === 0}>
            <IconChevronLeft /> {t('Vorige')}
          </button>
          <button className="btn" onClick={() => go(1)} disabled={position >= items.length - 1}>
            {t('Nächste')} <IconChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

import { t } from '../i18n';
import { useMemo, useState } from 'react';
import type { WeeklyGoals } from '../types';
import { useStore } from '../storage/store';
import { startOfWeek, todayISO } from '../lib/date';
import { ALL_REGIONS, REGION_LABELS, type MuscleRegion } from '../lib/muscles';
import { DEFAULT_WEEKLY_TARGET, targetFor } from '../lib/muscleLoad';
import {
  goalMeters, goalsFromPlan, hasOwnGoals, weekProgress, type GoalMeter,
} from '../lib/weeklyGoals';
import { Modal, NumberInput, fmt, useToast } from './ui';
import { IconGoal } from './icons';

/*
 * Wochenziele - Leiste, Karte und Dialog.
 *
 * Die Leiste steht auf der Trainingsseite (ein Blick: wo stehe ich diese
 * Woche?), die Karte auf der Fortschrittsseite (alles, auch je Muskelgruppe),
 * der Dialog ist von beiden aus und aus den Einstellungen zu erreichen.
 */

const meterParts = (meter: GoalMeter): [string, string] => {
  if (meter.key === 'volume') {
    const short = (value: number) => (value >= 10000 ? `${fmt(value / 1000, 1)}k` : fmt(value));
    return [short(meter.value), short(meter.target)];
  }
  return [fmt(meter.value), fmt(meter.target)];
};

const formatMeter = (meter: GoalMeter): string => meterParts(meter).join(' / ');

function useWeekGoals() {
  const { state, getExercise } = useStore();
  const monday = startOfWeek(todayISO());
  const progress = useMemo(() => weekProgress(state, getExercise, monday), [state, getExercise, monday]);
  const goals = state.settings.weeklyGoals;
  const setTargets = state.settings.weeklySetTargets;
  const meters = useMemo(() => goalMeters(progress, goals, setTargets), [progress, goals, setTargets]);
  return { progress, goals, setTargets, meters, own: hasOwnGoals(goals, setTargets) };
}

/** Die Zeile auf der Trainingsseite. Ohne eigene Ziele: ein Knopf, sie zu setzen. */
export function WeeklyGoalsStrip() {
  const { meters, own } = useWeekGoals();
  const [open, setOpen] = useState(false);

  return (
    <>
      {!own || meters.length === 0 ? (
        <button className="goals-empty" onClick={() => setOpen(true)}>
          <IconGoal />
          <span>{t('Wochenziele festlegen')}</span>
          <span className="goals-empty__hint">{t('Tage, Minuten, Volumen, Muskelgruppen')}</span>
        </button>
      ) : (
        <button
          className={`goals-strip ${meters.length > 3 ? 'goals-strip--many' : ''}`}
          onClick={() => setOpen(true)}
          aria-label={t('Wochenziele bearbeiten')}
        >
          {meters.map((meter) => (
            <span key={meter.key} className={`goals-strip__item ${meter.ratio >= 1 ? 'goals-strip__item--done' : ''}`}>
              <span className="goals-strip__label">{t(meter.label)}</span>
              {/* Der Stand gross, das Ziel klein daneben - so passt es auch zu viert. */}
              <span className="goals-strip__value mono">
                {meterParts(meter)[0]}
                <span className="goals-strip__target"> / {meterParts(meter)[1]}</span>
              </span>
              <span className="goals-strip__bar"><span style={{ width: `${Math.round(meter.ratio * 100)}%` }} /></span>
            </span>
          ))}
        </button>
      )}
      {open && <WeeklyGoalsDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** Die ausfuehrliche Karte - Fortschrittsseite. */
export function WeeklyGoalsCard() {
  const { progress, meters, setTargets } = useWeekGoals();
  const [open, setOpen] = useState(false);
  const regions = ALL_REGIONS
    .map((region) => ({ region, sets: progress.regions.get(region) ?? 0, target: targetFor(setTargets, region) }))
    .filter((entry) => entry.target > 0);

  return (
    <div className="card goals-card">
      <div className="card__header">
        <div className="card__title"><IconGoal /> {t('Wochenziele')}</div>
        <button className="btn btn--sm" onClick={() => setOpen(true)}>{t('Bearbeiten')}</button>
      </div>

      {meters.filter((meter) => meter.key !== 'muscles').length > 0 && (
        <div className="goals-card__meters">
          {meters.filter((meter) => meter.key !== 'muscles').map((meter) => (
            <div key={meter.key} className="goals-card__meter">
              <div className="row row--between tiny">
                <span className="muted">{t(meter.label)}</span>
                <span className="mono">{formatMeter(meter)}</span>
              </div>
              <div className={`goal-bar ${meter.ratio >= 1 ? 'goal-bar--done' : ''}`}>
                <span style={{ width: `${Math.round(meter.ratio * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {regions.length > 0 && (
        <>
          <div className="section-label" style={{ margin: '12px 0 6px' }}>{t('Sätze je Muskelgruppe')}</div>
          <div className="goals-card__regions">
            {regions.map((entry) => {
              const ratio = Math.min(1, entry.sets / entry.target);
              return (
                <div key={entry.region} className="goals-card__region">
                  <span className="tiny">{t(REGION_LABELS[entry.region])}</span>
                  <div className={`goal-bar goal-bar--thin ${ratio >= 1 ? 'goal-bar--done' : ''}`}>
                    <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                  <span className="tiny mono dim">{fmt(entry.sets, entry.sets % 1 ? 1 : 0)}/{entry.target}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {open && <WeeklyGoalsDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

/**
 * Ziele festlegen - von Hand oder aus dem aktiven Plan.
 *
 * "Aus dem Plan" fuellt alle Felder mit dem, was der Plan fuer eine Woche
 * vorsieht; gespeichert wird erst beim Tippen auf "Speichern". So kann man den
 * Vorschlag nehmen und an einer Stelle nachschaerfen.
 */
export function WeeklyGoalsDialog({ onClose }: { onClose: () => void }) {
  const { state, getExercise, updateSettings } = useStore();
  const toast = useToast();
  const plan = state.plans.find((item) => item.id === state.activePlanId) ?? null;

  const [goals, setGoals] = useState<WeeklyGoals>(() => ({ ...state.settings.weeklyGoals }));
  const [sets, setSets] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const region of ALL_REGIONS) initial[region] = targetFor(state.settings.weeklySetTargets, region);
    return initial;
  });

  const fromPlan = () => {
    if (!plan) return;
    const suggestion = goalsFromPlan(plan, state, getExercise, todayISO());
    setGoals(suggestion.goals);
    setSets(suggestion.setTargets);
    toast.show(t('Aus „{name}“ übernommen – noch nicht gespeichert', { name: plan.name }));
  };

  const setRegion = (region: MuscleRegion, value: number | null) =>
    setSets((current) => ({ ...current, [region]: Math.max(0, Math.min(40, value ?? 0)) }));

  const save = () => {
    updateSettings({ weeklyGoals: goals, weeklySetTargets: sets });
    toast.show(t('Wochenziele gespeichert'));
    onClose();
  };

  return (
    <Modal title={t('Wochenziele')} onClose={onClose}>
      <div className="list">
        {plan && (
          <button className="btn btn--block goals-from-plan" onClick={fromPlan}>
            <IconGoal />
            <span style={{ flex: 1, textAlign: 'left' }}>
              {t('Vom aktiven Plan übernehmen')}
              <span className="tiny dim" style={{ display: 'block' }}>{plan.name}</span>
            </span>
          </button>
        )}

        <div className="grid-3">
          <div className="field">
            <label className="field__label">{t('Trainingstage')}</label>
            <NumberInput
              value={goals.trainingDays}
              min={0}
              max={7}
              placeholder="–"
              ariaLabel={t('Trainingstage pro Woche')}
              onChange={(value) => setGoals({ ...goals, trainingDays: value || null })}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('Minuten')}</label>
            <NumberInput
              value={goals.minutes}
              min={0}
              max={3000}
              placeholder="–"
              ariaLabel={t('Trainingsminuten pro Woche')}
              onChange={(value) => setGoals({ ...goals, minutes: value || null })}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('Volumen (kg)')}</label>
            <NumberInput
              value={goals.volumeKg}
              min={0}
              placeholder="–"
              ariaLabel={t('Wochenvolumen in Kilogramm')}
              onChange={(value) => setGoals({ ...goals, volumeKg: value || null })}
            />
          </div>
        </div>
        <p className="tiny dim" style={{ margin: 0 }}>
          {t('Leer lassen heißt: kein Ziel. Minuten zählen auch Cardio und Zirkel, Volumen nur Gewicht × Wiederholungen.')}
        </p>

        <div className="row row--between" style={{ marginTop: 4 }}>
          <span className="section-label">{t('Harte Sätze je Muskelgruppe')}</span>
          <button className="btn btn--sm btn--ghost" onClick={() => setSets({ ...DEFAULT_WEEKLY_TARGET })}>
            {t('Standard')}
          </button>
        </div>
        <div className="goals-regions">
          {ALL_REGIONS.map((region) => (
            <label key={region} className="goals-regions__row">
              <span className="small">{t(REGION_LABELS[region])}</span>
              <div style={{ width: 84 }}>
                <NumberInput
                  value={sets[region]}
                  min={0}
                  max={40}
                  ariaLabel={t(REGION_LABELS[region])}
                  onChange={(value) => setRegion(region, value)}
                />
              </div>
            </label>
          ))}
        </div>
        <p className="tiny dim" style={{ margin: 0 }}>
          {t('Üblich sind 10 bis 20 Sätze. 0 = diese Gruppe hat kein Ziel.')}
        </p>

        <div className="grid-2">
          <button className="btn" onClick={onClose}>{t('Abbrechen')}</button>
          <button className="btn btn--primary" onClick={save}>{t('Speichern')}</button>
        </div>
      </div>
    </Modal>
  );
}

import { t } from '../i18n';
import type { TrackingMode } from '../types';
import { NumberInput } from './ui';
import { TRACKING_EXAMPLES, TRACKING_LABELS, TRACKING_MODES, fieldsOf } from '../lib/tracking';

/**
 * Die Vorgaben einer Uebung - im Plan wie im Training dieselben Felder.
 *
 * Vorher gab es sie nur im Plan-Editor, und dort immer als Saetze, Wdh von,
 * Wdh bis und Zielgewicht - auch bei der Plank, die nichts davon hat. Jetzt
 * waehlt man zuerst, *wie* erfasst wird, und bekommt dann genau die Felder,
 * die dazu gehoeren.
 */
export interface TargetValues {
  tracking: TrackingMode;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetDurationSec: number | null;
  targetDistanceKm: number | null;
  restSec: number | null;
}

/** Die sechs Erfassungsarten als Kacheln - Name und ein Beispiel. */
export function TrackingPicker({
  value, onChange,
}: {
  value: TrackingMode;
  onChange: (mode: TrackingMode) => void;
}) {
  return (
    <div className="tracking-picker" role="radiogroup" aria-label={t('Erfassung')}>
      {TRACKING_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          className={`tracking-picker__item ${value === mode ? 'tracking-picker__item--on' : ''}`}
          onClick={() => onChange(mode)}
        >
          <span className="tracking-picker__name">{t(TRACKING_LABELS[mode])}</span>
          <span className="tracking-picker__example">{t(TRACKING_EXAMPLES[mode])}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Die Zahlenfelder zur gewaehlten Erfassung.
 *
 * Wechselt man die Art, bleiben die Werte der anderen Felder im Hintergrund
 * stehen - wer versehentlich auf "Zeit" tippt und zurueck auf "Gewicht ×
 * Wdh", findet seine 8–12 wieder.
 */
export function TargetFields({
  value, onChange, showRest = true,
}: {
  value: TargetValues;
  onChange: (patch: Partial<TargetValues>) => void;
  showRest?: boolean;
}) {
  const fields = fieldsOf(value.tracking);
  /* Bei Strecke und Zeit denkt man in Minuten, bei einer Plank in Sekunden. */
  const minutes = value.tracking === 'distance_time';

  return (
    <div className="list" style={{ gap: 10 }}>
      <div className="grid-3">
        <div className="field">
          <label className="field__label">{value.tracking === 'distance_time' ? t('Durchgänge') : t('Sätze')}</label>
          <NumberInput
            value={value.targetSets}
            min={1}
            max={30}
            ariaLabel={t('Sätze')}
            onChange={(next) => onChange({ targetSets: next ?? 1 })}
          />
        </div>
        {fields.reps && (
          <>
            <div className="field">
              <label className="field__label">{t('Wdh von')}</label>
              <NumberInput
                value={value.targetRepsMin}
                min={0}
                ariaLabel={t('Wdh von')}
                onChange={(next) => onChange({ targetRepsMin: next })}
              />
            </div>
            <div className="field">
              <label className="field__label">{t('Wdh bis')}</label>
              <NumberInput
                value={value.targetRepsMax}
                min={0}
                ariaLabel={t('Wdh bis')}
                onChange={(next) => onChange({ targetRepsMax: next })}
              />
            </div>
          </>
        )}
        {fields.time && (
          <div className="field">
            <label className="field__label">{minutes ? t('Zeit (min)') : t('Zeit je Satz (s)')}</label>
            <NumberInput
              value={value.targetDurationSec == null ? null
                : minutes ? Math.round((value.targetDurationSec / 60) * 10) / 10 : value.targetDurationSec}
              min={0}
              ariaLabel={minutes ? t('Zeit in Minuten') : t('Zeit je Satz in Sekunden')}
              onChange={(next) => onChange({
                targetDurationSec: next == null ? null : Math.round(minutes ? next * 60 : next),
              })}
            />
          </div>
        )}
        {fields.distance && (
          <div className="field">
            <label className="field__label">{t('Strecke (km)')}</label>
            <NumberInput
              value={value.targetDistanceKm}
              min={0}
              step={0.1}
              ariaLabel={t('Strecke in Kilometern')}
              onChange={(next) => onChange({ targetDistanceKm: next })}
            />
          </div>
        )}
      </div>

      {(fields.weight || showRest) && (
        <div className="grid-2">
          {fields.weight && (
            <div className="field">
              <label className="field__label">{t('Zielgewicht (kg)')}</label>
              <NumberInput
                value={value.targetWeightKg}
                min={0}
                ariaLabel={t('Zielgewicht')}
                placeholder={t('optional')}
                onChange={(next) => onChange({ targetWeightKg: next })}
              />
            </div>
          )}
          {showRest && (
            <div className="field">
              <label className="field__label">{t('Pause (Sekunden)')}</label>
              <NumberInput
                value={value.restSec}
                min={0}
                max={900}
                ariaLabel={t('Pause in Sekunden')}
                onChange={(next) => onChange({ restSec: next })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

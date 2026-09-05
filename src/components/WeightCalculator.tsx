import { t } from '../i18n';
import { useMemo, useState } from 'react';
import type { Exercise } from '../types';
import { useStore } from '../storage/store';
import { estimate1RM } from '../lib/stats';
import { percentTable } from '../lib/oneRm';
import { BAR_WEIGHTS, describePlates, platesFor, usesBarbell } from '../lib/plates';
import { Modal, NumberInput, fmt } from './ui';

/** Breite eines Scheibensymbols - grob nach dem Durchmesser echter Scheiben. */
const plateHeight = (kg: number): number => {
  if (kg >= 20) return 46;
  if (kg >= 15) return 40;
  if (kg >= 10) return 32;
  if (kg >= 5) return 25;
  if (kg >= 2.5) return 19;
  return 14;
};

/**
 * Die zwei Rechnungen, die man zwischen zwei Saetzen tatsaechlich anstellt.
 *
 * Links: Was muss auf die Stange? Rechts: Was sind 70 % davon? Beides steht
 * sonst im Kopf oder auf dem Handy in einer anderen App.
 */
export function WeightCalculator({
  exercise, weightKg, reps, onClose, onApply,
}: {
  exercise: Exercise | undefined;
  weightKg: number | null;
  reps: number | null;
  onClose: () => void;
  onApply?: (kg: number) => void;
}) {
  const { state, updateSettings } = useStore();
  const [target, setTarget] = useState<number | null>(weightKg ?? null);
  const [repInput, setRepInput] = useState<number | null>(reps ?? null);

  const barKg = state.settings.barWeightKg;
  const plates = state.settings.plateSet;
  const barbell = usesBarbell(exercise);

  const loaded = useMemo(
    () => (target != null ? platesFor(target, barKg, plates) : null),
    [target, barKg, plates],
  );

  /*
   * Fuer die Prozenttabelle zaehlt der eingegebene Satz, nicht der Bestwert:
   * Wer heute 80 kg × 8 schafft, will die Prozente von heute sehen, nicht die
   * von seinem besten Tag im Maerz.
   */
  const oneRm = useMemo(
    () => estimate1RM(target ?? 0, repInput ?? 0),
    [target, repInput],
  );
  const table = useMemo(() => percentTable(oneRm), [oneRm]);

  return (
    <Modal title={t('Rechner')} onClose={onClose}>
      <div className="list">
        <div className="grid-2">
          <div className="field">
            <label className="field__label">{t("Gewicht (kg)")}</label>
            <NumberInput value={target} min={0} step={2.5} onChange={setTarget} placeholder={t("kg")} />
          </div>
          <div className="field">
            <label className="field__label">{t("Wiederholungen")}</label>
            <NumberInput value={repInput} min={1} max={30} onChange={setRepInput} placeholder={t("Wdh")} />
          </div>
        </div>

        {/* ----------------------------------------------- Scheibenrechner */}

        {barbell ? (
          <div className="card">
            <div className="row row--between" style={{ gap: 10 }}>
              <div className="card__title nowrap">{t("Scheiben je Seite")}</div>
              <select
                className="select select--sm"
                style={{ width: 'auto', flex: '0 1 auto' }}
                value={barKg}
                aria-label={t('Gewicht der Stange')}
                onChange={(event) => updateSettings({ barWeightKg: Number(event.target.value) })}
              >
                {BAR_WEIGHTS.map((weight) => (
                  <option key={weight} value={weight}>
                    {t('{kg} kg Stange', { kg: weight.toLocaleString('de-DE') })}
                  </option>
                ))}
              </select>
            </div>

            {loaded ? (
              <>
                <div className="barbell" aria-hidden="true">
                  <span className="barbell__bar" />
                  {loaded.perSide.map((plate, index) => (
                    <span
                      key={`${plate}-${index}`}
                      className="barbell__plate"
                      style={{ height: plateHeight(plate) }}
                    >
                      {plate.toLocaleString('de-DE')}
                    </span>
                  ))}
                  <span className="barbell__collar" />
                </div>

                <div className="barbell__read">
                  {describePlates(loaded.perSide)}
                  <span className="dim">
                    {' · '}
                    {t('macht {kg} kg', { kg: loaded.totalKg.toLocaleString('de-DE') })}
                  </span>
                </div>

                {loaded.offByKg !== 0 && (
                  <div className="tiny" style={{ color: 'var(--warn)', marginTop: 6 }}>
                    {t('{kg} kg gehen mit deinen Scheiben nicht genau auf – das ist der nächstmögliche Wert.', {
                      kg: (target ?? 0).toLocaleString('de-DE'),
                    })}
                  </div>
                )}

                {onApply && loaded.totalKg !== weightKg && (
                  <button
                    className="btn btn--sm btn--primary"
                    style={{ marginTop: 10 }}
                    onClick={() => { onApply(loaded.totalKg); onClose(); }}
                  >
                    {t('{kg} kg übernehmen', { kg: loaded.totalKg.toLocaleString('de-DE') })}
                  </button>
                )}
              </>
            ) : (
              <div className="tiny dim">
                {t('Unter {kg} kg liegt nur die Stange.', { kg: barKg.toLocaleString('de-DE') })}
              </div>
            )}

            <PlatePicker
              plates={plates}
              onChange={(next) => updateSettings({ plateSet: next })}
            />
          </div>
        ) : (
          <div className="tiny dim">
            {t('An Maschine und Kabelzug gibt es nichts je Seite zu rechnen – deshalb nur die Prozenttabelle.')}
          </div>
        )}

        {/* ------------------------------------------------ Prozenttabelle */}

        <div className="card card--flush">
          <div className="section-label" style={{ padding: '12px 14px 4px' }}>
            {oneRm > 0
              ? t('Bei 1RM ≈ {kg} kg', { kg: fmt(oneRm, 1) })
              : t('Prozent vom Maximum')}
          </div>

          {oneRm > 0 ? (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("Anteil")}</th>
                  <th className="right">{t("Gewicht")}</th>
                  <th className="right">{t("Wdh")}</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={row.pct}>
                    <td className="mono">{row.pct} %</td>
                    <td className="right mono nowrap">{row.kg.toLocaleString('de-DE')} kg</td>
                    <td className="right mono dim">≈ {row.reps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="tiny dim" style={{ padding: '4px 14px 14px' }}>
              {t('Trag Gewicht und Wiederholungen ein, dann steht die Tabelle hier.')}
            </div>
          )}

          <div className="tiny dim" style={{ padding: '10px 14px 14px' }}>
            {t('Geschätzt nach Epley – dieselbe Formel wie im Verlauf. Die Wiederholungen sind ein Richtwert, kein Versprechen.')}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Welche Scheiben haengen im Studio am Staender? */
function PlatePicker({
  plates, onChange,
}: {
  plates: number[];
  onChange: (plates: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const all = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="btn btn--sm btn--ghost"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? t('Fertig') : t('Welche Scheiben hast du?')}
      </button>

      {open && (
        <div className="row row--wrap" style={{ gap: 6, marginTop: 8 }}>
          {all.map((plate) => {
            const active = plates.includes(plate);
            return (
              <button
                key={plate}
                className={`chip chip--button ${active ? 'chip--accent' : ''}`}
                aria-pressed={active}
                onClick={() => onChange(
                  active
                    ? plates.filter((item) => item !== plate)
                    : [...plates, plate].sort((a, b) => b - a),
                )}
              >
                {plate.toLocaleString('de-DE')} kg
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

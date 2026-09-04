import { t } from '../i18n';
import { useMemo, useRef, useState } from 'react';
import type { Goal } from '../types';
import { ACTIVITY_LABELS, GOAL_ADJUSTMENT, GOAL_LABELS, calcDayEnergy, proteinTarget } from '../lib/calories';
import { addDays, formatDateShort, formatDateTiny, todayISO } from '../lib/date';
import { useStore } from '../storage/store';
import { fetchYazioDay, parseYazioCsv } from '../api/yazio';
import { LineChart, type Point } from '../components/charts/Charts';
import { Modal, NumberInput, Stat, fmt, useToast } from '../components/ui';
import { IconChevronLeft, IconChevronRight, IconInfo, IconRefresh, IconUpload } from '../components/icons';

/** Passt die Bilanz zum Ziel? Beim Abnehmen ist ein Defizit gut, beim Aufbauen ein Ueberschuss. */
function isOnTrack(goal: Goal, balance: number): boolean {
  if (goal === 'lose') return balance <= 0;
  if (goal === 'gain') return balance >= 0;
  return Math.abs(balance) <= 200;
}

function balanceHint(goal: Goal, balance: number): string {
  if (goal === 'lose') return balance <= 0 ? t('Defizit – passt zum Abnehmen') : t('Überschuss – über dem Verbrauch');
  if (goal === 'gain') return balance >= 0 ? t('Überschuss – passt zum Aufbauen') : t('Defizit – zu wenig für Aufbau');
  return Math.abs(balance) <= 200 ? t('Nah am Verbrauch – gut zum Halten') : t('Deutlich vom Verbrauch entfernt');
}

export function CaloriesPage() {
  const { state, getExercise, setNutrition } = useStore();

  const [date, setDate] = useState(todayISO());
  const [yazioOpen, setYazioOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);

  const workout = state.workouts.find((item) => item.date === date);
  const energy = useMemo(
    () => calcDayEnergy(state.profile, workout, getExercise, state.settings.restTimerSec),
    [state.profile, workout, getExercise, state.settings.restTimerSec],
  );

  const entry = state.nutrition.find((item) => item.date === date);
  const balance = entry?.kcalIn != null ? entry.kcalIn - energy.total : null;
  const onTrack = balance == null ? true : isOnTrack(state.profile.goal, balance);

  /* Verlauf: Verbrauch und Zufuhr der letzten 30 Tage. */
  const history: { burn: Point[]; intake: Point[] } = useMemo(() => {
    const burn: Point[] = [];
    const intake: Point[] = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const day = addDays(todayISO(), -offset);
      const dayWorkout = state.workouts.find((item) => item.date === day);
      const dayEnergy = calcDayEnergy(state.profile, dayWorkout, getExercise, state.settings.restTimerSec);
      burn.push({ label: formatDateTiny(day), value: Math.round(dayEnergy.total), detail: formatDateShort(day) });

      const dayEntry = state.nutrition.find((item) => item.date === day);
      if (dayEntry?.kcalIn != null) {
        intake.push({ label: formatDateTiny(day), value: dayEntry.kcalIn, detail: formatDateShort(day) });
      }
    }
    return { burn, intake };
  }, [state.workouts, state.nutrition, state.profile, getExercise, state.settings.restTimerSec]);

  const patchEntry = (patch: Partial<NonNullable<typeof entry>>) => {
    setNutrition({
      date,
      kcalIn: entry?.kcalIn ?? null,
      proteinG: entry?.proteinG ?? null,
      carbsG: entry?.carbsG ?? null,
      fatG: entry?.fatG ?? null,
      source: 'manual',
      ...patch,
    });
  };

  return (
    <>
      <div className="row row--between">
        <button className="btn btn--ghost btn--icon" onClick={() => setDate(addDays(date, -1))} aria-label={t("Vorheriger Tag")}>
          <IconChevronLeft />
        </button>
        <div className="center" style={{ flex: 1 }}>
          <div className="bold">{formatDateShort(date)}</div>
          <div className="tiny dim">{date === todayISO() ? t('Heute') : t('Anderer Tag')}</div>
        </div>
        <button className="btn btn--ghost btn--icon" onClick={() => setDate(addDays(date, 1))} aria-label={t("Nächster Tag")}>
          <IconChevronRight />
        </button>
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">{t("Verbrauch an diesem Tag")}</div>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setExplainOpen(true)} aria-label={t("Erklärung")}>
            <IconInfo />
          </button>
        </div>

        <div className="grid-auto">
          <Stat label={t("Grundumsatz")} value={fmt(energy.bmr)} unit={t("kcal")} sub={t("im Ruhezustand")} />
          <Stat label={t("Alltag (TDEE)")} value={fmt(energy.tdee)} unit={t("kcal")} sub={t(ACTIVITY_LABELS[state.profile.activityLevel]).split(' (')[0]} />
          <Stat
            label={t("Training")}
            value={fmt(energy.workoutKcal)}
            unit={t("kcal")}
            tone="warn"
            sub={energy.workoutMinutes > 0
              ? `${fmt(energy.workoutMinutes)} min aktiv${energy.estimated ? ' (gesch.)' : ''}`
              : t('kein Training')}
          />
          <Stat label={t("Gesamt")} value={fmt(energy.total)} unit={t("kcal")} tone="accent" />
        </div>

        <div className="divider" style={{ margin: '12px 0' }} />

        <div className="row row--between">
          <span className="small muted">
            {t('Empfehlung für „{goal}“', { goal: t(GOAL_LABELS[state.profile.goal]) })}
          </span>
          <span className="bold mono">
            {fmt(energy.target)} kcal
            {GOAL_ADJUSTMENT[state.profile.goal] !== 0 && (
              <span className="tiny dim" style={{ marginLeft: 5 }}>
                ({GOAL_ADJUSTMENT[state.profile.goal] > 0 ? '+' : ''}{GOAL_ADJUSTMENT[state.profile.goal]})
              </span>
            )}
          </span>
        </div>
        <div className="row row--between" style={{ marginTop: 4 }}>
          <span className="small muted">{t("Protein-Ziel")}</span>
          <span className="bold mono">{proteinTarget(state.profile.weightKg)} g</span>
        </div>
      </div>

      {energy.perExercise.length > 0 && (
        <div className="card card--flush">
          <div className="section-label" style={{ padding: '12px 14px 4px' }}>{t("Verbrauch je Übung")}</div>
          <table className="data">
            <thead>
              <tr><th>{t("Übung")}</th><th className="right">{t("Aktiv")}</th><th className="right">{t("kcal")}</th></tr>
            </thead>
            <tbody>
              {energy.perExercise.map((row) => (
                <tr key={row.exerciseId}>
                  <td>{row.name}</td>
                  <td className="right mono nowrap">{fmt(row.minutes)} min</td>
                  <td className="right mono">{fmt(row.kcal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <div className="card__title">{t("Zufuhr")}</div>
          <button className="btn btn--sm" onClick={() => setYazioOpen(true)}>
            <IconRefresh /> {t('Yazio')}
          </button>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label">{t("Kalorien (kcal)")}</label>
            <NumberInput value={entry?.kcalIn ?? null} min={0} onChange={(value) => patchEntry({ kcalIn: value })} />
          </div>
          <div className="field">
            <label className="field__label">{t("Protein (g)")}</label>
            <NumberInput value={entry?.proteinG ?? null} min={0} onChange={(value) => patchEntry({ proteinG: value })} />
          </div>
          <div className="field">
            <label className="field__label">{t("Kohlenhydrate (g)")}</label>
            <NumberInput value={entry?.carbsG ?? null} min={0} onChange={(value) => patchEntry({ carbsG: value })} />
          </div>
          <div className="field">
            <label className="field__label">{t("Fett (g)")}</label>
            <NumberInput value={entry?.fatG ?? null} min={0} onChange={(value) => patchEntry({ fatG: value })} />
          </div>
        </div>

        {balance != null && (
          <div
            className="row row--between"
            style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              background: onTrack ? 'var(--success-soft)' : 'var(--warn-soft)',
            }}
          >
            <div>
              <div className="small bold">{t("Bilanz")}</div>
              <div className="tiny dim">{balanceHint(state.profile.goal, balance)}</div>
            </div>
            <span className="bold mono" style={{ color: onTrack ? 'var(--success)' : 'var(--warn)' }}>
              {balance > 0 ? '+' : ''}{fmt(balance)} kcal
            </span>
          </div>
        )}
        {entry?.source === 'yazio' && (
          <div className="tiny dim" style={{ marginTop: 6 }}>{t("Werte stammen aus Yazio.")}</div>
        )}
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">{t("Verbrauch der letzten 30 Tage")}</div>
        </div>
        <LineChart points={history.burn} unit={t("kcal")} color="var(--warn)" />
        {history.intake.length > 1 && (
          <>
            <div className="section-label" style={{ margin: '14px 0 6px' }}>{t("Zufuhr")}</div>
            <LineChart points={history.intake} unit={t("kcal")} color="var(--success)" />
          </>
        )}
      </div>

      {yazioOpen && <YazioDialog date={date} onClose={() => setYazioOpen(false)} />}

      {explainOpen && (
        <Modal title={t("Wie wird gerechnet?")} onClose={() => setExplainOpen(false)}>
          <div className="list small muted">
            <p>
              <strong style={{ color: 'var(--text)' }}>{t("Grundumsatz")}</strong> nach der Mifflin-St-Jeor-Formel
              aus Gewicht, Größe, Alter und Geschlecht. Ist im Profil ein Körperfettanteil hinterlegt,
              wird stattdessen Katch-McArdle benutzt – das ist genauer, weil es die fettfreie Masse nutzt.
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>{t("Alltagsumsatz (TDEE)")}</strong> ist der Grundumsatz
              multipliziert mit deinem Aktivitätsfaktor ({t(ACTIVITY_LABELS[state.profile.activityLevel])}).
              Wähle die Stufe bewusst <em>{t("ohne")}</em> Training – das Training kommt separat obendrauf.
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>{t("Training")}</strong> wird über MET-Werte berechnet:
              kcal = MET × 3,5 × Körpergewicht ÷ 200 × Minuten. Jede Übung hat einen eigenen MET-Wert.
              Ohne eingetragene Trainingsdauer wird die Zeit aus Sätzen, Wiederholungen und Pausen geschätzt;
              trägst du eine echte Dauer ein, wird darauf skaliert.
            </p>
            <p>
              Alle Werte sind Schätzungen. Für die Praxis zählt vor allem, dass du dieselbe Methode
              über Wochen beibehältst und die Entwicklung beobachtest.
            </p>
          </div>
        </Modal>
      )}

      <div className="tiny dim center">
        {t('Aktivitätsstufe, Ziel und Körperdaten änderst du im Profil.')}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- Yazio */

function YazioDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const { state, updateSettings, setNutrition } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [bridgeUrl, setBridgeUrl] = useState(state.settings.yazio.bridgeUrl);
  const [token, setToken] = useState(state.settings.yazio.token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setBusy(true);
    setError(null);
    try {
      updateSettings({ yazio: { ...state.settings.yazio, bridgeUrl, token, enabled: true, lastSyncAt: new Date().toISOString() } });
      const day = await fetchYazioDay(bridgeUrl, token, date);
      setNutrition({
        date: day.date || date,
        kcalIn: day.kcalIn,
        proteinG: day.proteinG,
        carbsG: day.carbsG,
        fatG: day.fatG,
        source: 'yazio',
      });
      toast.show(t("Werte aus Yazio übernommen"));
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Verbindung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (file: File) => {
    try {
      const entries = parseYazioCsv(await file.text());
      if (entries.length === 0) {
        setError('In der Datei wurden keine Datums- und Kalorienspalten gefunden.');
        return;
      }
      for (const item of entries) setNutrition(item);
      toast.show(t('{count} Tage importiert', { count: entries.length }));
      onClose();
    } catch {
      setError('Datei konnte nicht gelesen werden.');
    }
  };

  return (
    <Modal title={t("Yazio verbinden")} onClose={onClose}>
      <div className="list">
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <IconInfo style={{ width: 17, height: 17, flexShrink: 0, color: 'var(--accent)', marginTop: 2 }} />
            <div className="small muted">
              Yazio bietet keine offizielle öffentliche Schnittstelle an. Deshalb gibt es hier zwei Wege –
              der CSV-Import funktioniert sofort, die Bridge nur mit einem selbst betriebenen Dienst.
            </div>
          </div>
        </div>

        <div className="section-label">{t("1 · CSV-Import (empfohlen)")}</div>
        <div className="small muted">
          In der Yazio-App: Profil → Einstellungen → Konto → Daten exportieren. Die erhaltene CSV-Datei
          hier hochladen – Kalorien und Makros werden je Tag zusammengezählt.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importCsv(file);
          }}
        />
        <button className="btn btn--primary btn--block" onClick={() => fileRef.current?.click()}>
          <IconUpload /> {t('CSV-Datei auswählen')}
        </button>

        <div className="divider" />

        <div className="section-label">{t("2 · Eigene Bridge")}</div>
        <div className="small muted">
          Läuft bei dir ein kleiner Dienst, der sich bei Yazio anmeldet, kann diese App ihn abfragen.
          Erwartet wird <code>GET {'{Adresse}'}/daily?date=JJJJ-MM-TT</code> mit einer Antwort wie
          <code>{' {"energy": 2140, "protein": 155}'}</code>.
        </div>
        <div className="field">
          <label className="field__label">{t("Adresse der Bridge")}</label>
          <input className="input" value={bridgeUrl} placeholder={t("https://…")} onChange={(event) => setBridgeUrl(event.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">{t("Token (optional)")}</label>
          <input className="input" type="password" value={token} onChange={(event) => setToken(event.target.value)} />
        </div>
        <button className="btn btn--block" onClick={sync} disabled={busy || !bridgeUrl.trim()}>
          <IconRefresh /> {busy ? 'Verbinde…' : `Werte für ${formatDateShort(date)} holen`}
        </button>

        {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}

        <div className="tiny dim">
          Ohne beides trägst du die Kalorien einfach von Hand ein – alles andere rechnet trotzdem.
        </div>
      </div>
    </Modal>
  );
}

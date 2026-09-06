import { t } from '../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Goal, MealPreset } from '../types';
import { ACTIVITY_LABELS, GOAL_ADJUSTMENT, GOAL_LABELS, calcDayEnergy, proteinTarget } from '../lib/calories';
import { addDays, formatDateShort, formatDateTiny, todayISO } from '../lib/date';
import { useStore } from '../storage/store';
import { fetchYazioDay, parseYazioCsv } from '../api/yazio';
import { isBarcode, lookupProduct, scaleProduct, type FoodProduct } from '../api/foodfacts';
import { uid } from '../storage/defaults';
import { BarChart, type Point } from '../components/charts/Charts';
import { Block, Modal, NumberInput, Section, Stat, fmt, useToast } from '../components/ui';
import {
  IconCamera, IconChevronLeft, IconChevronRight, IconInfo, IconPlus, IconRefresh, IconTrash, IconUpload,
} from '../components/icons';

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
  const { state, getExercise, setNutrition, updateSettings } = useStore();
  const toast = useToast();

  const [date, setDate] = useState(todayISO());
  const [yazioOpen, setYazioOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);
  const [mealNameOpen, setMealNameOpen] = useState(false);

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

  /** Legt Werte auf den Tag drauf, statt sie zu ersetzen - fuer Barcode und Mahlzeiten. */
  const addToEntry = (add: {
    kcal?: number | null; proteinG?: number | null; carbsG?: number | null; fatG?: number | null;
  }) => {
    const sum = (a: number | null | undefined, b: number | null | undefined) =>
      (a == null && b == null ? null : Math.round((a ?? 0) + (b ?? 0)));
    patchEntry({
      kcalIn: sum(entry?.kcalIn, add.kcal),
      proteinG: sum(entry?.proteinG, add.proteinG),
      carbsG: sum(entry?.carbsG, add.carbsG),
      fatG: sum(entry?.fatG, add.fatG),
    });
  };

  const presets = state.settings.mealPresets ?? [];

  const addMeal = (meal: MealPreset) => {
    addToEntry({ kcal: meal.kcal, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG });
    toast.show(t('„{name}“ dazugerechnet', { name: meal.name }));
  };

  const saveCurrentAsMeal = (name: string) => {
    const meal: MealPreset = {
      id: uid('meal'),
      name: name.trim(),
      kcal: entry?.kcalIn ?? null,
      proteinG: entry?.proteinG ?? null,
      carbsG: entry?.carbsG ?? null,
      fatG: entry?.fatG ?? null,
    };
    updateSettings({ mealPresets: [...presets, meal] });
    toast.show(t('„{name}“ gespeichert', { name: meal.name }));
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

      <Section
        title={t("Verbrauch an diesem Tag")}
        note={(
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setExplainOpen(true)} aria-label={t("Erklärung")}>
            <IconInfo />
          </button>
        )}
      >
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
      </Section>

      {energy.perExercise.length > 0 && (
        <Section title={t("Verbrauch je Übung")}>
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
        </Section>
      )}

      <Section
        title={t("Zufuhr")}
        note={(
          <button className="btn btn--sm" onClick={() => setFoodOpen(true)}>
            <IconCamera /> {t('Barcode')}
          </button>
        )}
      >
        {/*
          * Schneller Eintrag: gespeicherte Mahlzeiten werden dazugerechnet,
          * nicht ersetzt. Wer jeden Morgen dasselbe isst, tippt einmal.
          */}
        {presets.length > 0 && (
          <div className="chip-scroll" style={{ marginBottom: 10 }}>
            {presets.map((meal) => (
              <button key={meal.id} className="chip chip--button" onClick={() => addMeal(meal)}>
                <IconPlus style={{ width: 12, height: 12 }} /> {meal.name}
                {meal.kcal != null && <span className="dim">{' '}{meal.kcal}</span>}
              </button>
            ))}
            <button className="chip chip--button" onClick={() => setMealsOpen(true)}>{t('verwalten')}</button>
          </div>
        )}

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

        <MacroBar
          proteinG={entry?.proteinG ?? null}
          carbsG={entry?.carbsG ?? null}
          fatG={entry?.fatG ?? null}
          proteinTargetG={proteinTarget(state.profile.weightKg)}
        />

        <div className="row row--wrap" style={{ gap: 7, marginTop: 10 }}>
          <button className="btn btn--sm" onClick={() => setYazioOpen(true)}>
            <IconRefresh /> {t('Yazio')}
          </button>
          {(entry?.kcalIn != null || entry?.proteinG != null) && (
            <button className="btn btn--sm" onClick={() => setMealNameOpen(true)}>
              {t('Als Mahlzeit speichern')}
            </button>
          )}
          {presets.length > 0 && (
            <button className="btn btn--sm btn--ghost" onClick={() => setMealsOpen(true)}>
              {t('Mahlzeiten')}
            </button>
          )}
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
      </Section>

      {/*
        * Balken, keine Linie: An Ruhetagen liegt der Verbrauch auf dem
        * Alltagswert, an Trainingstagen darueber. Eine Linie dazwischen
        * behauptet einen Uebergang, den es nicht gibt - was herauskam, war
        * ein Saegezahn.
        */}
      <Section title={t("Verbrauch der letzten 30 Tage")} note={t("je Tag")}>
        {/*
          * Kuehler Ton statt Warnfarbe: Der Verbrauch ist eine Messreihe, keine
          * Warnung. Gelb bedeutet in dieser App "sieh dir das an" - und das
          * gilt hier fuer die Bilanz weiter unten, nicht fuer das Diagramm.
          */}
        <BarChart points={history.burn} unit={t("kcal")} color="var(--time)" label={t("Verbrauch je Tag")} />
        {history.intake.length > 1 && (
          <Block title={t("Zufuhr")}>
            <BarChart
              points={history.intake}
              unit={t("kcal")}
              color="color-mix(in srgb, var(--time) 52%, var(--surface-3))"
              label={t("Zufuhr je Tag")}
            />
          </Block>
        )}
      </Section>

      {yazioOpen && <YazioDialog date={date} onClose={() => setYazioOpen(false)} />}

      {foodOpen && (
        <FoodDialog
          onClose={() => setFoodOpen(false)}
          onAdd={(add, label) => {
            addToEntry(add);
            setFoodOpen(false);
            toast.show(t('„{name}“ dazugerechnet', { name: label }));
          }}
        />
      )}

      {mealsOpen && (
        <MealManager
          presets={presets}
          onClose={() => setMealsOpen(false)}
          onDelete={(id) => updateSettings({ mealPresets: presets.filter((meal) => meal.id !== id) })}
        />
      )}

      {mealNameOpen && (
        <NameDialog
          title={t('Als Mahlzeit speichern')}
          label={t('Name der Mahlzeit')}
          placeholder={t('z. B. Frühstück')}
          onClose={() => setMealNameOpen(false)}
          onSave={(name) => { saveCurrentAsMeal(name); setMealNameOpen(false); }}
        />
      )}

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

/* ----------------------------------------------------------- Makro-Balken */

/**
 * Eiweiss, Kohlenhydrate und Fett im Verhaeltnis - als ein Balken, nicht als
 * vier Zahlen. Die Anteile sind nach Kalorien gewichtet (4 / 4 / 9 kcal je
 * Gramm), weil so das Bild stimmt: 50 g Fett sind mehr als 50 g Eiweiss. Ein
 * Strich markiert das Eiweissziel.
 */
function MacroBar({
  proteinG, carbsG, fatG, proteinTargetG,
}: {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  proteinTargetG: number;
}) {
  const p = proteinG ?? 0;
  const c = carbsG ?? 0;
  const f = fatG ?? 0;
  const pKcal = p * 4;
  const cKcal = c * 4;
  const fKcal = f * 9;
  const total = pKcal + cKcal + fKcal;
  if (total <= 0) return null;

  const pct = (value: number) => `${(value / total) * 100}%`;
  const proteinTargetPct = Math.min(100, (proteinTargetG * 4 / total) * 100);
  const proteinShort = proteinTargetG - p;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="macrobar">
        <div className="macrobar__seg macrobar__seg--protein" style={{ width: pct(pKcal) }} />
        <div className="macrobar__seg macrobar__seg--carbs" style={{ width: pct(cKcal) }} />
        <div className="macrobar__seg macrobar__seg--fat" style={{ width: pct(fKcal) }} />
        {proteinTargetPct < 100 && (
          <div
            className="macrobar__mark"
            style={{ left: `${proteinTargetPct}%` }}
            title={t('Eiweißziel {g} g', { g: proteinTargetG })}
          />
        )}
      </div>
      <div className="macrobar__legend">
        <span><span className="macrobar__dot macrobar__dot--protein" />{t('Eiweiß')} {fmt(p)} g</span>
        <span><span className="macrobar__dot macrobar__dot--carbs" />{t('Kohlenhydrate')} {fmt(c)} g</span>
        <span><span className="macrobar__dot macrobar__dot--fat" />{t('Fett')} {fmt(f)} g</span>
      </div>
      {proteinShort > 3 && (
        <div className="tiny dim" style={{ marginTop: 4 }}>
          {t('noch {g} g Eiweiß bis zum Ziel', { g: fmt(proteinShort) })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ Barcode / Open Food Facts */

/**
 * Barcode nachschlagen und die Naehrwerte auf den Tag drauflegen.
 *
 * Der Kamera-Scanner braucht "BarcodeDetector" (Chrome, Edge, Android). Wo es
 * den nicht gibt, tippt man den Barcode ein - der Rest funktioniert gleich.
 */
function FoodDialog({
  onClose, onAdd,
}: {
  onClose: () => void;
  onAdd: (
    add: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null },
    label: string,
  ) => void;
}) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [grams, setGrams] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window
    && Boolean(navigator.mediaDevices?.getUserMedia);

  const search = async (value: string) => {
    if (!isBarcode(value)) { setError(t('Das ist kein gültiger Barcode.')); return; }
    setBusy(true);
    setError(null);
    const found = await lookupProduct(value);
    setBusy(false);
    if (!found) { setError(t('Dazu ist in der Datenbank nichts hinterlegt.')); return; }
    setProduct(found);
    setGrams(found.servingG ?? 100);
  };

  // Kamera-Scanner: laeuft, solange der Dialog im Scan-Modus ist.
  useEffect(() => {
    if (!scanning || !canScan) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Detector = (window as any).BarcodeDetector;
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });

    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const hits = await detector.detect(videoRef.current);
        if (hits[0]?.rawValue) {
          setScanning(false);
          setCode(hits[0].rawValue);
          void search(hits[0].rawValue);
          return;
        }
      } catch { /* zwischen zwei Frames ist ein Fehlversuch normal */ }
      raf = requestAnimationFrame(tick);
    };

    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((got) => {
        if (stopped) { got.getTracks().forEach((track) => track.stop()); return; }
        stream = got;
        if (videoRef.current) {
          videoRef.current.srcObject = got;
          void videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => { setScanning(false); setError(t('Kein Zugriff auf die Kamera.')); });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, canScan]);

  const scaled = product && grams ? scaleProduct(product, grams) : null;

  return (
    <Modal title={t('Barcode nachschlagen')} onClose={onClose}>
      <div className="list">
        {scanning ? (
          <div>
            <video ref={videoRef} className="scan-video" muted playsInline />
            <button className="btn btn--block" style={{ marginTop: 8 }} onClick={() => setScanning(false)}>
              {t('Scan abbrechen')}
            </button>
          </div>
        ) : (
          <>
            <div className="field">
              <label className="field__label">{t('Barcode')}</label>
              <div className="row" style={{ gap: 7 }}>
                <input
                  className="input"
                  inputMode="numeric"
                  value={code}
                  placeholder="4008400…"
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  onKeyDown={(event) => { if (event.key === 'Enter') void search(code); }}
                />
                <button className="btn" disabled={busy || !code} onClick={() => void search(code)}>
                  {busy ? '…' : t('Suchen')}
                </button>
              </div>
              <span className="field__hint">
                {t('Daten von Open Food Facts – kostenlos, ohne Konto. Übermittelt wird nur der Barcode.')}
              </span>
            </div>
            {canScan && (
              <button className="btn btn--block" onClick={() => { setError(null); setScanning(true); }}>
                <IconCamera /> {t('Mit der Kamera scannen')}
              </button>
            )}
          </>
        )}

        {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}

        {product && (
          <div className="card card--inset">
            <div className="bold small">{product.name}</div>
            {product.brand && <div className="tiny dim">{product.brand}</div>}
            <div className="tiny dim" style={{ marginTop: 4 }}>
              {product.kcal100 != null ? `${product.kcal100} kcal` : t('keine Kalorienangabe')}
              {product.protein100 != null && ` · ${product.protein100} g Eiweiß`}
              {' '}{t('je 100 g')}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label className="field__label">{t('Menge (g)')}</label>
              <NumberInput value={grams} min={0} onChange={setGrams} />
            </div>
            {scaled && (
              <div className="tiny" style={{ marginTop: 6 }}>
                {t('Ergibt')} {scaled.kcal ?? '–'} kcal
                {scaled.proteinG != null && ` · ${scaled.proteinG} g Eiweiß`}
              </div>
            )}
            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 10 }}
              disabled={!scaled || !grams}
              onClick={() => scaled && onAdd(scaled, product.name)}
            >
              {t('Zum Tag dazurechnen')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Kleiner Dialog fuer eine einzelne Texteingabe - statt window.prompt. */
function NameDialog({
  title, label, placeholder, onClose, onSave,
}: {
  title: string;
  label: string;
  placeholder?: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <div className="list">
        <div className="field">
          <label className="field__label">{label}</label>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            className="input"
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && value.trim()) onSave(value.trim()); }}
          />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t('Abbrechen')}</button>
          <button className="btn btn--primary" disabled={!value.trim()} onClick={() => onSave(value.trim())}>
            {t('Speichern')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- Mahlzeiten verwalten */

function MealManager({
  presets, onClose, onDelete,
}: {
  presets: MealPreset[];
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Modal title={t('Gespeicherte Mahlzeiten')} onClose={onClose}>
      <div className="list">
        {presets.length === 0 && <div className="empty tiny">{t('Noch keine gespeichert.')}</div>}
        {presets.map((meal) => (
          <div key={meal.id} className="row row--between">
            <div style={{ minWidth: 0 }}>
              <div className="small bold">{meal.name}</div>
              <div className="tiny dim">
                {meal.kcal != null && `${meal.kcal} kcal`}
                {meal.proteinG != null && ` · ${meal.proteinG} g Eiweiß`}
                {meal.carbsG != null && ` · ${meal.carbsG} g KH`}
                {meal.fatG != null && ` · ${meal.fatG} g Fett`}
              </div>
            </div>
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => onDelete(meal.id)}
              aria-label={t('Löschen')}
            >
              <IconTrash />
            </button>
          </div>
        ))}
      </div>
    </Modal>
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

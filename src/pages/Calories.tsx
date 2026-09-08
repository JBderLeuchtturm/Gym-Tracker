import { t } from '../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MealPreset } from '../types';
import {
  ACTIVITY_LABELS, GOAL_LABELS, budgetVerdict, calcDayEnergy, proteinTarget, type BudgetTone,
} from '../lib/calories';
import { addDays, formatDateShort, formatDateTiny, relativeDayLabel, todayISO } from '../lib/date';
import { useStore } from '../storage/store';
import { fetchYazioDay, parseYazioCsv } from '../api/yazio';
import {
  isBarcode, lookupProduct, scaleProduct, searchProducts, type FoodProduct,
} from '../api/foodfacts';
import { uid } from '../storage/defaults';
import { BarChart, type Point } from '../components/charts/Charts';
import { Modal, NumberInput, Section, fmt, useToast } from '../components/ui';
import {
  IconCamera, IconChevronLeft, IconChevronRight, IconInfo, IconPlus, IconRefresh, IconSearch,
  IconTrash, IconUpload,
} from '../components/icons';

const TONE_COLOR: Record<BudgetTone, string> = {
  good: 'var(--success)',
  warn: 'var(--warn)',
  open: 'var(--time)',
};

export function CaloriesPage() {
  const { state, getExercise, setNutrition, updateSettings } = useStore();
  const toast = useToast();

  const [date, setDate] = useState(todayISO());
  const [yazioOpen, setYazioOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);
  const [mealNameOpen, setMealNameOpen] = useState(false);
  /* Was nicht taeglich gebraucht wird, steht zugeklappt da - nicht gar nicht. */
  const [moreOpen, setMoreOpen] = useState(false);
  const [burnOpen, setBurnOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const workout = state.workouts.find((item) => item.date === date);
  const energy = useMemo(
    () => calcDayEnergy(state.profile, workout, getExercise, state.settings.restTimerSec),
    [state.profile, workout, getExercise, state.settings.restTimerSec],
  );

  const entry = state.nutrition.find((item) => item.date === date);
  const eaten = entry?.kcalIn ?? null;
  const proteinGoal = proteinTarget(state.profile.weightKg);
  const trained = energy.workoutKcal > 0;

  /* Verlauf: Verbrauch und Zufuhr, dazu der Schnitt der letzten sieben Tage. */
  const history = useMemo(() => {
    const burn: Point[] = [];
    const intake: Point[] = [];
    let sumIn = 0;
    let sumBurn = 0;
    let daysWithIntake = 0;
    for (let offset = 29; offset >= 0; offset -= 1) {
      const day = addDays(todayISO(), -offset);
      const dayWorkout = state.workouts.find((item) => item.date === day);
      const dayEnergy = calcDayEnergy(state.profile, dayWorkout, getExercise, state.settings.restTimerSec);
      burn.push({ label: formatDateTiny(day), value: Math.round(dayEnergy.total), detail: formatDateShort(day) });

      const dayEntry = state.nutrition.find((item) => item.date === day);
      if (dayEntry?.kcalIn != null) {
        intake.push({ label: formatDateTiny(day), value: dayEntry.kcalIn, detail: formatDateShort(day) });
        if (offset < 7) { sumIn += dayEntry.kcalIn; sumBurn += dayEnergy.total; daysWithIntake += 1; }
      }
    }
    const week = daysWithIntake > 0
      ? { avgIn: Math.round(sumIn / daysWithIntake), avgBurn: Math.round(sumBurn / daysWithIntake), days: daysWithIntake }
      : null;
    return { burn, intake, week };
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

  /* ------------------------------------------------------ Tagesbudget */
  const target = energy.target;
  const remaining = eaten == null ? target : target - eaten;
  const eatenPct = eaten == null ? 0 : Math.max(0, Math.min(112, (eaten / target) * 100));
  const verdict = eaten == null ? null : budgetVerdict(state.profile.goal, eaten, target);
  const tone: BudgetTone = verdict?.tone ?? 'open';
  // Wo das Budget ohne das heutige Training laege - als Markierung im Balken.
  const basePct = trained ? Math.min(100, ((target - energy.workoutKcal) / target) * 100) : 100;

  const protein = entry?.proteinG ?? null;
  const proteinPct = protein == null ? 0 : Math.min(100, (protein / proteinGoal) * 100);

  const activityKcal = Math.max(0, energy.tdee - energy.bmr);

  return (
    <>
      {/* Ein Tag, ein Pfeil je Richtung - schmal wie die Wochenleiste. */}
      <div className="cal-daynav">
        <button className="cal-daynav__arrow" onClick={() => setDate(addDays(date, -1))} aria-label={t("Vorheriger Tag")}>
          <IconChevronLeft />
        </button>
        <div className="cal-daynav__label">
          <span className="cal-daynav__day">{relativeDayLabel(date)}</span>
          {date !== todayISO() && <span className="tiny dim">{formatDateShort(date)}</span>}
        </div>
        <button
          className="cal-daynav__arrow"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= todayISO()}
          aria-label={t("Nächster Tag")}
        >
          <IconChevronRight />
        </button>
      </div>

      {/*
        * Die eine Frage zuerst: Wie viel darf ich heute noch essen, und passt
        * das zum Ziel? Grosse Zahl, ein Balken, ein Satz - alles andere steht
        * darunter.
        */}
      <div className="budget">
        <div className="budget__head">
          <span className="budget__caption">
            {eaten == null ? t('Budget heute') : remaining >= 0 ? t('Noch übrig') : t('Über dem Ziel')}
          </span>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            onClick={() => setExplainOpen(true)}
            aria-label={t("Wie wird gerechnet?")}
          >
            <IconInfo />
          </button>
        </div>

        <div className="budget__figure">
          <span className="budget__value" style={{ color: TONE_COLOR[tone] }}>
            {remaining < 0 ? '−' : ''}{fmt(Math.abs(remaining))}
          </span>
          <span className="budget__of">{t('von {kcal} kcal', { kcal: fmt(target) })}</span>
        </div>

        <div
          className="budget__bar"
          role="img"
          aria-label={t('{eaten} von {target} kcal gegessen', { eaten: fmt(eaten ?? 0), target: fmt(target) })}
        >
          <div
            className="budget__bar-fill"
            style={{ width: `${eatenPct}%`, background: TONE_COLOR[tone] }}
          />
          {trained && basePct < 100 && (
            <div className="budget__bar-mark" style={{ left: `${basePct}%` }} title={t('Budget ohne Training')} />
          )}
        </div>

        <div className="budget__foot">
          <span>{t('{kcal} gegessen', { kcal: fmt(eaten ?? 0) })}</span>
          <span className="budget__dot">·</span>
          <span>
            {t('{kcal} verbraucht', { kcal: fmt(energy.total) })}
            {trained && <span className="dim">{t(' (+{kcal} Training)', { kcal: fmt(energy.workoutKcal) })}</span>}
          </span>
        </div>

        {verdict && (
          <div className={`budget__verdict budget__verdict--${tone}`}>
            {t(verdict.label)}
          </div>
        )}
      </div>

      {/*
        * Eiweiss steht als Zeile unter dem Budget, nicht mehr als eigene Karte.
        * Es ist der eine Naehrwert, der beim Training zaehlt - aber es ist eine
        * Zahl, kein Kapitel.
        */}
      <div className="macro-line">
        <span className="macro-line__label">{t('Eiweiß')}</span>
        <div className="progress-bar" style={{ flex: 1 }}>
          <div
            className="progress-bar__fill"
            style={{
              width: `${proteinPct}%`,
              background: proteinPct >= 100 ? 'var(--success)' : 'var(--time)',
            }}
          />
        </div>
        <span className="mono nowrap">
          <span className={proteinPct >= 100 ? 'pos' : ''}>{fmt(protein ?? 0)}</span>
          <span className="dim"> / {proteinGoal} g</span>
        </span>
      </div>

      {/* -------------------------------------------------------- Eintragen */}
      <Section
        title={t("Eintragen")}
        note={(
          <button className="btn btn--sm" onClick={() => setFoodOpen(true)}>
            <IconSearch /> {t('Suchen')}
          </button>
        )}
      >
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

        {/*
          * Zwei Felder, nicht vier. Kohlenhydrate und Fett trägt fast niemand
          * von Hand ein - aus der Lebensmittelsuche kommen sie ohnehin mit,
          * und wer sie doch tippen will, klappt sie auf.
          */}
        <div className="grid-2">
          <div className="field">
            <label className="field__label">{t("Kalorien (kcal)")}</label>
            <NumberInput value={entry?.kcalIn ?? null} min={0} onChange={(value) => patchEntry({ kcalIn: value })} />
          </div>
          <div className="field">
            <label className="field__label">{t("Protein (g)")}</label>
            <NumberInput value={entry?.proteinG ?? null} min={0} onChange={(value) => patchEntry({ proteinG: value })} />
          </div>
        </div>

        <div className="row row--wrap" style={{ gap: 7, marginTop: 12 }}>
          <button className="btn btn--sm" onClick={() => setFoodOpen(true)}>
            <IconCamera /> {t('Suchen / Barcode')}
          </button>
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
          >
            {moreOpen ? t('Weniger') : t('Mehr')}
          </button>
        </div>

        {moreOpen && (
          <div className="list" style={{ marginTop: 12 }}>
            <div className="grid-2">
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
            />

            <div className="row row--wrap" style={{ gap: 7 }}>
              <button className="btn btn--sm" onClick={() => setYazioOpen(true)}>
                <IconRefresh /> {t('Yazio')}
              </button>
              {(entry?.kcalIn != null || entry?.proteinG != null) && (
                <button className="btn btn--sm btn--ghost" onClick={() => setMealNameOpen(true)}>
                  {t('Als Mahlzeit speichern')}
                </button>
              )}
            </div>
          </div>
        )}

        {entry?.source === 'yazio' && (
          <div className="tiny dim" style={{ marginTop: 8 }}>{t("Werte stammen aus Yazio.")}</div>
        )}
      </Section>

      {/* --------------------------------------------------------- Verbrauch */}
      <Section
        title={t("Verbrauch")}
        note={t('{kcal} kcal · Ziel „{goal}“', {
          kcal: fmt(energy.total), goal: t(GOAL_LABELS[state.profile.goal]),
        })}
      >
        {/*
          * Der geschaetzte Verbrauch je Uebung steht offen da, nicht mehr
          * hinter einem Aufklapper: Das ist die Zahl, wegen der man an einem
          * Trainingstag ueberhaupt hierher kommt.
          */}
        {energy.perExercise.length > 0 ? (
          <div className="burn-rows">
            {energy.perExercise.map((row) => (
              <div key={row.exerciseId} className="burn-rows__row">
                <span className="muted">{row.name}</span>
                <span className="dim tiny">{fmt(row.minutes)} min</span>
                <span className="mono">{fmt(row.kcal)}</span>
              </div>
            ))}
            <div className="burn-rows__row burn-rows__row--total">
              <span className="bold">{t('Training gesamt')}</span>
              <span />
              <span className="bold mono">{fmt(energy.workoutKcal)} kcal</span>
            </div>
          </div>
        ) : (
          <div className="tiny dim">{t('An diesem Tag kein Training – gerechnet wird nur der Alltag.')}</div>
        )}

        <button
          className="btn btn--sm btn--ghost"
          style={{ marginTop: 10, alignSelf: 'flex-start' }}
          onClick={() => setBurnOpen(!burnOpen)}
          aria-expanded={burnOpen}
        >
          {burnOpen ? t('Weniger') : t('Woraus sich das zusammensetzt')}
        </button>

        {burnOpen && (
        <div className="burn-rows" style={{ marginTop: 10 }}>
          <div className="burn-rows__row">
            <span className="muted">{t('Grundumsatz')}</span>
            <span className="dim tiny">{t('im Ruhezustand')}</span>
            <span className="mono">{fmt(energy.bmr)}</span>
          </div>
          <div className="burn-rows__row">
            <span className="muted">{t('Bewegung im Alltag')}</span>
            <span className="dim tiny">{t(ACTIVITY_LABELS[state.profile.activityLevel]).split(' (')[0]}</span>
            <span className="mono">+{fmt(activityKcal)}</span>
          </div>
          <div className="burn-rows__row">
            <span className="muted">{t('Training')}</span>
            <span className="dim tiny">
              {energy.workoutMinutes > 0
                ? t('{min} min{estimated}', { min: fmt(energy.workoutMinutes), estimated: energy.estimated ? ' (gesch.)' : '' })
                : t('kein Training')}
            </span>
            <span className="mono">{energy.workoutKcal > 0 ? `+${fmt(energy.workoutKcal)}` : '0'}</span>
          </div>
          <div className="burn-rows__row burn-rows__row--total">
            <span className="bold">{t('Verbrauch')}</span>
            <span />
            <span className="bold mono">{fmt(energy.total)} kcal</span>
          </div>
        </div>
        )}
      </Section>

      {/*
        * Der Verlauf ist nichts, was man taeglich braucht - er bleibt erhalten,
        * steht aber nicht mehr im Weg.
        */}
      {history.intake.length > 0 && !historyOpen && (
        <button className="btn btn--sm btn--block" onClick={() => setHistoryOpen(true)}>
          {t('Verlauf der letzten 30 Tage zeigen')}
        </button>
      )}

      {history.intake.length > 0 && historyOpen && (
        <Section
          title={t("Verlauf")}
          note={(
            <button className="btn btn--sm btn--ghost" onClick={() => setHistoryOpen(false)}>
              {t('Ausblenden')}
            </button>
          )}
        >
          {history.week && (
            <div className="grid-3" style={{ marginBottom: 12 }}>
              <div className="cal-avg">
                <span className="cal-avg__label">{t('Ø gegessen')}</span>
                <span className="cal-avg__value">{fmt(history.week.avgIn)}</span>
              </div>
              <div className="cal-avg">
                <span className="cal-avg__label">{t('Ø verbraucht')}</span>
                <span className="cal-avg__value">{fmt(history.week.avgBurn)}</span>
              </div>
              <div className="cal-avg">
                <span className="cal-avg__label">{t('Ø Bilanz')}</span>
                <span
                  className="cal-avg__value"
                  style={{ color: history.week.avgIn - history.week.avgBurn >= 0 ? 'var(--warn)' : 'var(--time)' }}
                >
                  {history.week.avgIn - history.week.avgBurn >= 0 ? '+' : '−'}
                  {fmt(Math.abs(history.week.avgIn - history.week.avgBurn))}
                </span>
              </div>
            </div>
          )}
          {/*
            * Balken, keine Linie: An Ruhetagen liegt der Verbrauch auf dem
            * Alltagswert, an Trainingstagen darueber. Eine Linie dazwischen
            * behauptet einen Uebergang, den es nicht gibt.
            */}
          <BarChart points={history.burn} unit={t("kcal")} color="var(--time)" label={t("Verbrauch je Tag")} />
          {history.intake.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div className="section-label" style={{ marginBottom: 6 }}>{t('Zufuhr')}</div>
              <BarChart
                points={history.intake}
                height={96}
                unit={t("kcal")}
                color="color-mix(in srgb, var(--time) 52%, var(--surface-3))"
                label={t("Zufuhr je Tag")}
              />
            </div>
          )}
        </Section>
      )}

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
 * Gramm), weil so das Bild stimmt: 50 g Fett sind mehr als 50 g Eiweiss. Das
 * Eiweissziel steht oben in seinem eigenen Balken - hier geht es nur um die
 * Aufteilung.
 */
function MacroBar({
  proteinG, carbsG, fatG,
}: {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
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

  return (
    <div style={{ marginTop: 12 }}>
      <div className="macrobar">
        <div className="macrobar__seg macrobar__seg--protein" style={{ width: pct(pKcal) }} />
        <div className="macrobar__seg macrobar__seg--carbs" style={{ width: pct(cKcal) }} />
        <div className="macrobar__seg macrobar__seg--fat" style={{ width: pct(fKcal) }} />
      </div>
      <div className="macrobar__legend">
        <span><span className="macrobar__dot macrobar__dot--protein" />{t('Eiweiß')} {fmt(p)} g</span>
        <span><span className="macrobar__dot macrobar__dot--carbs" />{t('Kohlenhydrate')} {fmt(c)} g</span>
        <span><span className="macrobar__dot macrobar__dot--fat" />{t('Fett')} {fmt(f)} g</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- Lebensmittel suchen */

/**
 * Ein Feld fuer beides: eine Ziffernfolge wird als Barcode nachgeschlagen,
 * alles andere als Suchbegriff. Dazu, wo der Browser es kann, der Kamera-Scanner.
 * Daten von Open Food Facts - kostenlos, ohne Konto; uebermittelt wird nur die
 * Eingabe.
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
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<FoodProduct[] | null>(null);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [grams, setGrams] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window
    && Boolean(navigator.mediaDevices?.getUserMedia);

  const pick = (found: FoodProduct) => {
    setProduct(found);
    setGrams(found.servingG ?? 100);
    setHits(null);
  };

  const run = async (value: string) => {
    const term = value.trim();
    if (term.length < 2) return;
    setBusy(true);
    setError(null);
    setProduct(null);
    if (isBarcode(term)) {
      const found = await lookupProduct(term);
      setBusy(false);
      if (found) pick(found);
      else setError(t('Zu diesem Barcode ist nichts hinterlegt.'));
      return;
    }
    const list = await searchProducts(term);
    setBusy(false);
    setHits(list);
    if (list.length === 0) setError(t('Dazu wurde nichts gefunden.'));
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
        const found = await detector.detect(videoRef.current);
        if (found[0]?.rawValue) {
          setScanning(false);
          setQuery(found[0].rawValue);
          void run(found[0].rawValue);
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
    <Modal title={t('Lebensmittel suchen')} onClose={onClose} flush>
      {scanning ? (
        <div style={{ padding: 14 }}>
          <video ref={videoRef} className="scan-video" muted playsInline />
          <button className="btn btn--block" style={{ marginTop: 8 }} onClick={() => setScanning(false)}>
            {t('Scan abbrechen')}
          </button>
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 14px 8px' }}>
            <div className="row" style={{ gap: 7 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <IconSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-dim)' }} />
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input
                  className="input"
                  style={{ paddingLeft: 32 }}
                  autoFocus
                  value={query}
                  placeholder={t('Name oder Barcode')}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void run(query); }}
                />
              </div>
              {canScan && (
                <button
                  className="btn btn--icon"
                  onClick={() => { setError(null); setScanning(true); }}
                  aria-label={t('Mit der Kamera scannen')}
                >
                  <IconCamera />
                </button>
              )}
              <button className="btn" disabled={busy || query.trim().length < 2} onClick={() => void run(query)}>
                {busy ? '…' : t('Suchen')}
              </button>
            </div>
            <div className="field__hint" style={{ marginTop: 6 }}>
              {t('Daten von Open Food Facts – kostenlos, ohne Konto.')}
            </div>
          </div>

          {error && (
            <div className="small" style={{ color: 'var(--danger)', padding: '0 14px 10px' }}>{error}</div>
          )}

          {hits && hits.length > 0 && (
            <div style={{ maxHeight: '46vh', overflowY: 'auto' }}>
              {hits.map((item) => (
                <button
                  key={`${item.barcode}-${item.name}`}
                  className="search-result"
                  onClick={() => pick(item)}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="search-result__name">{item.name}</span>
                    <span className="search-result__meta" style={{ display: 'block' }}>
                      {item.brand && `${item.brand} · `}
                      {item.kcal100 != null && t('{kcal} kcal / 100 g', { kcal: item.kcal100 })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {product && (
        <div style={{ padding: 14 }}>
          <div className="card card--inset">
            <div className="bold small">{product.name}</div>
            {product.brand && <div className="tiny dim">{product.brand}</div>}
            <div className="tiny dim" style={{ marginTop: 4 }}>
              {product.kcal100 != null ? t('{kcal} kcal', { kcal: product.kcal100 }) : t('keine Kalorienangabe')}
              {product.protein100 != null && ` · ${product.protein100} g ${t('Eiweiß')}`}
              {' '}{t('je 100 g')}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label className="field__label">{t('Menge (g)')}</label>
              <NumberInput value={grams} min={0} onChange={setGrams} />
            </div>
            {scaled && (
              <div className="tiny" style={{ marginTop: 6 }}>
                {t('Ergibt')} {scaled.kcal ?? '–'} kcal
                {scaled.proteinG != null && ` · ${scaled.proteinG} g ${t('Eiweiß')}`}
              </div>
            )}
            <button
              className="btn btn--primary btn--block"
              style={{ marginTop: 10 }}
              disabled={!scaled || !grams || product.kcal100 == null}
              onClick={() => scaled && onAdd(scaled, product.name)}
            >
              {product.kcal100 == null ? t('Keine Nährwerte hinterlegt') : t('Zum Tag dazurechnen')}
            </button>
            <button
              className="btn btn--ghost btn--block btn--sm"
              style={{ marginTop: 6 }}
              onClick={() => { setProduct(null); if (!isBarcode(query.trim())) void run(query); }}
            >
              {t('Zurück zur Suche')}
            </button>
          </div>
        </div>
      )}
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

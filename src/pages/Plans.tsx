import { exerciseName, t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import type {
  Exercise, ExerciseCategory, Plan, PlanCycle, PlanExercise, Weekday,
} from '../types';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, startOfWeek, weekdayOf, todayISO } from '../lib/date';
import { DEFAULT_CYCLE, cycleWeek } from '../lib/cycle';
import { CATEGORY_LABELS } from '../data/catalog';
import { useStore } from '../storage/store';
import { emptyDays, uid } from '../storage/defaults';
import { PLAN_TEMPLATES, buildTemplatePlan } from '../data/templates';
import { ExercisePicker } from '../components/ExercisePicker';
import { ConfirmDialog, DateInput, EmptyState, Modal, NumberInput, useToast } from '../components/ui';
import {
  IconCheck, IconChevronDown, IconCopy, IconEdit, IconPlus, IconPrinter, IconShare, IconTrash,
} from '../components/icons';
import { customToExercises, decodePlan, encodePlan } from '../lib/planShare';
import { printPlan } from '../lib/exportData';

/**
 * Der Kurzname eines Trainingstags fuer die schmale Spalte.
 *
 * "Push (Brust / Schulter / Trizeps)" bricht in 50 Pixeln mitten im Wort ab.
 * Der Teil vor der Klammer sagt dasselbe und passt.
 */
const shortTitle = (title: string): string => {
  const trimmed = title.trim();
  const cut = trimmed.indexOf(' (');
  return cut > 0 ? trimmed.slice(0, cut) : trimmed;
};

export function PlansPage() {
  const {
    state, addPlan, updatePlan, deletePlan, setActivePlan, getExercise, addExercise,
    snapshot, replaceState,
  } = useStore();
  const toast = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const editing = state.plans.find((plan) => plan.id === editingId) ?? null;
  const sharing = state.plans.find((plan) => plan.id === sharingId) ?? null;

  const createEmpty = () => {
    const now = new Date().toISOString();
    const plan: Plan = {
      id: uid('plan'),
      name: `Plan ${state.plans.length + 1}`,
      days: emptyDays(),
      createdAt: now,
      updatedAt: now,
    };
    addPlan(plan);
    setEditingId(plan.id);
  };

  const duplicate = (plan: Plan) => {
    const now = new Date().toISOString();
    addPlan({
      ...plan,
      id: uid('plan'),
      name: `${plan.name} (Kopie)`,
      createdAt: now,
      updatedAt: now,
      days: plan.days.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise) => ({ ...exercise, id: uid('pe') })),
      })),
    });
    toast.show(t("Plan kopiert"));
  };

  return (
    <>
      <div className="row row--between">
        <div>
          <h2>{t("Deine Pläne")}</h2>
          <div className="tiny dim">{t("Der aktive Plan bestimmt, was dir jeden Tag angezeigt wird.")}</div>
        </div>
      </div>

      <div className="list">
        {state.plans.map((plan) => {
          const isActive = plan.id === state.activePlanId;
          const trainingDays = plan.days.filter((day) => !day.isRestDay && day.exercises.length > 0);
          const totalExercises = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);

          return (
            <div key={plan.id} className="card" style={isActive ? { borderColor: 'var(--accent)' } : undefined}>
              <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 7 }}>
                    <span className="bold">{plan.name}</span>
                    {isActive && <span className="chip chip--accent">{t("aktiv")}</span>}
                  </div>
                  {plan.description && <div className="tiny dim" style={{ marginTop: 2 }}>{t(plan.description)}</div>}
                  <div className="tiny dim" style={{ marginTop: 4 }}>
                    {trainingDays.length} Trainingstage · {totalExercises} Übungen
                  </div>
                </div>
              </div>

              {/*
                * Sieben Spalten mit dem Namen des Tages darin. Vorher stand
                * je Tag nur eine Zahl und der Titel im title-Attribut - auf
                * dem Handy also nirgends. Man musste den Editor oeffnen, um
                * den eigenen Plan zu lesen.
                */}
              <div className="weeksheet" style={{ margin: '11px 0' }}>
                {plan.days.map((day, index) => {
                  const empty = day.isRestDay || day.exercises.length === 0;
                  const focus = dominantCategory(day, getExercise);
                  return (
                    <div
                      key={day.weekday}
                      className={`weeksheet__day ${empty ? '' : 'weeksheet__day--plan'}`}
                      title={empty ? t('Ruhetag') : `${day.title} · ${t(CATEGORY_LABELS[focus])}`}
                    >
                      <span className="weeksheet__wd">{t(WEEKDAY_SHORT[index])}</span>
                      <span className="weeksheet__title weeksheet__title--strong">
                        {empty ? t('frei') : shortTitle(day.title)}
                      </span>
                      {!empty && (
                        <span className="weeksheet__sets">
                          {t('{count} Üb.', { count: day.exercises.length })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="row row--wrap" style={{ gap: 7 }}>
                {!isActive && (
                  <button className="btn btn--sm btn--primary" onClick={() => { setActivePlan(plan.id); toast.show(t('„{name}“ ist jetzt aktiv', { name: plan.name })); }}>
                    <IconCheck /> {t('Aktivieren')}
                  </button>
                )}
                <button className="btn btn--sm" onClick={() => setEditingId(plan.id)}><IconEdit /> {t("Bearbeiten")}</button>
                <button className="btn btn--sm" onClick={() => duplicate(plan)}><IconCopy /> {t("Kopie")}</button>
                <button className="btn btn--sm" onClick={() => setSharingId(plan.id)}>
                  <IconShare /> {t("Teilen")}
                </button>
                <button
                  className="btn btn--sm"
                  onClick={() => printPlan(plan, (id) => exerciseName(getExercise(id)))}
                  title={t('Zum Mitnehmen in der Sporttasche')}
                >
                  <IconPrinter /> {t('Drucken')}
                </button>
                <span className="spacer" />
                {state.plans.length > 1 && (
                  <button className="btn btn--sm btn--ghost" onClick={() => setDeletingId(plan.id)} aria-label={t("Plan löschen")}>
                    <IconTrash />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row row--wrap" style={{ gap: 8 }}>
        <button className="btn btn--primary" onClick={createEmpty}><IconPlus /> {t("Leerer Plan")}</button>
        <button className="btn" onClick={() => setTemplatesOpen(true)}>{t("Aus Vorlage")}</button>
        <button className="btn" onClick={() => setImportOpen(true)}>{t("Plan einfügen")}</button>
      </div>

      {sharing && (
        <SharePlanDialog
          plan={sharing}
          getExercise={getExercise}
          onClose={() => setSharingId(null)}
        />
      )}

      {importOpen && (
        <ImportPlanDialog
          onClose={() => setImportOpen(false)}
          onImport={(plan, exercises) => {
            for (const exercise of exercises) addExercise(exercise);
            addPlan(plan);
            setImportOpen(false);
            setEditingId(plan.id);
            toast.show(t('„{name}“ übernommen', { name: plan.name }));
          }}
        />
      )}

      {editing && (
        <PlanEditor
          plan={editing}
          onClose={() => setEditingId(null)}
          onChange={(updater) => updatePlan(editing.id, updater)}
          getExercise={getExercise}
        />
      )}

      {templatesOpen && (
        <Modal title={t("Vorlage wählen")} onClose={() => setTemplatesOpen(false)}>
          <div className="list">
            {PLAN_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className="card"
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => {
                  const plan = buildTemplatePlan(template);
                  addPlan(plan);
                  setTemplatesOpen(false);
                  setEditingId(plan.id);
                  toast.show(t('„{name}“ erstellt', { name: plan.name }));
                }}
              >
                <div className="bold">{t(template.name)}</div>
                <div className="tiny dim" style={{ marginTop: 3 }}>{t(template.description)}</div>
                <div className="row row--wrap tiny" style={{ gap: 5, marginTop: 7 }}>
                  {template.days.filter((day) => day.exercises.length > 0).map((day) => (
                    <span key={day.weekday} className="chip">{t(WEEKDAY_SHORT[day.weekday])}: {t(day.title)}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {deletingId && (
        <ConfirmDialog
          title={t("Plan löschen?")}
          message={t('Bereits aufgezeichnete Trainings bleiben erhalten – nur der Plan verschwindet.')}
          onCancel={() => setDeletingId(null)}
          onConfirm={() => {
            const before = snapshot();
            deletePlan(deletingId);
            setDeletingId(null);
            toast.show(t('Plan gelöscht'), { label: t('Rückgängig'), run: () => replaceState(before) });
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ Plan-Editor */

function PlanEditor({
  plan, onClose, onChange, getExercise,
}: {
  plan: Plan;
  onClose: () => void;
  onChange: (updater: (plan: Plan) => Plan) => void;
  getExercise: (id: string) => Exercise | undefined;
}) {
  /*
   * Der Editor oeffnet auf dem heutigen Tag - es sei denn, heute ist frei.
   * Dann landete man bisher auf einer leeren Seite und musste erst suchen,
   * wo ueberhaupt etwas drinsteht.
   */
  const [activeDay, setActiveDay] = useState<Weekday>(() => {
    const today = weekdayOf(todayISO()) as Weekday;
    const day = plan.days[today];
    if (day && !day.isRestDay && day.exercises.length > 0) return today;
    const firstTrainingDay = plan.days.findIndex(
      (item) => !item.isRestDay && item.exercises.length > 0,
    );
    return (firstTrainingDay >= 0 ? firstTrainingDay : today) as Weekday;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<PlanExercise | null>(null);

  const day = plan.days[activeDay];

  const patchDay = (patch: Partial<typeof day>) => {
    onChange((current) => ({
      ...current,
      days: current.days.map((item, index) => (index === activeDay ? { ...item, ...patch } : item)),
    }));
  };

  const addExercise = (exercise: Exercise) => {
    patchDay({
      isRestDay: false,
      title: day.isRestDay || !day.title || day.title === 'Ruhetag' ? suggestTitle(exercise) : day.title,
      exercises: [
        ...day.exercises,
        {
          id: uid('pe'),
          exerciseId: exercise.id,
          targetSets: 3,
          targetRepsMin: exercise.kind === 'cardio' || exercise.kind === 'time' ? null : 8,
          targetRepsMax: exercise.kind === 'cardio' || exercise.kind === 'time' ? null : 12,
          targetWeightKg: null,
          restSec: 120,
        },
      ],
    });
    setPickerOpen(false);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...day.exercises];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchDay({ exercises: next });
  };

  const removeExercise = (id: string) => {
    patchDay({ exercises: day.exercises.filter((item) => item.id !== id) });
  };

  const patchExercise = (id: string, patch: Partial<PlanExercise>) => {
    patchDay({
      exercises: day.exercises.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  return (
    <Modal title={t("Plan bearbeiten")} onClose={onClose}>
      <div className="list">
        <div className="field">
          <label className="field__label">{t("Name des Plans")}</label>
          <input
            className="input"
            value={plan.name}
            onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field__label">{t("Beschreibung (optional)")}</label>
          <input
            className="input"
            value={plan.description ?? ''}
            placeholder={t("z. B. 4er-Split, Fokus Oberkörper")}
            onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
          />
        </div>

        <CycleEditor plan={plan} onChange={onChange} />

        <div className="divider" />

        <div className="day-strip">
          {plan.days.map((item, index) => {
            const classes = [
              'day-strip__item',
              index === activeDay ? 'day-strip__item--active' : '',
            ].filter(Boolean).join(' ');
            return (
              <button key={item.weekday} className={classes} onClick={() => setActiveDay(index as Weekday)}>
                <span>{t(WEEKDAY_SHORT[index])}</span>
                <span className="day-strip__num" style={{ fontSize: '0.8rem' }}>
                  {item.isRestDay || item.exercises.length === 0 ? '–' : item.exercises.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="card">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <span className="section-label">{t(WEEKDAY_NAMES[activeDay])}</span>
            <label className="row tiny" style={{ gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={day.isRestDay}
                onChange={(event) => patchDay({ isRestDay: event.target.checked })}
              />
              Ruhetag
            </label>
          </div>

          {!day.isRestDay && (
            <>
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="field__label">{t("Bezeichnung des Tages")}</label>
                <input
                  className="input"
                  value={day.title}
                  placeholder={t("z. B. Push, Oberkörper, Beine")}
                  onChange={(event) => patchDay({ title: event.target.value })}
                />
              </div>

              {day.exercises.length === 0 ? (
                <EmptyState title={t("Noch keine Übungen an diesem Tag")} />
              ) : (
                <div className="list">
                  {day.exercises.map((planExercise, index) => {
                    const exercise = getExercise(planExercise.exerciseId);
                    return (
                      <div key={planExercise.id} className="card" style={{ background: 'var(--surface-2)', padding: 11 }}>
                        <div className="row row--between">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="bold small">{exercise?.name ?? 'Unbekannte Übung'}</div>
                            <div className="tiny dim">
                              {exercise ? t(CATEGORY_LABELS[exercise.category]) : ''}
                              {' · '}
                              {planExercise.targetSets} Sätze
                              {planExercise.targetRepsMin ? ` × ${planExercise.targetRepsMin}${
                                planExercise.targetRepsMax && planExercise.targetRepsMax !== planExercise.targetRepsMin
                                  ? `–${planExercise.targetRepsMax}` : ''} Wdh` : ''}
                              {planExercise.restSec ? ` · ${planExercise.restSec}s Pause` : ''}
                            </div>
                          </div>
                          <div className="row" style={{ gap: 3 }}>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("Nach oben")}>
                              <IconChevronDown style={{ transform: 'rotate(180deg)' }} />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => move(index, 1)} disabled={index === day.exercises.length - 1} aria-label={t("Nach unten")}>
                              <IconChevronDown />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setEditingExercise(planExercise)} aria-label={t("Vorgaben bearbeiten")}>
                              <IconEdit />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => removeExercise(planExercise.id)} aria-label={t("Entfernen")}>
                              <IconTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button className="btn btn--block" style={{ marginTop: 11 }} onClick={() => setPickerOpen(true)}>
                <IconPlus /> {t('Übung zu {day} hinzufügen', { day: t(WEEKDAY_NAMES[activeDay]) })}
              </button>
            </>
          )}

          {day.isRestDay && (
            <div className="tiny dim">
              An Ruhetagen werden keine Übungen vorgeschlagen. Du kannst trotzdem spontan trainieren.
            </div>
          )}
        </div>

        <CopyDayRow activeDay={activeDay} onChange={onChange} />
      </div>

      {pickerOpen && (
        <ExercisePicker
          title={t('Übung für {day}', { day: t(WEEKDAY_NAMES[activeDay]) })}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
          excludeIds={day.exercises.map((item) => item.exerciseId)}
        />
      )}

      {editingExercise && (
        <TargetEditor
          planExercise={editingExercise}
          exerciseName={exerciseName(getExercise(editingExercise.exerciseId))}
          onClose={() => setEditingExercise(null)}
          onSave={(patch) => { patchExercise(editingExercise.id, patch); setEditingExercise(null); }}
        />
      )}
    </Modal>
  );
}

/** Kopiert einen Tag auf beliebig viele andere Wochentage. */
function CopyDayRow({
  activeDay, onChange,
}: {
  activeDay: Weekday;
  onChange: (updater: (plan: Plan) => Plan) => void;
}) {
  const toast = useToast();
  const [targets, setTargets] = useState<Weekday[]>([]);
  const options = useMemo(
    () => ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((weekday) => weekday !== activeDay),
    [activeDay],
  );

  // Wechselt der bearbeitete Tag, passt die alte Auswahl nicht mehr.
  useEffect(() => { setTargets([]); }, [activeDay]);

  const toggle = (weekday: Weekday) => setTargets((current) => (
    current.includes(weekday)
      ? current.filter((entry) => entry !== weekday)
      : [...current, weekday]
  ));

  const copy = () => {
    if (targets.length === 0) return;
    const chosen = new Set(targets);
    onChange((current) => {
      const source = current.days[activeDay];
      return {
        ...current,
        days: current.days.map((day, index) => (
          chosen.has(index as Weekday)
            ? {
                ...day,
                title: source.title,
                isRestDay: source.isRestDay,
                // Jeder Zieltag bekommt eigene IDs, sonst zeigen zwei Tage auf denselben Eintrag.
                exercises: source.exercises.map((exercise) => ({ ...exercise, id: uid('pe') })),
              }
            : day
        )),
      };
    });
    toast.show(targets.length === 1
      ? t('Auf einen Tag kopiert')
      : t('Auf {count} Tage kopiert', { count: targets.length }));
    setTargets([]);
  };

  return (
    <div className="list">
      <div className="row row--between">
        <span className="section-label">{t("Diesen Tag kopieren nach")}</span>
        <button
          className="chip chip--button"
          onClick={() => setTargets(targets.length === options.length ? [] : options)}
        >
          {targets.length === options.length ? t('Keinen') : t('Alle')}
        </button>
      </div>

      <div className="row row--wrap" style={{ gap: 6 }}>
        {options.map((weekday) => (
          <button
            key={weekday}
            className={`chip chip--button ${targets.includes(weekday) ? 'chip--accent' : ''}`}
            aria-pressed={targets.includes(weekday)}
            onClick={() => toggle(weekday)}
          >
            {t(WEEKDAY_SHORT[weekday])}
          </button>
        ))}
      </div>

      <button className="btn btn--block" disabled={targets.length === 0} onClick={copy}>
        <IconCopy /> {targets.length === 0
          ? t('Zieltage wählen')
          : t('Auf {count} Tage kopieren', { count: targets.length })}
      </button>

      {targets.length > 0 && (
        <div className="tiny dim">
          {t("Was dort steht, wird überschrieben.")}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- Vorgaben-Editor */

function TargetEditor({
  planExercise, exerciseName, onClose, onSave,
}: {
  planExercise: PlanExercise;
  exerciseName: string;
  onClose: () => void;
  onSave: (patch: Partial<PlanExercise>) => void;
}) {
  const [sets, setSets] = useState<number | null>(planExercise.targetSets);
  const [repsMin, setRepsMin] = useState<number | null>(planExercise.targetRepsMin);
  const [repsMax, setRepsMax] = useState<number | null>(planExercise.targetRepsMax);
  const [weight, setWeight] = useState<number | null>(planExercise.targetWeightKg);
  const [rest, setRest] = useState<number | null>(planExercise.restSec);
  const [note, setNote] = useState(planExercise.note ?? '');
  const [progression, setProgression] = useState<number | null>(
    planExercise.progressionKg ?? null,
  );

  return (
    <Modal title={exerciseName || t('Vorgaben')} onClose={onClose}>
      <div className="list">
        <div className="grid-3">
          <div className="field">
            <label className="field__label">{t("Sätze")}</label>
            <NumberInput value={sets} min={1} max={20} onChange={setSets} />
          </div>
          <div className="field">
            <label className="field__label">{t("Wdh von")}</label>
            <NumberInput value={repsMin} min={0} onChange={setRepsMin} />
          </div>
          <div className="field">
            <label className="field__label">{t("Wdh bis")}</label>
            <NumberInput value={repsMax} min={0} onChange={setRepsMax} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="field__label">{t("Zielgewicht (kg)")}</label>
            <NumberInput value={weight} min={0} onChange={setWeight} placeholder={t("optional")} />
          </div>
          <div className="field">
            <label className="field__label">{t("Pause (Sekunden)")}</label>
            <NumberInput value={rest} min={0} max={600} onChange={setRest} />
          </div>
        </div>
        <div className="field">
          <label className="field__label">{t("Steigerung (kg)")}</label>
          <NumberInput
            value={progression}
            min={0}
            max={20}
            step={0.5}
            onChange={setProgression}
            placeholder={t("automatisch")}
          />
          <span className="field__hint">
            {t("Schaffst du in allen Sätzen das obere Ende des Wiederholungsbereichs, schlägt die App beim nächsten Mal so viel mehr vor. 0 = keine automatische Steigerung, leer = Faustregel.")}
          </span>
        </div>

        <div className="field">
          <label className="field__label">{t("Notiz")}</label>
          <input className="input" value={note} placeholder={t("z. B. langsam ablassen")} onChange={(event) => setNote(event.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t("Abbrechen")}</button>
          <button
            className="btn btn--primary"
            onClick={() => onSave({
              targetSets: sets ?? 3,
              targetRepsMin: repsMin,
              targetRepsMax: repsMax,
              targetWeightKg: weight,
              restSec: rest,
              progressionKg: progression,
              note: note.trim() || undefined,
            })}
          >
            Speichern
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Die Muskelgruppe, die an einem Tag am haeufigsten vorkommt - faerbt den Wochenstreifen. */
function dominantCategory(
  day: { exercises: PlanExercise[] },
  getExercise: (id: string) => Exercise | undefined,
): ExerciseCategory {
  const tally = new Map<ExerciseCategory, number>();
  for (const item of day.exercises) {
    const category = getExercise(item.exerciseId)?.category;
    if (category) tally.set(category, (tally.get(category) ?? 0) + 1);
  }
  let best: ExerciseCategory = 'other';
  let bestCount = 0;
  for (const [category, count] of tally) {
    if (count > bestCount) { best = category; bestCount = count; }
  }
  return best;
}

/** Schlaegt anhand der ersten Uebung einen Tagesnamen vor. */
function suggestTitle(exercise: Exercise): string {
  const map: Record<string, string> = {
    chest: 'Brust & Trizeps',
    back: 'Rücken & Bizeps',
    legs: 'Beine',
    shoulders: 'Schultern',
    arms: 'Arme',
    core: 'Rumpf',
    glutes: 'Gesäß & Beine',
    cardio: 'Cardio',
    fullbody: 'Ganzkörper',
    mobility: 'Mobility',
    other: 'Training',
  };
  return map[exercise.category] ?? 'Training';
}


/* ------------------------------------------------------------------ Zyklus */

/**
 * Mehrwoechiger Zyklus eines Plans. Ohne Zyklus bleibt jede Woche gleich -
 * das ist voellig in Ordnung und deshalb auch der Standard.
 */
function CycleEditor({
  plan, onChange,
}: {
  plan: Plan;
  onChange: (updater: (plan: Plan) => Plan) => void;
}) {
  const cycle = plan.cycle ?? null;
  const [open, setOpen] = useState(Boolean(cycle));

  const patch = (next: Partial<PlanCycle>) => onChange((current) => ({
    ...current,
    cycle: { ...DEFAULT_CYCLE, startDate: startOfWeek(todayISO()), ...(current.cycle ?? {}), ...next },
  }));

  const enable = (on: boolean) => {
    if (on) {
      onChange((current) => ({
        ...current,
        cycle: { ...DEFAULT_CYCLE, startDate: startOfWeek(todayISO()) },
      }));
      setOpen(true);
    } else {
      onChange((current) => ({ ...current, cycle: null }));
      setOpen(false);
    }
  };

  return (
    <div className="card card--inset">
      <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
        <input type="checkbox" checked={Boolean(cycle)} onChange={(event) => enable(event.target.checked)} />
        <span className="small">
          {t("Zyklus über mehrere Wochen")}
          <span className="tiny dim" style={{ display: 'block' }}>
            {t("Die Zielgewichte steigen Woche für Woche und fallen in der Entlastungswoche zurück.")}
          </span>
        </span>
      </label>

      {cycle && open && (
        <>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="field">
              <label className="field__label">{t("Wochen")}</label>
              <NumberInput
                value={cycle.weeks}
                min={2}
                max={16}
                onChange={(value) => patch({ weeks: Math.max(2, value ?? 4) })}
              />
            </div>
            <div className="field">
              <label className="field__label">{t("Steigerung je Woche (%)")}</label>
              <NumberInput
                value={cycle.stepPct}
                min={0}
                max={20}
                step={0.5}
                onChange={(value) => patch({ stepPct: value ?? 0 })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field__label">{t("Entlastungswoche")}</label>
              <select
                className="select"
                value={cycle.deloadWeek ?? ''}
                onChange={(event) => patch({
                  deloadWeek: event.target.value === '' ? null : Number(event.target.value),
                })}
              >
                <option value="">{t("keine")}</option>
                {Array.from({ length: cycle.weeks }, (_, index) => index + 1).map((week) => (
                  <option key={week} value={week}>{t('Woche {week}', { week })}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">{t("Entlastung auf (%)")}</label>
              <NumberInput
                value={cycle.deloadPct}
                min={20}
                max={100}
                onChange={(value) => patch({ deloadPct: value ?? 60 })}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label">{t("Start des Zyklus")}</label>
            <DateInput
              value={cycle.startDate}
              onChange={(next) => patch({ startDate: startOfWeek(next || todayISO()) })}
            />
            <span className="field__hint">
              {t("Gerechnet wird ab dem Montag dieser Woche. Danach beginnt der Zyklus von vorn.")}
            </span>
          </div>

          <div className="row row--wrap" style={{ gap: 6 }}>
            {Array.from({ length: cycle.weeks }, (_, index) => index + 1).map((week) => {
              const isDeloadWeek = cycle.deloadWeek === week;
              const factor = isDeloadWeek
                ? cycle.deloadPct / 100
                : 1 + (cycle.stepPct / 100) * (week - 1);
              const current = cycleWeek(cycle, todayISO()) === week;
              return (
                <span
                  key={week}
                  className={`chip ${current ? 'chip--accent' : isDeloadWeek ? 'chip--warn' : ''}`}
                >
                  {t('W{week}', { week })} · {Math.round(factor * 100)} %
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


/* --------------------------------------------------------- Plaene weitergeben */

/**
 * Zeigt den Textbaustein zum Weitergeben. Bewusst ohne Server: Der Baustein
 * geht per Nachricht raus, der Empfaenger fuegt ihn unter "Plan einfügen" ein.
 */
function SharePlanDialog({
  plan, getExercise, onClose,
}: {
  plan: Plan;
  getExercise: (id: string) => Exercise | undefined;
  onClose: () => void;
}) {
  const toast = useToast();
  const code = useMemo(() => encodePlan(plan, getExercise), [plan, getExercise]);
  const message = t('Mein Trainingsplan „{name}“ für den Gym-Tracker:', { name: plan.name });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${message}\n\n${code}`);
      toast.show(t('In die Zwischenablage kopiert'));
    } catch {
      toast.show(t('Kopieren hat nicht geklappt – markier den Text von Hand'));
    }
  };

  const share = async () => {
    if (!navigator.share) { void copy(); return; }
    try {
      await navigator.share({ title: plan.name, text: `${message}\n\n${code}` });
    } catch {
      /* Abgebrochen ist kein Fehler. */
    }
  };

  return (
    <Modal title={t('„{name}“ teilen', { name: plan.name })} onClose={onClose}>
      <div className="list">
        <p className="small muted">
          {t("Schick diesen Baustein per Nachricht weiter. Wer ihn bekommt, fügt ihn unter „Plan einfügen“ ein und hat den Plan samt Vorgaben. Es werden nur der Plan und die darin benutzten eigenen Übungen weitergegeben – keine Trainingsdaten.")}
        </p>

        <textarea
          className="textarea mono"
          readOnly
          rows={5}
          value={code}
          onFocus={(event) => event.currentTarget.select()}
          style={{ fontSize: '0.72rem' }}
        />

        <div className="grid-2">
          <button className="btn" onClick={copy}>{t('Kopieren')}</button>
          <button className="btn btn--primary" onClick={share}>
            <IconShare /> {t('Weitergeben')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Nimmt einen Textbaustein entgegen und macht daraus einen eigenen Plan. */
function ImportPlanDialog({
  onClose, onImport,
}: {
  onClose: () => void;
  onImport: (plan: Plan, exercises: Exercise[]) => void;
}) {
  const { allExercises } = useStore();
  const [text, setText] = useState('');

  const known = useMemo(() => new Set(allExercises.map((exercise) => exercise.id)), [allExercises]);
  const decoded = useMemo(
    () => (text.trim() ? decodePlan(text, (id) => known.has(id), () => uid('pe')) : null),
    [text, known],
  );

  const take = () => {
    if (!decoded) return;
    const now = new Date().toISOString();
    const plan: Plan = {
      id: uid('plan'),
      name: decoded.name,
      description: decoded.description,
      days: decoded.days,
      cycle: decoded.cycle
        ? {
            weeks: decoded.cycle.w,
            deloadWeek: decoded.cycle.dw,
            stepPct: decoded.cycle.sp,
            deloadPct: decoded.cycle.dp,
            startDate: startOfWeek(todayISO()),
          }
        : null,
      createdAt: now,
      updatedAt: now,
    };
    const missing = customToExercises(decoded.custom).filter((item) => !known.has(item.id));
    onImport(plan, missing);
  };

  return (
    <Modal title={t('Plan einfügen')} onClose={onClose}>
      <div className="list">
        <p className="small muted">
          {t("Füge hier den Baustein ein, den dir jemand geschickt hat. Dein eigener Plan bleibt unangetastet – der neue kommt zusätzlich dazu.")}
        </p>

        <textarea
          className="textarea"
          rows={5}
          placeholder="GTPLAN1:…"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        {text.trim() && !decoded && (
          <div className="tiny" style={{ color: 'var(--danger)' }}>
            {t("Damit kann ich nichts anfangen. Kopier den Baustein noch einmal vollständig.")}
          </div>
        )}

        {decoded && (
          <div className="card card--inset">
            <div className="bold">{decoded.name}</div>
            {decoded.description && <div className="tiny dim">{decoded.description}</div>}
            <div className="row row--wrap" style={{ gap: 6, marginTop: 8 }}>
              {decoded.days.map((day) => (
                <span key={day.weekday} className="chip">
                  {t(WEEKDAY_SHORT[day.weekday])}: {day.isRestDay ? t('frei') : day.exercises.length}
                </span>
              ))}
            </div>
            {decoded.unknownCount > 0 && (
              <div className="tiny" style={{ color: 'var(--warn)', marginTop: 8 }}>
                {t('{count} Übungen kennst du nicht – die bleiben im Plan leer und lassen sich ersetzen.', { count: decoded.unknownCount })}
              </div>
            )}
          </div>
        )}

        <button className="btn btn--primary btn--block" disabled={!decoded} onClick={take}>
          {t('Plan übernehmen')}
        </button>
      </div>
    </Modal>
  );
}

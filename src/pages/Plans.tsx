import { useMemo, useState } from 'react';
import type { Exercise, Plan, PlanExercise, Weekday } from '../types';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOf, todayISO } from '../lib/date';
import { CATEGORY_LABELS } from '../data/catalog';
import { useStore } from '../storage/store';
import { emptyDays, uid } from '../storage/defaults';
import { PLAN_TEMPLATES, buildTemplatePlan } from '../data/templates';
import { ExercisePicker } from '../components/ExercisePicker';
import { ConfirmDialog, EmptyState, Modal, NumberInput, useToast } from '../components/ui';
import {
  IconCheck, IconChevronDown, IconCopy, IconEdit, IconPlus, IconTrash,
} from '../components/icons';

export function PlansPage() {
  const { state, addPlan, updatePlan, deletePlan, setActivePlan, getExercise } = useStore();
  const toast = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const editing = state.plans.find((plan) => plan.id === editingId) ?? null;

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
    toast.show('Plan kopiert');
  };

  return (
    <>
      <div className="row row--between">
        <div>
          <h2>Deine Pläne</h2>
          <div className="tiny dim">Der aktive Plan bestimmt, was dir jeden Tag angezeigt wird.</div>
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
                    {isActive && <span className="chip chip--accent">aktiv</span>}
                  </div>
                  {plan.description && <div className="tiny dim" style={{ marginTop: 2 }}>{plan.description}</div>}
                  <div className="tiny dim" style={{ marginTop: 4 }}>
                    {trainingDays.length} Trainingstage · {totalExercises} Übungen
                  </div>
                </div>
              </div>

              <div className="day-strip" style={{ margin: '11px 0' }}>
                {plan.days.map((day, index) => (
                  <div
                    key={day.weekday}
                    className="day-strip__item"
                    style={{
                      cursor: 'default',
                      background: day.isRestDay || day.exercises.length === 0 ? 'var(--surface-2)' : 'var(--accent-soft)',
                      borderColor: day.isRestDay || day.exercises.length === 0 ? 'var(--border-soft)' : 'transparent',
                      color: day.isRestDay || day.exercises.length === 0 ? 'var(--text-dim)' : 'var(--accent)',
                    }}
                    title={day.isRestDay ? 'Ruhetag' : day.title}
                  >
                    <span>{WEEKDAY_SHORT[index]}</span>
                    <span className="day-strip__num" style={{ fontSize: '0.78rem', color: 'inherit' }}>
                      {day.isRestDay || day.exercises.length === 0 ? '–' : day.exercises.length}
                    </span>
                  </div>
                ))}
              </div>

              <div className="row row--wrap" style={{ gap: 7 }}>
                {!isActive && (
                  <button className="btn btn--sm btn--primary" onClick={() => { setActivePlan(plan.id); toast.show(`„${plan.name}“ ist jetzt aktiv`); }}>
                    <IconCheck /> Aktivieren
                  </button>
                )}
                <button className="btn btn--sm" onClick={() => setEditingId(plan.id)}><IconEdit /> Bearbeiten</button>
                <button className="btn btn--sm" onClick={() => duplicate(plan)}><IconCopy /> Kopie</button>
                <span className="spacer" />
                {state.plans.length > 1 && (
                  <button className="btn btn--sm btn--ghost" onClick={() => setDeletingId(plan.id)} aria-label="Plan löschen">
                    <IconTrash />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-2">
        <button className="btn btn--primary" onClick={createEmpty}><IconPlus /> Leerer Plan</button>
        <button className="btn" onClick={() => setTemplatesOpen(true)}>Aus Vorlage</button>
      </div>

      {editing && (
        <PlanEditor
          plan={editing}
          onClose={() => setEditingId(null)}
          onChange={(updater) => updatePlan(editing.id, updater)}
          getExercise={getExercise}
        />
      )}

      {templatesOpen && (
        <Modal title="Vorlage wählen" onClose={() => setTemplatesOpen(false)}>
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
                  toast.show(`„${plan.name}“ erstellt`);
                }}
              >
                <div className="bold">{template.name}</div>
                <div className="tiny dim" style={{ marginTop: 3 }}>{template.description}</div>
                <div className="row row--wrap tiny" style={{ gap: 5, marginTop: 7 }}>
                  {template.days.filter((day) => day.exercises.length > 0).map((day) => (
                    <span key={day.weekday} className="chip">{WEEKDAY_SHORT[day.weekday]}: {day.title}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {deletingId && (
        <ConfirmDialog
          title="Plan löschen?"
          message="Bereits aufgezeichnete Trainings bleiben erhalten – nur der Plan verschwindet."
          onCancel={() => setDeletingId(null)}
          onConfirm={() => { deletePlan(deletingId); setDeletingId(null); toast.show('Plan gelöscht'); }}
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
  const [activeDay, setActiveDay] = useState<Weekday>(weekdayOf(todayISO()) as Weekday);
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
    <Modal title="Plan bearbeiten" onClose={onClose}>
      <div className="list">
        <div className="field">
          <label className="field__label">Name des Plans</label>
          <input
            className="input"
            value={plan.name}
            onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field__label">Beschreibung (optional)</label>
          <input
            className="input"
            value={plan.description ?? ''}
            placeholder="z. B. 4er-Split, Fokus Oberkörper"
            onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
          />
        </div>

        <div className="divider" />

        <div className="day-strip">
          {plan.days.map((item, index) => {
            const classes = [
              'day-strip__item',
              index === activeDay ? 'day-strip__item--active' : '',
            ].filter(Boolean).join(' ');
            return (
              <button key={item.weekday} className={classes} onClick={() => setActiveDay(index as Weekday)}>
                <span>{WEEKDAY_SHORT[index]}</span>
                <span className="day-strip__num" style={{ fontSize: '0.8rem' }}>
                  {item.isRestDay || item.exercises.length === 0 ? '–' : item.exercises.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="card">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <span className="section-label">{WEEKDAY_NAMES[activeDay]}</span>
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
                <label className="field__label">Bezeichnung des Tages</label>
                <input
                  className="input"
                  value={day.title}
                  placeholder="z. B. Push, Oberkörper, Beine"
                  onChange={(event) => patchDay({ title: event.target.value })}
                />
              </div>

              {day.exercises.length === 0 ? (
                <EmptyState icon="➕" title="Noch keine Übungen an diesem Tag" />
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
                              {exercise ? CATEGORY_LABELS[exercise.category] : ''}
                              {' · '}
                              {planExercise.targetSets} Sätze
                              {planExercise.targetRepsMin ? ` × ${planExercise.targetRepsMin}${
                                planExercise.targetRepsMax && planExercise.targetRepsMax !== planExercise.targetRepsMin
                                  ? `–${planExercise.targetRepsMax}` : ''} Wdh` : ''}
                              {planExercise.restSec ? ` · ${planExercise.restSec}s Pause` : ''}
                            </div>
                          </div>
                          <div className="row" style={{ gap: 3 }}>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Nach oben">
                              <IconChevronDown style={{ transform: 'rotate(180deg)' }} />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => move(index, 1)} disabled={index === day.exercises.length - 1} aria-label="Nach unten">
                              <IconChevronDown />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setEditingExercise(planExercise)} aria-label="Vorgaben bearbeiten">
                              <IconEdit />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => removeExercise(planExercise.id)} aria-label="Entfernen">
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
                <IconPlus /> Übung zu {WEEKDAY_NAMES[activeDay]} hinzufügen
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
          title={`Übung für ${WEEKDAY_NAMES[activeDay]}`}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
          excludeIds={day.exercises.map((item) => item.exerciseId)}
        />
      )}

      {editingExercise && (
        <TargetEditor
          planExercise={editingExercise}
          exerciseName={getExercise(editingExercise.exerciseId)?.name ?? ''}
          onClose={() => setEditingExercise(null)}
          onSave={(patch) => { patchExercise(editingExercise.id, patch); setEditingExercise(null); }}
        />
      )}
    </Modal>
  );
}

/** Kopiert einen Tag auf einen anderen Wochentag. */
function CopyDayRow({
  activeDay, onChange,
}: {
  activeDay: Weekday;
  onChange: (updater: (plan: Plan) => Plan) => void;
}) {
  const [target, setTarget] = useState<Weekday | ''>('');
  const options = useMemo(
    () => ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((weekday) => weekday !== activeDay),
    [activeDay],
  );

  return (
    <div className="row" style={{ gap: 8 }}>
      <select
        className="select"
        value={target}
        onChange={(event) => setTarget(event.target.value === '' ? '' : (Number(event.target.value) as Weekday))}
      >
        <option value="">Diesen Tag kopieren nach…</option>
        {options.map((weekday) => <option key={weekday} value={weekday}>{WEEKDAY_NAMES[weekday]}</option>)}
      </select>
      <button
        className="btn"
        disabled={target === ''}
        onClick={() => {
          if (target === '') return;
          onChange((current) => {
            const source = current.days[activeDay];
            return {
              ...current,
              days: current.days.map((day, index) =>
                index === target
                  ? {
                      ...day,
                      title: source.title,
                      isRestDay: source.isRestDay,
                      exercises: source.exercises.map((exercise) => ({ ...exercise, id: uid('pe') })),
                    }
                  : day,
              ),
            };
          });
          setTarget('');
        }}
      >
        Kopieren
      </button>
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

  return (
    <Modal title={exerciseName || 'Vorgaben'} onClose={onClose}>
      <div className="list">
        <div className="grid-3">
          <div className="field">
            <label className="field__label">Sätze</label>
            <NumberInput value={sets} min={1} max={20} onChange={setSets} />
          </div>
          <div className="field">
            <label className="field__label">Wdh von</label>
            <NumberInput value={repsMin} min={0} onChange={setRepsMin} />
          </div>
          <div className="field">
            <label className="field__label">Wdh bis</label>
            <NumberInput value={repsMax} min={0} onChange={setRepsMax} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="field__label">Zielgewicht (kg)</label>
            <NumberInput value={weight} min={0} onChange={setWeight} placeholder="optional" />
          </div>
          <div className="field">
            <label className="field__label">Pause (Sekunden)</label>
            <NumberInput value={rest} min={0} max={600} onChange={setRest} />
          </div>
        </div>
        <div className="field">
          <label className="field__label">Notiz</label>
          <input className="input" value={note} placeholder="z. B. langsam ablassen" onChange={(event) => setNote(event.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button
            className="btn btn--primary"
            onClick={() => onSave({
              targetSets: sets ?? 3,
              targetRepsMin: repsMin,
              targetRepsMax: repsMax,
              targetWeightKg: weight,
              restSec: rest,
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

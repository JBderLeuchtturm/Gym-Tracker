import { exerciseName, t } from '../i18n';
import { Fragment, useEffect, useMemo, useState } from 'react';
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
  IconCalendar, IconCheck, IconChevronDown, IconCopy, IconEdit, IconLink, IconPlus, IconPrinter, IconShare,
  IconGoal, IconTimer, IconTrash,
} from '../components/icons';
import { goalsFromPlan } from '../lib/weeklyGoals';
import { customToExercises, decodePlan, encodePlan } from '../lib/planShare';
import { printPlan } from '../lib/exportData';
import { isNativeApp } from '../native/platform';
import { plannedWeeklyLoad } from '../lib/planVolume';
import { loadStatus } from '../lib/muscleLoad';
import { tidyGroups } from '../lib/planGroups';
import { categoryColor } from '../lib/categoryColors';
import { TRACKING_LABELS, fieldsOf, resolveTracking, targetText } from '../lib/tracking';
import { TargetFields, TrackingPicker, type TargetValues } from '../components/ExerciseTargets';

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
  const [previewId, setPreviewId] = useState<string | null>(null);

  const editing = state.plans.find((plan) => plan.id === editingId) ?? null;
  const sharing = state.plans.find((plan) => plan.id === sharingId) ?? null;
  const preview = state.plans.find((plan) => plan.id === previewId) ?? null;

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
                      style={empty ? undefined : { '--cat': categoryColor(focus) } as React.CSSProperties}
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
                {!isActive && (
                  <button className="btn btn--sm" onClick={() => setPreviewId(plan.id)}>
                    {t('Vorschau')}
                  </button>
                )}
                <button className="btn btn--sm" onClick={() => setEditingId(plan.id)}><IconEdit /> {t("Bearbeiten")}</button>
                <button className="btn btn--sm" onClick={() => duplicate(plan)}><IconCopy /> {t("Kopie")}</button>
                <button className="btn btn--sm" onClick={() => setSharingId(plan.id)}>
                  <IconShare /> {t("Teilen")}
                </button>
                {/* Drucken kann die Android-App nicht - dort fehlt der Knopf. */}
                {!isNativeApp() && (
                  <button
                    className="btn btn--sm"
                    onClick={() => printPlan(plan, (id) => exerciseName(getExercise(id)))}
                    title={t('Zum Mitnehmen in der Sporttasche')}
                  >
                    <IconPrinter /> {t('Drucken')}
                  </button>
                )}
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

      {preview && (
        <PlanPreviewDialog
          plan={preview}
          getExercise={getExercise}
          onClose={() => setPreviewId(null)}
          onActivate={() => {
            setActivePlan(preview.id);
            setPreviewId(null);
            toast.show(t('„{name}“ ist jetzt aktiv', { name: preview.name }));
          }}
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
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  const day = plan.days[activeDay];

  const patchDay = (patch: Partial<typeof day>) => {
    onChange((current) => ({
      ...current,
      days: current.days.map((item, index) => (index === activeDay ? { ...item, ...patch } : item)),
    }));
  };

  const addExercise = (exercise: Exercise) => {
    const fields = fieldsOf(resolveTracking(exercise));
    patchDay({
      isRestDay: false,
      title: day.isRestDay || !day.title || day.title === 'Ruhetag' ? suggestTitle(exercise) : day.title,
      exercises: [
        ...day.exercises,
        {
          id: uid('pe'),
          exerciseId: exercise.id,
          targetSets: fields.distance ? 1 : 3,
          targetRepsMin: fields.reps ? 8 : null,
          targetRepsMax: fields.reps ? 12 : null,
          targetWeightKg: null,
          targetDurationSec: fields.time ? (fields.distance ? 1800 : 30) : null,
          restSec: fields.distance ? 0 : 120,
        },
      ],
    });
    setPickerOpen(false);
  };

  /**
   * Koppelt eine Uebung an die darueber - oder loest sie wieder.
   *
   * Beim Koppeln wandert die ganze Gruppe der unteren Uebung mit, beim Loesen
   * alles ab dieser Stelle. Danach raeumt `tidyGroups` auf: Eine "Gruppe" aus
   * einer einzigen Uebung ist keine.
   */
  const toggleLink = (index: number) => {
    if (index <= 0) return;
    const list = [...day.exercises];
    const above = list[index - 1];
    const item = list[index];
    if (item.groupId && item.groupId === above.groupId) {
      const oldId = item.groupId;
      const fresh = uid('grp');
      for (let position = index; position < list.length && list[position].groupId === oldId; position += 1) {
        list[position] = { ...list[position], groupId: fresh };
      }
    } else {
      const id = above.groupId ?? uid('grp');
      const oldId = item.groupId;
      list[index - 1] = { ...above, groupId: id };
      for (let position = index; position < list.length; position += 1) {
        if (position > index && (!oldId || list[position].groupId !== oldId)) break;
        list[position] = { ...list[position], groupId: id };
      }
    }
    patchDay({ exercises: tidyGroups(list) });
  };

  const patchGroup = (groupId: string, patch: (item: PlanExercise, last: boolean) => PlanExercise) => {
    const members = day.exercises.filter((item) => item.groupId === groupId);
    const lastId = members[members.length - 1]?.id;
    patchDay({
      exercises: day.exercises.map((item) => (item.groupId === groupId ? patch(item, item.id === lastId) : item)),
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...day.exercises];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchDay({ exercises: tidyGroups(next) });
  };

  const removeExercise = (id: string) => {
    patchDay({ exercises: tidyGroups(day.exercises.filter((item) => item.id !== id)) });
  };

  /** Verschiebt einen Eintrag auf einen anderen Wochentag - statt loeschen und neu anlegen. */
  const moveToDay = (id: string, target: Weekday) => {
    const item = day.exercises.find((entry) => entry.id === id);
    setMovingId(null);
    if (!item || target === activeDay) return;
    const exercise = getExercise(item.exerciseId);
    onChange((current) => ({
      ...current,
      days: current.days.map((entry, index) => {
        if (index === activeDay) {
          return { ...entry, exercises: entry.exercises.filter((one) => one.id !== id) };
        }
        if (index === target) {
          const wasEmpty = entry.isRestDay || !entry.title || entry.title === 'Ruhetag';
          return {
            ...entry,
            isRestDay: false,
            title: wasEmpty && exercise ? suggestTitle(exercise) : entry.title,
            exercises: [...entry.exercises, { ...item }],
          };
        }
        return entry;
      }),
    }));
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
                <div className="list plan-day">
                  {day.exercises.map((planExercise, index) => {
                    const exercise = getExercise(planExercise.exerciseId);
                    const mode = resolveTracking(exercise, planExercise);
                    const above = index > 0 ? day.exercises[index - 1] : null;
                    const linkedAbove = Boolean(planExercise.groupId && planExercise.groupId === above?.groupId);
                    const startsGroup = Boolean(planExercise.groupId) && !linkedAbove;
                    const members = planExercise.groupId
                      ? day.exercises.filter((item) => item.groupId === planExercise.groupId)
                      : [];
                    return (
                      <Fragment key={planExercise.id}>
                      {/*
                        * Zwischen zwei Uebungen ein Kettenglied: antippen koppelt
                        * sie zum Supersatz. Genau dort, wo man es sucht - nicht in
                        * einem Menue, das man erst oeffnen muss.
                        */}
                      {index > 0 && (
                        <button
                          className={`plan-link ${linkedAbove ? 'plan-link--on' : ''}`}
                          onClick={() => toggleLink(index)}
                          aria-pressed={linkedAbove}
                          aria-label={linkedAbove ? t('Supersatz lösen') : t('Mit Übung darüber koppeln')}
                        >
                          <IconLink />
                          <span>{linkedAbove ? t('gekoppelt') : t('koppeln')}</span>
                        </button>
                      )}
                      {startsGroup && members.length > 1 && (
                        <GroupHeader
                          members={members}
                          onEdit={() => setEditingGroup(planExercise.groupId ?? null)}
                        />
                      )}
                      <div
                        className={`card plan-ex ${planExercise.groupId && members.length > 1 ? 'plan-ex--grouped' : ''}`}
                        style={{ background: 'var(--surface-2)', padding: 11 }}
                      >
                        {/*
                          * Fuenf Symbolknoepfe brauchen mit ausreichend grosser
                          * Trefferflaeche (40px) mehr Platz, als auf einem
                          * schmalen Telefon neben dem Uebungsnamen frei bleibt.
                          * "row--wrap" laesst sie dann in eine eigene Zeile
                          * fallen, statt Namen oder Knoepfe zusammenzudruecken.
                          */}
                        <div className="row row--between row--wrap" style={{ rowGap: 8 }}>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <div className="bold small">{exercise?.name ?? 'Unbekannte Übung'}</div>
                            <div className="tiny dim">
                              {exercise ? t(CATEGORY_LABELS[exercise.category]) : ''}
                              {' · '}
                              <span className="mono">{targetText(planExercise, mode)}</span>
                              {mode !== resolveTracking(exercise) && (
                                <span className="chip plan-ex__mode">{t(TRACKING_LABELS[mode])}</span>
                              )}
                              {planExercise.restSec && !planExercise.groupId ? ` · ${planExercise.restSec}s Pause` : ''}
                            </div>
                          </div>
                          <div className="row" style={{ gap: 6 }}>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("Nach oben")}>
                              <IconChevronDown style={{ transform: 'rotate(180deg)' }} />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => move(index, 1)} disabled={index === day.exercises.length - 1} aria-label={t("Nach unten")}>
                              <IconChevronDown />
                            </button>
                            <button
                              className={`btn btn--ghost btn--icon btn--sm ${movingId === planExercise.id ? 'btn--on' : ''}`}
                              onClick={() => setMovingId(movingId === planExercise.id ? null : planExercise.id)}
                              aria-label={t("Auf anderen Tag verschieben")}
                            >
                              <IconCalendar />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setEditingExercise(planExercise)} aria-label={t("Vorgaben bearbeiten")}>
                              <IconEdit />
                            </button>
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => removeExercise(planExercise.id)} aria-label={t("Entfernen")}>
                              <IconTrash />
                            </button>
                          </div>
                        </div>

                        {movingId === planExercise.id && (
                          <div className="row row--wrap" style={{ gap: 5, marginTop: 8 }}>
                            <span className="tiny dim" style={{ alignSelf: 'center' }}>{t('Verschieben nach')}</span>
                            {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((weekday) => weekday !== activeDay).map((weekday) => (
                              <button
                                key={weekday}
                                className="chip chip--button"
                                onClick={() => moveToDay(planExercise.id, weekday)}
                              >
                                {t(WEEKDAY_SHORT[weekday])}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      </Fragment>
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

        <WeeklyLoadPanel plan={plan} getExercise={getExercise} />
      </div>

      {pickerOpen && (
        <ExercisePicker
          title={t('Übung für {day}', { day: t(WEEKDAY_NAMES[activeDay]) })}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
          excludeIds={day.exercises.map((item) => item.exerciseId)}
        />
      )}

      {editingGroup && (
        <GroupEditor
          members={day.exercises.filter((item) => item.groupId === editingGroup)}
          getExercise={getExercise}
          onClose={() => setEditingGroup(null)}
          onChange={(patch) => patchGroup(editingGroup, patch)}
        />
      )}

      {editingExercise && (
        <TargetEditor
          planExercise={editingExercise}
          exerciseName={exerciseName(getExercise(editingExercise.exerciseId))}
          getExercise={getExercise}
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
  planExercise, exerciseName, getExercise, onClose, onSave,
}: {
  planExercise: PlanExercise;
  exerciseName: string;
  getExercise: (id: string) => Exercise | undefined;
  onClose: () => void;
  onSave: (patch: Partial<PlanExercise>) => void;
}) {
  const { updateExercise } = useStore();
  const exercise = getExercise(planExercise.exerciseId);
  const [targets, setTargets] = useState<TargetValues>(() => ({
    tracking: resolveTracking(exercise, planExercise),
    targetSets: planExercise.targetSets,
    targetRepsMin: planExercise.targetRepsMin,
    targetRepsMax: planExercise.targetRepsMax,
    targetWeightKg: planExercise.targetWeightKg,
    targetDurationSec: planExercise.targetDurationSec ?? null,
    targetDistanceKm: planExercise.targetDistanceKm ?? null,
    restSec: planExercise.restSec,
  }));
  /*
   * Gilt die Erfassung nur hier oder fuer die Uebung ueberall? Standard ist
   * "nur hier": Wer im Zirkel Liegestuetze auf Zeit macht, will sie im
   * Oberkoerpertag trotzdem zaehlen.
   */
  const [everywhere, setEverywhere] = useState(false);
  const [note, setNote] = useState(planExercise.note ?? '');
  const [progression, setProgression] = useState<number | null>(
    planExercise.progressionKg ?? null,
  );
  const [alts, setAlts] = useState<string[]>(planExercise.alternativeIds ?? []);
  const [pickAlt, setPickAlt] = useState(false);

  const patch = (next: Partial<TargetValues>) => setTargets((current) => {
    const merged = { ...current, ...next };
    /*
     * Beim Wechsel auf eine Zeit-Erfassung ohne Zeit steht sonst "3 × ?" im
     * Plan. 30 Sekunden sind der haeufigste Wert fuer Halten und Intervalle,
     * 30 Minuten fuer eine Runde Ausdauer.
     */
    if (next.tracking && fieldsOf(next.tracking).time && merged.targetDurationSec == null) {
      merged.targetDurationSec = next.tracking === 'distance_time' ? 1800 : 30;
    }
    return merged;
  });

  const save = () => {
    const defaultMode = resolveTracking(exercise ? { ...exercise, tracking: undefined } : undefined);
    if (everywhere && exercise) {
      updateExercise(exercise.id, { tracking: targets.tracking === defaultMode ? undefined : targets.tracking });
    }
    onSave({
      tracking: everywhere || targets.tracking === resolveTracking(exercise) ? undefined : targets.tracking,
      targetSets: targets.targetSets || 1,
      targetRepsMin: targets.targetRepsMin,
      targetRepsMax: targets.targetRepsMax,
      targetWeightKg: targets.targetWeightKg,
      targetDurationSec: targets.targetDurationSec,
      targetDistanceKm: targets.targetDistanceKm,
      restSec: targets.restSec,
      progressionKg: progression,
      note: note.trim() || undefined,
      alternativeIds: alts.length > 0 ? alts : undefined,
    });
  };

  return (
    <Modal title={exerciseName || t('Vorgaben')} onClose={onClose}>
      <div className="list">
        <div className="field">
          <span className="field__label">{t('Wie wird erfasst?')}</span>
          <TrackingPicker value={targets.tracking} onChange={(tracking) => patch({ tracking })} />
          {exercise && (
            <label className="row tiny" style={{ gap: 7, marginTop: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={everywhere} onChange={(event) => setEverywhere(event.target.checked)} />
              {t('Für „{name}“ überall so erfassen', { name: exerciseName })}
            </label>
          )}
        </div>

        <TargetFields value={targets} onChange={patch} />

        {targets.tracking === 'weight_reps' && (
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
        )}

        <div className="field">
          <label className="field__label">{t("Notiz")}</label>
          <input className="input" value={note} placeholder={t("z. B. langsam ablassen")} onChange={(event) => setNote(event.target.value)} />
        </div>

        {/*
          * Ersatzuebungen fuer den Fall, dass das Geraet besetzt ist. Der
          * Ersatz-Dialog im Training stellt sie nach oben, statt jedes Mal neu
          * zu raten.
          */}
        <div className="field">
          <label className="field__label">{t("Ersatzübungen")}</label>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {alts.map((id) => (
              <button
                key={id}
                className="chip chip--button"
                onClick={() => setAlts(alts.filter((one) => one !== id))}
              >
                {exerciseNameOf(getExercise(id))} ✕
              </button>
            ))}
            <button className="chip chip--button chip--accent" onClick={() => setPickAlt(true)}>
              {t('Hinzufügen')}
            </button>
          </div>
          <span className="field__hint">{t("Werden im Training oben vorgeschlagen, wenn du „Ersatz“ tippst.")}</span>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t("Abbrechen")}</button>
          <button className="btn btn--primary" onClick={save}>{t('Speichern')}</button>
        </div>
      </div>

      {pickAlt && (
        <ExercisePicker
          title={t('Ersatz für {name}', { name: exerciseName })}
          onPick={(picked) => { setAlts([...alts, picked.id]); setPickAlt(false); }}
          onClose={() => setPickAlt(false)}
          excludeIds={[planExercise.exerciseId, ...alts]}
        />
      )}
    </Modal>
  );
}

const exerciseNameOf = (exercise: Exercise | undefined): string =>
  exercise?.name ?? 'Übung';

/* --------------------------------------------------------- Plan-Vorschau */

/**
 * Der ganze Plan zum Durchlesen, bevor man ihn aktiviert - Tag fuer Tag mit
 * allen Uebungen und Vorgaben, dazu das Wochenvolumen je Muskelgruppe.
 */
function PlanPreviewDialog({
  plan, getExercise, onClose, onActivate,
}: {
  plan: Plan;
  getExercise: (id: string) => Exercise | undefined;
  onClose: () => void;
  onActivate: () => void;
}) {
  return (
    <Modal title={plan.name} onClose={onClose}>
      <div className="list">
        {plan.description && <p className="small muted">{t(plan.description)}</p>}

        {plan.days.map((day, index) => {
          if (day.isRestDay || day.exercises.length === 0) return null;
          return (
            <div key={day.weekday} className="card card--inset">
              <div className="row row--between" style={{ marginBottom: 6 }}>
                <span className="bold small">{t(WEEKDAY_NAMES[index])}</span>
                <span className="tiny dim">{day.title}</span>
              </div>
              <div className="list" style={{ gap: 4 }}>
                {day.exercises.map((planExercise) => {
                  const exercise = getExercise(planExercise.exerciseId);
                  const reps = planExercise.targetRepsMin
                    ? ` × ${planExercise.targetRepsMin}${
                        planExercise.targetRepsMax && planExercise.targetRepsMax !== planExercise.targetRepsMin
                          ? `–${planExercise.targetRepsMax}` : ''}`
                    : '';
                  return (
                    <div key={planExercise.id} className="row row--between small">
                      <span>{exercise?.name ?? t('Unbekannte Übung')}</span>
                      <span className="tiny dim mono nowrap">{planExercise.targetSets}{reps}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <WeeklyLoadPanel plan={plan} getExercise={getExercise} />

        <button className="btn btn--primary btn--block" onClick={onActivate}>
          <IconCheck /> {t('Diesen Plan aktivieren')}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Wochenvolumen je Muskelgruppe aus den Vorgaben des Plans. Zeigt vor dem
 * ersten Training, wo zu wenig steht und wo zu viel.
 */
function WeeklyLoadPanel({
  plan, getExercise,
}: {
  plan: Plan;
  getExercise: (id: string) => Exercise | undefined;
}) {
  const { state, updateSettings, snapshot, replaceState } = useStore();
  const toast = useToast();
  const load = useMemo(
    () => plannedWeeklyLoad(plan, getExercise, state.settings.weeklySetTargets).filter((entry) => entry.sets > 0),
    [plan, getExercise, state.settings.weeklySetTargets],
  );

  /*
   * Der Plan sagt schon, was eine Woche bringen soll - also kann er auch das
   * Ziel sein. Ein Tipper statt acht Zahlen abzuschreiben, mit Rueckgaengig.
   */
  const adoptGoals = () => {
    const before = snapshot();
    const suggestion = goalsFromPlan(plan, state, getExercise, todayISO());
    updateSettings({ weeklyGoals: suggestion.goals, weeklySetTargets: suggestion.setTargets });
    toast.show(t('Wochenziele aus „{name}“ übernommen', { name: plan.name }),
      { label: t('Rückgängig'), run: () => replaceState(before) });
  };

  if (load.length === 0) return null;
  const max = Math.max(...load.map((entry) => Math.max(entry.sets, entry.target)), 1);

  return (
    <div>
      <div className="section-label" style={{ marginBottom: 8 }}>{t('Wochenvolumen je Muskelgruppe')}</div>
      <div className="list" style={{ gap: 7 }}>
        {load.map((entry) => {
          const status = loadStatus(entry.sets, entry.target);
          const tone = status === 'low' ? 'var(--danger)'
            : status === 'mid' ? 'var(--warn)'
            : status === 'over' ? 'var(--violet)'
            : 'var(--success)';
          return (
            <div key={entry.region}>
              <div className="row row--between tiny" style={{ marginBottom: 3 }}>
                <span className="muted">{t(entry.label)}</span>
                <span className="dim mono">
                  {entry.sets}{entry.target > 0 && <span className="dim"> / {entry.target}</span>}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar__fill"
                  style={{ width: `${(entry.sets / max) * 100}%`, background: tone }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="tiny dim" style={{ marginTop: 7 }}>
        {t('Sekundär beanspruchte Muskeln zählen halb.')}
      </div>
      <button className="btn btn--sm" style={{ marginTop: 10 }} onClick={adoptGoals}>
        <IconGoal /> {t('Als Wochenziele übernehmen')}
      </button>
    </div>
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

/* ------------------------------------------------------------ Supersaetze */

/** Der Kopf eines Supersatzes: wie viele Runden, wie lange wechseln, wie lange Pause. */
function GroupHeader({ members, onEdit }: { members: PlanExercise[]; onEdit: () => void }) {
  const rounds = Math.max(...members.map((item) => item.targetSets || 1));
  const transition = members[0]?.transitionSec ?? 0;
  const rest = members[members.length - 1]?.restSec ?? 0;
  return (
    <button className="plan-group" onClick={onEdit}>
      <IconTimer />
      <span className="plan-group__title">
        {members.length === 2 ? t('Supersatz') : t('Zirkel · {count} Übungen', { count: members.length })}
      </span>
      <span className="plan-group__facts">
        {t('{rounds} Runden', { rounds })}
        {' · '}
        {transition > 0 ? t('{sec} s Wechsel', { sec: transition }) : t('direkt weiter')}
        {' · '}
        {t('{sec} s Pause', { sec: rest })}
      </span>
      <IconEdit className="plan-group__edit" />
    </button>
  );
}

/**
 * Einstellungen fuer einen ganzen Supersatz oder Zirkel.
 *
 * Runden, Wechsel und Pause gelten fuer die Gruppe, nicht fuer die einzelne
 * Uebung - also stellt man sie hier einmal ein, statt dreimal dasselbe in drei
 * Dialogen. Fuer den haeufigsten Fall ("jede Uebung 30 Sekunden") gibt es
 * einen eigenen Knopf.
 */
function GroupEditor({
  members, getExercise, onClose, onChange,
}: {
  members: PlanExercise[];
  getExercise: (id: string) => Exercise | undefined;
  onClose: () => void;
  onChange: (patch: (item: PlanExercise, last: boolean) => PlanExercise) => void;
}) {
  const rounds = Math.max(...members.map((item) => item.targetSets || 1));
  const transition = members[0]?.transitionSec ?? 0;
  const rest = members[members.length - 1]?.restSec ?? 0;
  const [intervalSec, setIntervalSec] = useState<number | null>(30);

  return (
    <Modal title={members.length === 2 ? t('Supersatz') : t('Zirkel')} onClose={onClose}>
      <div className="list">
        <div className="grid-3">
          <div className="field">
            <label className="field__label">{t('Runden')}</label>
            <NumberInput
              value={rounds}
              min={1}
              max={30}
              ariaLabel={t('Runden')}
              onChange={(value) => onChange((item) => ({ ...item, targetSets: value ?? 1 }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('Wechsel (s)')}</label>
            <NumberInput
              value={transition}
              min={0}
              max={120}
              ariaLabel={t('Wechsel in Sekunden')}
              onChange={(value) => onChange((item) => ({ ...item, transitionSec: value ?? 0 }))}
            />
          </div>
          <div className="field">
            <label className="field__label">{t('Pause (s)')}</label>
            <NumberInput
              value={rest}
              min={0}
              max={900}
              ariaLabel={t('Pause nach der Runde in Sekunden')}
              onChange={(value) => onChange((item, last) => ({ ...item, restSec: last ? (value ?? 0) : 0 }))}
            />
          </div>
        </div>
        <p className="tiny dim" style={{ margin: 0 }}>
          {t('Wechsel = Zeit zwischen zwei Übungen einer Runde. Pause = nach der letzten Übung, bevor die nächste Runde beginnt.')}
        </p>

        <div className="section-label">{t('Übungen in dieser Runde')}</div>
        <div className="list" style={{ gap: 6 }}>
          {members.map((item, index) => {
            const exercise = getExercise(item.exerciseId);
            const mode = resolveTracking(exercise, item);
            return (
              <div key={item.id} className="row row--between small">
                <span><span className="mono dim">{index + 1}.</span> {exerciseName(exercise)}</span>
                <span className="tiny dim mono">{targetText({ ...item, targetSets: 1 }, mode).replace(/^1 × /, '')}</span>
              </div>
            );
          })}
        </div>

        {/*
          * "30 Sekunden das, dann direkt das naechste": der Zirkel, wie man ihn
          * an der Hallenuhr laeuft. Ein Knopf stellt alle Uebungen der Gruppe
          * auf Zeit, ohne Wechselpause.
          */}
        <div className="card card--inset">
          <div className="bold small" style={{ marginBottom: 6 }}>{t('Als Intervall')}</div>
          <div className="row" style={{ gap: 8 }}>
            <span className="tiny dim">{t('Jede Übung')}</span>
            <div style={{ width: 84 }}>
              <NumberInput value={intervalSec} min={5} max={600} ariaLabel={t('Sekunden je Übung')} onChange={setIntervalSec} suffix="s" />
            </div>
            <button
              className="btn btn--sm btn--primary"
              disabled={!intervalSec}
              onClick={() => onChange((item) => ({
                ...item,
                tracking: 'time',
                targetDurationSec: intervalSec ?? 30,
                transitionSec: item.transitionSec ?? 0,
              }))}
            >
              {t('Übernehmen')}
            </button>
          </div>
          <p className="tiny dim" style={{ margin: '6px 0 0' }}>
            {t('Im Training führt dich dann der Zirkel-Timer durch: zählt runter, springt weiter, zählt die Runden.')}
          </p>
        </div>

        <button className="btn" onClick={onClose}>{t('Fertig')}</button>
      </div>
    </Modal>
  );
}

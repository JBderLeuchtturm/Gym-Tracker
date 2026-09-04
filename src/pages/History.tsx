import { exerciseName, t } from '../i18n';
import { useMemo, useState } from 'react';
import { calcWorkoutBurn } from '../lib/calories';
import { formatDateLong, formatClock } from '../lib/date';
import { workoutSetCount, workoutVolume } from '../lib/stats';
import { useStore } from '../storage/store';
import { EmptyState, Modal, fmt } from '../components/ui';
import { IconChevronRight, IconFlame, IconTrash } from '../components/icons';
import type { Workout } from '../types';

export function HistoryPage() {
  const { state, getExercise, deleteWorkout } = useStore();
  const [open, setOpen] = useState<Workout | null>(null);

  const workouts = useMemo(
    () => state.workouts
      .filter((workout) => workoutSetCount(workout) > 0)
      .slice()
      .reverse(),
    [state.workouts],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const workout of workouts) {
      const month = workout.date.slice(0, 7);
      map.set(month, [...(map.get(month) ?? []), workout]);
    }
    return [...map.entries()];
  }, [workouts]);

  if (workouts.length === 0) {
    return (
      <EmptyState
        icon="📒"
        title={t("Noch kein Training aufgezeichnet")}
        hint={t("Hake auf der Startseite ein paar Sätze ab – sie erscheinen dann hier.")}
      />
    );
  }

  return (
    <>
      <h2>{t("Verlauf")}</h2>
      {grouped.map(([month, items]) => (
        <div key={month} className="card card--flush">
          <div className="section-label" style={{ padding: '12px 14px 6px' }}>
            {new Date(`${month}-01T00:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            <span className="dim" style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
              · {items.length} Einheiten
            </span>
          </div>
          {items.map((workout) => {
            const burn = calcWorkoutBurn(workout, getExercise, state.profile.weightKg, state.settings.restTimerSec);
            return (
              <button key={workout.id} className="search-result" onClick={() => setOpen(workout)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="search-result__name">
                    {workout.title || 'Training'}
                  </span>
                  <span className="search-result__meta" style={{ display: 'block' }}>
                    {formatDateLong(workout.date)} · {workoutSetCount(workout)} Sätze · {fmt(workoutVolume(workout))} kg
                  </span>
                </span>
                <span className="chip chip--warn"><IconFlame style={{ width: 13, height: 13 }} /> {fmt(burn.kcal)}</span>
                <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      ))}

      {open && (
        <Modal title={open.title || 'Training'} onClose={() => setOpen(null)}>
          <div className="list">
            <div className="tiny dim">{formatDateLong(open.date)}</div>

            {open.exercises.map((logged) => {
              const exercise = getExercise(logged.exerciseId);
              const done = logged.sets.filter((set) => set.done);
              if (done.length === 0) return null;
              return (
                <div key={logged.id} className="card" style={{ background: 'var(--surface-2)', padding: 11 }}>
                  <div className="bold small">{exerciseName(exercise)}</div>
                  <table className="data" style={{ marginTop: 5 }}>
                    <tbody>
                      {done.map((set, index) => (
                        <tr key={set.id}>
                          <td style={{ width: 30 }} className="dim">{set.isWarmup ? 'W' : index + 1}</td>
                          <td className="mono">
                            {set.durationSec
                              ? formatClock(set.durationSec)
                              : `${fmt(set.weightKg ?? 0, 1)} kg × ${set.reps ?? 0}`}
                          </td>
                          <td className="right dim">{set.rpe ? `RPE ${set.rpe}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {logged.note && <div className="tiny dim" style={{ marginTop: 5 }}>{logged.note}</div>}
                </div>
              );
            })}

            {open.notes && (
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="section-label" style={{ marginBottom: 4 }}>{t("Notiz")}</div>
                <div className="small muted">{open.notes}</div>
              </div>
            )}

            <button
              className="btn btn--danger btn--block"
              onClick={() => { deleteWorkout(open.id); setOpen(null); }}
            >
              <IconTrash /> Dieses Training löschen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

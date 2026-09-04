import { LANGUAGE_LABELS, t, useI18n, type Language } from '../i18n';
import { useMemo, useRef, useState } from 'react';
import type { ActivityLevel, Goal, Sex } from '../types';
import { ACTIVITY_LABELS, GOAL_LABELS, calcBMR, calcTDEE, proteinTarget } from '../lib/calories';
import { ageFromBirthDate, formatDateShort, todayISO } from '../lib/date';
import { streakInfo, workoutSetCount } from '../lib/stats';
import { useStore } from '../storage/store';
import { downloadBackup, importState } from '../storage/db';
import { CustomExerciseDialog } from '../components/ExercisePicker';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { ConfirmDialog, Modal, NumberInput, Stat, fmt, useToast } from '../components/ui';
import {
  IconDownload, IconEdit, IconPlus, IconScale, IconTrash, IconUpload, IconUser,
} from '../components/icons';

export function ProfilePage() {
  const {
    state, updateProfile, updateSettings, logBodyWeight, removeBodyWeight,
    addExercise, updateExercise, deleteExercise, replaceState,
  } = useStore();
  const toast = useToast();
  const { language, setLanguage } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [weightOpen, setWeightOpen] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [newExerciseOpen, setNewExerciseOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const { profile, settings } = state;
  const age = ageFromBirthDate(profile.birthDate);
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(profile);
  const bmi = profile.heightCm > 0 ? profile.weightKg / (profile.heightCm / 100) ** 2 : 0;
  const streak = streakInfo(state);

  const totalWorkouts = useMemo(
    () => state.workouts.filter((workout) => workoutSetCount(workout) > 0).length,
    [state.workouts],
  );

  const importBackup = async (file: File) => {
    try {
      replaceState(importState(await file.text()));
      toast.show(t("Backup eingespielt"));
    } catch {
      toast.show(t("Datei konnte nicht gelesen werden"));
    }
  };

  return (
    <>
      <div className="card">
        <div className="card__title" style={{ marginBottom: 12 }}><IconUser /> {t("Persönliche Daten")}</div>

        <div className="list">
          <div className="field">
            <label className="field__label">{t("Name")}</label>
            <input
              className="input"
              value={profile.name}
              placeholder={t("Wie sollen wir dich nennen?")}
              onChange={(event) => updateProfile({ name: event.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field__label">{t("Geburtsdatum")}</label>
              <input
                className="input"
                type="date"
                value={profile.birthDate ?? ''}
                max={todayISO()}
                onChange={(event) => updateProfile({ birthDate: event.target.value || null })}
              />
              {age != null && <span className="field__hint">{age} Jahre</span>}
            </div>
            <div className="field">
              <label className="field__label">{t("Geschlecht")}</label>
              <select
                className="select"
                value={profile.sex}
                onChange={(event) => updateProfile({ sex: event.target.value as Sex })}
              >
                <option value="male">{t("männlich")}</option>
                <option value="female">{t("weiblich")}</option>
                <option value="diverse">{t("divers")}</option>
              </select>
            </div>
          </div>

          <div className="grid-3">
            <div className="field">
              <label className="field__label">{t("Größe (cm)")}</label>
              <NumberInput value={profile.heightCm} min={80} max={260} onChange={(value) => updateProfile({ heightCm: value ?? 0 })} />
            </div>
            <div className="field">
              <label className="field__label">{t("Gewicht (kg)")}</label>
              <NumberInput value={profile.weightKg} min={25} max={350} onChange={(value) => updateProfile({ weightKg: value ?? 0 })} />
            </div>
            <div className="field">
              <label className="field__label">{t("KFA (%)")}</label>
              <NumberInput value={profile.bodyFatPct} min={3} max={60} onChange={(value) => updateProfile({ bodyFatPct: value })} placeholder={t("optional")} />
            </div>
          </div>

          <div className="field">
            <label className="field__label">{t("Alltagsaktivität (ohne Training)")}</label>
            <select
              className="select"
              value={profile.activityLevel}
              onChange={(event) => updateProfile({ activityLevel: event.target.value as ActivityLevel })}
            >
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((key) => (
                <option key={key} value={key}>{t(ACTIVITY_LABELS[key])}</option>
              ))}
            </select>
            <span className="field__hint">{t("Das Training wird separat dazugerechnet – hier nicht mit einplanen.")}</span>
          </div>

          <div className="field">
            <label className="field__label">{t("Ziel")}</label>
            <select
              className="select"
              value={profile.goal}
              onChange={(event) => updateProfile({ goal: event.target.value as Goal })}
            >
              {(Object.keys(GOAL_LABELS) as Goal[]).map((key) => (
                <option key={key} value={key}>{t(GOAL_LABELS[key])}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid-auto">
        <Stat label={t("Grundumsatz")} value={fmt(bmr)} unit={t("kcal")} />
        <Stat label={t("Alltagsumsatz")} value={fmt(tdee)} unit={t("kcal")} tone="accent" />
        <Stat label={t("BMI")} value={fmt(bmi, 1)} sub={bmiLabel(bmi)} />
        <Stat label={t("Protein-Ziel")} value={proteinTarget(profile.weightKg)} unit="g" />
        <Stat label={t("Trainings")} value={totalWorkouts} sub={t('{count} Wochen in Folge', { count: streak.current })} tone="success" />
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title"><IconScale /> {t("Gewichtsverlauf")}</div>
          <button className="btn btn--sm btn--primary" onClick={() => setWeightOpen(true)}>
            <IconPlus /> {t('Eintrag')}
          </button>
        </div>
        {state.weightLog.length === 0 ? (
          <div className="tiny dim">{t("Noch keine Einträge. Trag dein Gewicht regelmäßig ein, dann siehst du den Verlauf unter „Fortschritt“.")}</div>
        ) : (
          <table className="data">
            <tbody>
              {[...state.weightLog].reverse().slice(0, 8).map((item) => (
                <tr key={item.date}>
                  <td>{formatDateShort(item.date)}</td>
                  <td className="right mono">{fmt(item.kg, 1)} kg</td>
                  <td className="right" style={{ width: 36 }}>
                    <button className="btn btn--ghost btn--icon btn--sm" onClick={() => removeBodyWeight(item.date)} aria-label={t("Eintrag löschen")}>
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card__title" style={{ marginBottom: 12 }}>{t("Einstellungen")}</div>
        <div className="list">
          <div className="field">
            <label className="field__label">{t("Standard-Pause zwischen Sätzen (Sekunden)")}</label>
            <NumberInput
              value={settings.restTimerSec}
              min={0}
              max={600}
              onChange={(value) => updateSettings({ restTimerSec: value ?? 0 })}
            />
          </div>

          <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.useWgerApi}
              onChange={(event) => updateSettings({ useWgerApi: event.target.checked })}
            />
            <span className="small">
              Online-Übungsdatenbank (wger) für zusätzliche Suchvorschläge nutzen
              <span className="tiny dim" style={{ display: 'block' }}>
                Kostenlos und ohne Konto. Ausgeschaltet funktioniert die Suche nur mit dem eingebauten Katalog.
              </span>
            </span>
          </label>

          <div className="field">
            <label className="field__label">{t("Sprache")}</label>
            <select
              className="select"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              {(Object.keys(LANGUAGE_LABELS) as Language[]).map((key) => (
                <option key={key} value={key}>{LANGUAGE_LABELS[key]}</option>
              ))}
            </select>
            <span className="field__hint">
              {t("Übungsnamen aus dem Katalog erscheinen auf Englisch, wo eine englische Bezeichnung hinterlegt ist.")}
            </span>
          </div>

          <div className="field">
            <label className="field__label">{t("Erscheinungsbild")}</label>
            <select
              className="select"
              value={settings.theme}
              onChange={(event) => updateSettings({ theme: event.target.value as 'dark' | 'light' | 'system' })}
            >
              <option value="dark">{t("Dunkel")}</option>
              <option value="light">{t("Hell")}</option>
              <option value="system">{t("Wie das Gerät")}</option>
            </select>
          </div>

          <button className="btn btn--block" onClick={() => setExercisesOpen(true)}>
            Eigene Übungen verwalten ({state.exercises.length})
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card__title" style={{ marginBottom: 6 }}>{t("Daten")}</div>
        <div className="tiny dim" style={{ marginBottom: 11 }}>
          Alles wird direkt auf diesem Gerät gespeichert und bleibt nach dem Schließen erhalten.
          Für den Wechsel auf ein anderes Gerät nutzt du Export und Import.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.target.value = '';
          }}
        />
        <div className="grid-2">
          <button className="btn" onClick={() => { downloadBackup(state); toast.show(t("Backup gespeichert")); }}>
            <IconDownload /> {t('Exportieren')}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <IconUpload /> {t('Importieren')}
          </button>
        </div>
        <button className="btn btn--danger btn--block" style={{ marginTop: 9 }} onClick={() => setResetOpen(true)}>
          <IconTrash /> {t('Alle Daten löschen')}
        </button>
      </div>

      {weightOpen && (
        <WeightDialog
          onClose={() => setWeightOpen(false)}
          onSave={(date, kg) => { logBodyWeight(date, kg); setWeightOpen(false); toast.show(t("Gewicht gespeichert")); }}
          defaultWeight={profile.weightKg}
        />
      )}

      {exercisesOpen && (
        <CustomExerciseManager
          onClose={() => setExercisesOpen(false)}
          onCreate={() => { setExercisesOpen(false); setNewExerciseOpen(true); }}
          onUpdate={updateExercise}
          onDelete={deleteExercise}
        />
      )}

      {newExerciseOpen && (
        <CustomExerciseDialog
          onClose={() => setNewExerciseOpen(false)}
          onCreate={(exercise) => {
            addExercise(exercise);
            setNewExerciseOpen(false);
            toast.show(t('„{name}“ angelegt', { name: exercise.name }));
          }}
        />
      )}

      {resetOpen && (
        <ConfirmDialog
          title={t("Wirklich alles löschen?")}
          message={t('Profil, Pläne und sämtliche Trainings werden entfernt. Exportiere vorher ein Backup, wenn du die Daten behalten willst.')}
          confirmLabel={t('Alles löschen')}
          onCancel={() => setResetOpen(false)}
          onConfirm={() => {
            localStorage.clear();
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

function bmiLabel(bmi: number): string {
  if (bmi <= 0) return '';
  if (bmi < 18.5) return t('Untergewicht');
  if (bmi < 25) return t('Normalgewicht');
  if (bmi < 30) return t('Übergewicht');
  return t('Adipositas');
}

/* ------------------------------------------------------------- Gewicht */

function WeightDialog({
  onClose, onSave, defaultWeight,
}: {
  onClose: () => void;
  onSave: (date: string, kg: number) => void;
  defaultWeight: number;
}) {
  const [date, setDate] = useState(todayISO());
  const [kg, setKg] = useState<number | null>(defaultWeight);

  return (
    <Modal title={t("Gewicht eintragen")} onClose={onClose}>
      <div className="list">
        <div className="grid-2">
          <div className="field">
            <label className="field__label">{t("Datum")}</label>
            <input className="input" type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">{t("Gewicht (kg)")}</label>
            <NumberInput value={kg} min={25} max={350} onChange={setKg} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t("Abbrechen")}</button>
          <button className="btn btn--primary" disabled={!kg} onClick={() => kg && onSave(date, kg)}>{t("Speichern")}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------- Eigene Übungen verwalten */

function CustomExerciseManager({
  onClose, onCreate, onUpdate, onDelete,
}: {
  onClose: () => void;
  onCreate: () => void;
  onUpdate: (id: string, patch: Partial<import('../types').Exercise>) => void;
  onDelete: (id: string) => void;
}) {
  const { state } = useStore();
  const [editing, setEditing] = useState<import('../types').Exercise | null>(null);
  const [detail, setDetail] = useState<import('../types').Exercise | null>(null);

  return (
    <Modal title={t("Eigene & importierte Übungen")} onClose={onClose}>
      <div className="list">
        <button className="btn btn--primary btn--block" onClick={onCreate}>
          <IconPlus /> {t('Neue eigene Übung')}
        </button>

        {state.exercises.length === 0 && (
          <div className="empty tiny">
            Noch keine eigenen Übungen. Der eingebaute Katalog enthält bereits über 200 Einträge –
            hier landen nur die, die du selbst anlegst oder online hinzufügst.
          </div>
        )}

        {state.exercises.map((exercise) => (
          <div key={exercise.id} className="row row--between card" style={{ background: 'var(--surface-2)', padding: 11 }}>
            <button
              style={{ flex: 1, minWidth: 0, background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setDetail(exercise)}
            >
              <div className="bold small">{exercise.name}</div>
              <div className="tiny dim">
                {exercise.source === 'custom' ? t('selbst angelegt') : t('aus wger')}
                {exercise.equipment.length > 0 && ` · ${exercise.equipment.join(', ')}`}
              </div>
            </button>
            <div className="row" style={{ gap: 3 }}>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setEditing(exercise)} aria-label={t("Bearbeiten")}>
                <IconEdit />
              </button>
              <button className="btn btn--ghost btn--icon btn--sm" onClick={() => onDelete(exercise.id)} aria-label={t("Löschen")}>
                <IconTrash />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CustomExerciseDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onCreate={(exercise) => { onUpdate(exercise.id, exercise); setEditing(null); }}
        />
      )}

      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </Modal>
  );
}

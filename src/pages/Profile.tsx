import { t } from '../i18n';
import { Suspense, lazy, useMemo, useState } from 'react';
import type { ActivityLevel, Goal, Sex } from '../types';
import { ACTIVITY_LABELS, GOAL_LABELS, calcBMR, calcTDEE, proteinTarget } from '../lib/calories';
import { ageFromBirthDate, formatDateShort, todayISO } from '../lib/date';
import { streakInfo, workoutSetCount } from '../lib/stats';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import { BodyLogButtons, MeasurementsDialog, PhotosDialog } from '../components/BodyLog';
import {
  DateInput, Modal, NumberInput, Stat, fmt, useToast,
} from '../components/ui';
import {
  IconChevronRight, IconFlame, IconPlus, IconScale, IconSettings, IconTrash, IconUser,
} from '../components/icons';
import {
  EditCardButton, ProfileCardEditor, ProfileCardView, useOwnCard, useProfileCardSync,
} from '../components/ProfileCard';
import { PageSkeleton } from '../components/ui';
import { SettingsPage } from './Settings';

/*
 * Die Kalorienseite hat ihren Reiter an den Rang abgegeben. Verschwunden ist
 * sie nicht: Wer sie braucht, findet sie hier vollstaendig - Eintraege,
 * Lebensmittelsuche, Yazio, Verlauf. Was man taeglich davon braucht, der
 * Verbrauch des Trainings, steht jetzt unter dem Training selbst.
 */
const CaloriesPage = lazy(() => import('./Calories').then((m) => ({ default: m.CaloriesPage })));

export function ProfilePage() {
  const {
    state, updateProfile, logBodyWeight, removeBodyWeight, replaceState, snapshot,
  } = useStore();
  const toast = useToast();

  const [weightOpen, setWeightOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [caloriesOpen, setCaloriesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { profile } = state;
  const age = ageFromBirthDate(profile.birthDate);
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(profile);
  const bmi = profile.heightCm > 0 ? profile.weightKg / (profile.heightCm / 100) ** 2 : 0;
  const streak = streakInfo(state);

  const totalWorkouts = useMemo(
    () => state.workouts.filter((workout) => workoutSetCount(workout) > 0).length,
    [state.workouts],
  );

  if (caloriesOpen) {
    return (
      <>
        <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setCaloriesOpen(false)}>
          ← {t('Zurück zum Profil')}
        </button>
        <Suspense fallback={<PageSkeleton />}>
          <CaloriesPage />
        </Suspense>
      </>
    );
  }

  if (settingsOpen) {
    return <SettingsPage onClose={() => setSettingsOpen(false)} />;
  }

  return (
    <>
      {/*
        * Die Profilkarte steht ganz oben: Sie ist das, was Freunde von einem
        * sehen, und sie zeigt, was die Zahlen darunter bedeuten.
        */}
      <OwnProfileCard onEdit={() => setCardOpen(true)} />
      {cardOpen && <ProfileCardEditor onClose={() => setCardOpen(false)} />}

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
              <DateInput
                value={profile.birthDate ?? ''}
                max={todayISO()}
                onChange={(next) => updateProfile({ birthDate: next || null })}
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

      <button className="big-link" onClick={() => setCaloriesOpen(true)}>
        <span className="big-link__icon" aria-hidden="true"><IconFlame /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="small bold">{t('Kalorien und Ernährung')}</span>
          <span className="tiny dim" style={{ display: 'block' }}>
            {t('Zufuhr eintragen, Lebensmittel suchen, Verlauf – die ganze Seite')}
          </span>
        </span>
        <IconChevronRight />
      </button>

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
                    <button className="btn btn--ghost btn--icon btn--sm" onClick={() => {
                        const before = snapshot();
                        removeBodyWeight(item.date);
                        toast.show(t('Eintrag gelöscht'), {
                          label: t('Rückgängig'),
                          run: () => replaceState(before),
                        });
                      }} aria-label={t("Eintrag löschen")}>
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="divider" />
        <div className="tiny dim" style={{ marginBottom: 8 }}>
          {t("Umfänge und Fotos zeigen die Veränderung oft früher als die Waage.")}
          {' '}
          {t("Fotos bleiben auf diesem Gerät.")}
        </div>
        <BodyLogButtons
          onMeasurements={() => setMeasurementsOpen(true)}
          onPhotos={() => setPhotosOpen(true)}
        />
      </div>

      {/*
        * Alles, was man einmal einstellt und danach kaum wieder ansieht -
        * Sprache, Studio-Zubehoer, Erinnerungen, Datensicherung - steht nicht
        * mehr zwischen Koerperdaten und Gewichtsverlauf, die man tatsaechlich
        * oft ansieht, sondern gebuendelt hinter einem Knopf mit Kategorien.
        */}
      <button className="big-link" onClick={() => setSettingsOpen(true)}>
        <span className="big-link__icon" aria-hidden="true"><IconSettings /></span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="small bold">{t('Einstellungen')}</span>
          <span className="tiny dim" style={{ display: 'block' }}>
            {t('Sprache, Studio, Übungen, Erinnerungen, Daten')}
          </span>
        </span>
        <IconChevronRight />
      </button>

      {weightOpen && (
        <WeightDialog
          onClose={() => setWeightOpen(false)}
          onSave={(date, kg) => { logBodyWeight(date, kg); setWeightOpen(false); toast.show(t("Gewicht gespeichert")); }}
          defaultWeight={profile.weightKg}
        />
      )}

      {measurementsOpen && <MeasurementsDialog onClose={() => setMeasurementsOpen(false)} />}
      {photosOpen && <PhotosDialog onClose={() => setPhotosOpen(false)} />}
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
            <DateInput value={date} max={todayISO()} onChange={setDate} />
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

/** Die eigene Karte samt Knopf zum Gestalten. */
function OwnProfileCard({ onEdit }: { onEdit: () => void }) {
  const sync = useSync();
  const data = useOwnCard(sync.profile?.handle);
  // Was hier eingestellt wird, sollen Freunde auch sehen.
  useProfileCardSync();
  return (
    <div className="list">
      <ProfileCardView data={data} />
      <EditCardButton onClick={onEdit} />
    </div>
  );
}

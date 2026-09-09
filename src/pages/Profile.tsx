import { LANGUAGE_LABELS, t, useI18n, type Language } from '../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityLevel, Goal, Sex } from '../types';
import { ACTIVITY_LABELS, GOAL_LABELS, calcBMR, calcTDEE, proteinTarget } from '../lib/calories';
import { ageFromBirthDate, formatDateShort, locale, todayISO } from '../lib/date';
import { streakInfo, workoutSetCount } from '../lib/stats';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import { downloadBackup, importState } from '../storage/db';
import { CustomExerciseDialog } from '../components/ExercisePicker';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { BodyLogButtons, MeasurementsDialog, PhotosDialog } from '../components/BodyLog';
import {
  ConfirmDialog, DateInput, Modal, NumberInput, Stat, TimeInput, fmt, useToast,
} from '../components/ui';
import {
  IconCalendar, IconCloud, IconDownload, IconEdit, IconPlus, IconScale, IconTarget, IconTrash,
  IconUpload, IconUser,
} from '../components/icons';
import { searchPlace, type Place } from '../api/weather';
import { icsFileName, planToIcs } from '../lib/ics';
import { downloadBlob } from '../lib/zip';
import { ALL_REGIONS, REGION_LABELS, type MuscleRegion } from '../lib/muscles';
import { DEFAULT_WEEKLY_TARGET, targetFor } from '../lib/muscleLoad';
import { ALL_EQUIPMENT } from '../data/catalog';
import {
  EditCardButton, ProfileCardEditor, ProfileCardView, useOwnCard, useProfileCardSync,
} from '../components/ProfileCard';

export function ProfilePage() {
  const {
    state, updateProfile, updateSettings, logBodyWeight, removeBodyWeight,
    addExercise, updateExercise, deleteExercise, replaceState, snapshot,
  } = useStore();
  const toast = useToast();
  const { language, setLanguage } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [weightOpen, setWeightOpen] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [newExerciseOpen, setNewExerciseOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

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

      <div className="card">
        <div className="card__title" style={{ marginBottom: 12 }}>{t("Einstellungen")}</div>
        <div className="list">
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

          <div className="field">
            <label className="field__label">{t("Trainingspartner")}</label>
            <input
              className="input"
              value={settings.partnerName}
              placeholder={t("Name – leer lassen für aus")}
              onChange={(event) => updateSettings({ partnerName: event.target.value })}
            />
            <span className="field__hint">
              {t("Ist ein Name gesetzt, kannst du im Training Sätze deinem Partner zuordnen. Die zählen nicht in deine Auswertung.")}
            </span>
          </div>

          <button className="btn btn--block" onClick={() => setTargetsOpen(true)}>
            <IconTarget /> {t('Wochenziele je Muskelgruppe')}
          </button>

          <button className="btn btn--block" onClick={() => setEquipmentOpen(true)}>
            {t('Verfügbare Geräte')} ({settings.availableEquipment.length === 0
              ? t('alle')
              : settings.availableEquipment.length})
          </button>

          <button className="btn btn--block" onClick={() => setExercisesOpen(true)}>
            Eigene Übungen verwalten ({state.exercises.length})
          </button>
        </div>
      </div>

      <StudioSettings />

      <WeatherSettingsCard />

      <ReminderCard />

      <div className="card">
        <div className="card__title" style={{ marginBottom: 6 }}>{t("Daten")}</div>
        <div className="tiny dim" style={{ marginBottom: 11 }}>
          Alles wird direkt auf diesem Gerät gespeichert und bleibt nach dem Schließen erhalten.
          Für den Wechsel auf ein anderes Gerät nutzt du Export und Import.
          {' '}
          <strong style={{ color: 'var(--warn)' }}>
            Fortschrittsfotos sind nicht dabei
          </strong>{' '}
          – die liegen nur auf diesem Gerät und werden unter <em>Fotos</em> gesondert
          heruntergeladen.
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
        <CloudBackup />

        <div className="tiny dim center" style={{ marginTop: 11 }}>
          {t('App-Version')}: {new Date(__BUILD_TIME__).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}
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

      {measurementsOpen && <MeasurementsDialog onClose={() => setMeasurementsOpen(false)} />}
      {photosOpen && <PhotosDialog onClose={() => setPhotosOpen(false)} />}

      {targetsOpen && (
        <WeeklyTargetsDialog
          targets={settings.weeklySetTargets}
          onClose={() => setTargetsOpen(false)}
          onSave={(next) => { updateSettings({ weeklySetTargets: next }); setTargetsOpen(false); }}
        />
      )}

      {equipmentOpen && (
        <EquipmentDialog
          chosen={settings.availableEquipment}
          onClose={() => setEquipmentOpen(false)}
          onSave={(next) => { updateSettings({ availableEquipment: next }); setEquipmentOpen(false); }}
        />
      )}

      {exercisesOpen && (
        <CustomExerciseManager
          onClose={() => setExercisesOpen(false)}
          onCreate={() => { setExercisesOpen(false); setNewExerciseOpen(true); }}
          onUpdate={updateExercise}
          onDelete={(id) => {
            const before = snapshot();
            deleteExercise(id);
            toast.show(t('Übung gelöscht'), { label: t('Rückgängig'), run: () => replaceState(before) });
          }}
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

/**
 * Taegliche Sicherung am eigenen Konto.
 *
 * Der laufende Abgleich ist eine Spiegelung, keine Sicherung: Wer aus Versehen
 * alles loescht, hat es Sekunden spaeter auch am Konto geloescht. Hier liegen
 * die letzten vierzehn Tage, aus denen sich zurueckgehen laesst.
 */
function CloudBackup() {
  const { state, updateSettings } = useStore();
  const sync = useSync();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (sync.status === 'signed-in') void sync.listBackups();
  }, [sync.status]);

  if (sync.status !== 'signed-in') {
    return (
      <div className="hint-box" style={{ marginTop: 12 }}>
        <div className="small bold">{t('Sicherung am Konto')}</div>
        <div className="tiny dim" style={{ marginTop: 4 }}>
          {t('Dafür brauchst du ein Konto unter „Freunde“. Ohne Konto bleibt der Export von Hand der einzige Weg.')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={state.settings.autoBackup}
          onChange={(event) => updateSettings({ autoBackup: event.target.checked })}
        />
        <span className="small">
          {t('Einmal am Tag automatisch am Konto sichern')}
          <span className="tiny dim" style={{ display: 'block' }}>
            {t('Die letzten vierzehn Tage bleiben liegen. Der laufende Abgleich allein hilft nicht: Was du löschst, ist Sekunden später auch dort gelöscht.')}
          </span>
        </span>
      </label>

      <div className="row row--wrap" style={{ gap: 8, marginTop: 10 }}>
        <button
          className="btn btn--sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const done = await sync.backupNow();
            setBusy(false);
            toast.show(done ? t('Gesichert') : t('Sicherung fehlgeschlagen'));
          }}
        >
          {busy ? t('sichert …') : t('Jetzt sichern')}
        </button>
        <span className="tiny dim">
          {sync.backups.length > 0
            ? t('{count} Sicherungen vorhanden', { count: sync.backups.length })
            : t('Noch keine Sicherung')}
        </span>
      </div>

      {sync.backups.length > 0 && (
        <div className="list" style={{ gap: 4, marginTop: 10 }}>
          {sync.backups.map((backup) => (
            <div key={backup.id} className="row row--between">
              <span className="small mono">{formatDateShort(backup.created_on)}</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setConfirmId(backup.id)}>
                {t('Wiederherstellen')}
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          title={t('Stand zurücksetzen?')}
          message={t('Der aktuelle Stand auf diesem Gerät wird durch die Sicherung ersetzt – und danach auch am Konto. Fortschrittsfotos bleiben unberührt.')}
          confirmLabel={t('Wiederherstellen')}
          onCancel={() => setConfirmId(null)}
          onConfirm={async () => {
            const id = confirmId;
            setConfirmId(null);
            const done = await sync.restoreBackup(id);
            toast.show(done ? t('Stand wiederhergestellt') : t('Wiederherstellen fehlgeschlagen'));
          }}
        />
      )}
    </div>
  );
}

/**
 * Was im Studio gebraucht wird.
 *
 * Bewusst ein eigener Kasten: Diese Schalter stellt man einmal ein und danach
 * nie wieder - sie zwischen Sprache und Erscheinungsbild zu mischen, hiesse,
 * sie jedes Mal mitzulesen.
 */
function StudioSettings() {
  const { state, updateSettings } = useStore();
  const { settings } = state;

  return (
    <div className="card">
      <div className="card__title" style={{ marginBottom: 12 }}>{t('Im Studio')}</div>
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

        <div className="field">
          <label className="field__label">{t('Gewicht der Hantelstange (kg)')}</label>
          <NumberInput
            value={settings.barWeightKg}
            min={0}
            max={50}
            step={2.5}
            onChange={(value) => updateSettings({ barWeightKg: value ?? 20 })}
          />
          <span className="field__hint">
            {t('Grundlage für den Scheibenrechner. Welche Scheiben du hast, stellst du im Rechner selbst ein.')}
          </span>
        </div>

        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.keepScreenAwake}
            onChange={(event) => updateSettings({ keepScreenAwake: event.target.checked })}
          />
          <span className="small">
            {t('Bildschirm wach halten, solange die Zeitmessung läuft')}
            <span className="tiny dim" style={{ display: 'block' }}>
              {t('Sonst ist das Handy nach zwei Minuten Pause gesperrt.')}
            </span>
          </span>
        </label>

        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.fullscreenRest}
            onChange={(event) => updateSettings({ fullscreenRest: event.target.checked })}
          />
          <span className="small">{t('Pausenuhr groß über den ganzen Bildschirm')}</span>
        </label>

        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.countdownBeep}
            onChange={(event) => updateSettings({ countdownBeep: event.target.checked })}
          />
          <span className="small">{t("Signalton, wenn eine Halteübung abgelaufen ist")}</span>
        </label>

        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.useRir}
            onChange={(event) => updateSettings({ useRir: event.target.checked })}
          />
          <span className="small">
            {t('Belastung als RIR statt als RPE eintragen')}
            <span className="tiny dim" style={{ display: 'block' }}>
              {t('Dieselbe Angabe, andere Leserichtung: RIR 2 heißt RPE 8. Gespeichert wird nur ein Wert, alte Einträge bleiben gültig.')}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

/**
 * Wetter am Trainingstag.
 *
 * Der Ort geht nur an Open-Meteo, auf zwei Nachkommastellen gerundet, und nur
 * solange das hier eingeschaltet ist. Wer das nicht will, laesst es aus - dann
 * verlaesst kein einziger Aufruf das Geraet.
 */
function WeatherSettingsCard() {
  const { state, updateSettings } = useStore();
  const toast = useToast();
  const weather = state.settings.weather;
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  const find = async () => {
    setSearching(true);
    const found = await searchPlace(query);
    setHits(found);
    setSearching(false);
    if (found.length === 0) toast.show(t('Dazu wurde kein Ort gefunden'));
  };

  const useDevice = () => {
    if (!navigator.geolocation) { toast.show(t('Dein Browser gibt den Standort nicht her')); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateSettings({
          weather: {
            ...weather,
            enabled: true,
            // Zwei Nachkommastellen sind rund anderthalb Kilometer - genug fuers Wetter.
            lat: Math.round(position.coords.latitude * 100) / 100,
            lon: Math.round(position.coords.longitude * 100) / 100,
            placeName: t('Aktueller Standort'),
          },
        });
        toast.show(t('Standort übernommen'));
      },
      () => toast.show(t('Standort nicht bekommen')),
      { maximumAge: 600000, timeout: 8000 },
    );
  };

  return (
    <div className="card">
      <div className="card__title" style={{ marginBottom: 12 }}>
        <IconCloud style={{ width: 15, height: 15, verticalAlign: '-2px' }} /> {t('Wetter beim Training draußen')}
      </div>
      <div className="list">
        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={weather.enabled}
            onChange={(event) => updateSettings({ weather: { ...weather, enabled: event.target.checked } })}
          />
          <span className="small">
            {t('Wetter zum Trainingstag anzeigen')}
            <span className="tiny dim" style={{ display: 'block' }}>
              {t('Nur an Tagen, an denen etwas draußen ansteht – Laufen, Radfahren, Sprints. Daten von Open-Meteo, kostenlos und ohne Konto.')}
            </span>
          </span>
        </label>

        {weather.enabled && (
          <>
            <div className="field">
              <label className="field__label">{t('Ort')}</label>
              <div className="row" style={{ gap: 7 }}>
                <input
                  className="input"
                  value={query}
                  placeholder={t('Stadt eingeben')}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void find(); }}
                />
                <button className="btn" onClick={() => void find()} disabled={searching || query.trim().length < 2}>
                  {searching ? t('sucht …') : t('Suchen')}
                </button>
              </div>
              <span className="field__hint">
                {weather.lat != null
                  ? t('Gesetzt: {place} ({lat} / {lon})', {
                      place: weather.placeName || t('unbenannt'),
                      lat: String(weather.lat),
                      lon: String(weather.lon),
                    })
                  : t('Noch kein Ort gesetzt.')}
              </span>
            </div>

            {hits.length > 0 && (
              <div className="list" style={{ gap: 4 }}>
                {hits.map((place) => (
                  <button
                    key={`${place.lat}-${place.lon}`}
                    className="search-result"
                    onClick={() => {
                      updateSettings({
                        weather: {
                          ...weather,
                          lat: Math.round(place.lat * 100) / 100,
                          lon: Math.round(place.lon * 100) / 100,
                          placeName: place.name,
                        },
                      });
                      setHits([]);
                      setQuery('');
                      toast.show(t('{place} gesetzt', { place: place.name }));
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="search-result__name">{place.name}</span>
                      <span className="search-result__meta" style={{ display: 'block' }}>
                        {[place.region, place.country].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button className="btn btn--block" onClick={useDevice}>
              {t('Standort vom Gerät übernehmen')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Erinnerung an den Trainingstag.
 *
 * Ohne Umschweife: Eine Web-App kann sich nicht selbst zu einer Uhrzeit
 * wecken. Alles, was ohne fremden Server ginge, setzt voraus, dass die App
 * gerade offen ist - und dann braucht man keine Erinnerung mehr.
 *
 * Deshalb zwei Wege, die beide wirklich funktionieren: der Kalender des
 * Telefons, der genau dafuer gebaut ist, und ein Hinweis beim Oeffnen an
 * einem Trainingstag, an dem noch nichts eingetragen ist.
 */
function ReminderCard() {
  const { state, updateSettings } = useStore();
  const toast = useToast();
  const reminder = state.settings.reminder;
  const plan = state.plans.find((item) => item.id === state.activePlanId) ?? null;
  const [alarmMin, setAlarmMin] = useState<number | null>(60);

  return (
    <div className="card">
      <div className="card__title" style={{ marginBottom: 12 }}>
        <IconCalendar style={{ width: 15, height: 15, verticalAlign: '-2px' }} /> {t('Erinnerung an den Trainingstag')}
      </div>
      <div className="list">
        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={reminder.enabled}
            onChange={(event) => updateSettings({ reminder: { ...reminder, enabled: event.target.checked } })}
          />
          <span className="small">
            {t('Beim Öffnen erinnern, wenn heute Trainingstag ist')}
            <span className="tiny dim" style={{ display: 'block' }}>
              {t('Erscheint einmal am Tag, ab der eingestellten Uhrzeit, und nur solange nichts eingetragen ist.')}
            </span>
          </span>
        </label>

        <div className="field">
          <label className="field__label">{t('Ab wann')}</label>
          <TimeInput
            value={reminder.time}
            ariaLabel={t('Uhrzeit der Erinnerung')}
            onChange={(next) => updateSettings({ reminder: { ...reminder, time: next || '17:00' } })}
          />
        </div>

        <div className="hint-box">
          <div className="small bold">{t('Zuverlässig erinnert der Kalender')}</div>
          <div className="tiny dim" style={{ marginTop: 4 }}>
            {t('Eine Web-App kann sich nicht selbst wecken, solange sie geschlossen ist. Der Kalender deines Telefons kann das – und braucht dafür weder Konto noch Internet.')}
          </div>
          <div className="row row--wrap" style={{ gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '0 0 130px' }}>
              <label className="field__label">{t('Vorwarnung (min)')}</label>
              <NumberInput value={alarmMin} min={0} max={720} onChange={setAlarmMin} />
            </div>
            <button
              className="btn"
              disabled={!plan}
              onClick={() => {
                if (!plan) return;
                const ics = planToIcs(plan, {
                  time: reminder.time,
                  durationMin: 75,
                  alarmMin: alarmMin ?? 0,
                });
                downloadBlob(icsFileName(plan), new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
                toast.show(t('Kalenderdatei erzeugt – im Kalender öffnen und importieren'));
              }}
            >
              <IconDownload /> {t('Trainingstage als Kalender')}
            </button>
          </div>
        </div>
      </div>
    </div>
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


/**
 * Wochenziele je Muskelregion. Voreingestellt sind die ueblichen Empfehlungen;
 * 0 heisst "interessiert mich nicht" und nimmt die Region aus der Ampel.
 */
function WeeklyTargetsDialog({
  targets, onClose, onSave,
}: {
  targets: Record<string, number>;
  onClose: () => void;
  onSave: (targets: Record<string, number>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const region of ALL_REGIONS) initial[region] = targetFor(targets, region);
    return initial;
  });

  const set = (region: MuscleRegion, value: number | null) =>
    setDraft((current) => ({ ...current, [region]: Math.max(0, Math.min(40, value ?? 0)) }));

  return (
    <Modal title={t('Wochenziele')} onClose={onClose}>
      <div className="list">
        <p className="small muted">
          {t("Wie viele harte Sätze soll jede Muskelgruppe pro Woche bekommen? Üblich sind 10 bis 20. Auf 0 gesetzt, taucht die Gruppe in der Ampel nicht mehr auf.")}
        </p>

        {ALL_REGIONS.map((region) => (
          <div className="row row--between" key={region}>
            <span className="small">{t(REGION_LABELS[region])}</span>
            <div style={{ width: 96 }}>
              <NumberInput
                value={draft[region]}
                min={0}
                max={40}
                onChange={(value) => set(region, value)}
              />
            </div>
          </div>
        ))}

        <div className="grid-2" style={{ marginTop: 6 }}>
          <button
            className="btn"
            onClick={() => setDraft({ ...DEFAULT_WEEKLY_TARGET })}
          >
            {t('Standard')}
          </button>
          <button className="btn btn--primary" onClick={() => onSave(draft)}>
            {t('Speichern')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Geraeteprofil. Ohne Auswahl steht alles zur Verfuegung - erst wer etwas
 * ankreuzt, bekommt in Suche und Vorschlaegen nur noch passende Uebungen.
 */
function EquipmentDialog({
  chosen, onClose, onSave,
}: {
  chosen: string[];
  onClose: () => void;
  onSave: (equipment: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(chosen);

  const toggle = (item: string) => setDraft((current) => (
    current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]
  ));

  return (
    <Modal title={t('Verfügbare Geräte')} onClose={onClose}>
      <div className="list">
        <p className="small muted">
          {t("Kreuze an, was du zur Verfügung hast. Die Übungssuche zeigt dann zuerst, was du auch machen kannst. Nichts angekreuzt heißt: alles verfügbar.")}
        </p>

        <div className="row row--wrap" style={{ gap: 6 }}>
          {ALL_EQUIPMENT.map((item) => (
            <button
              key={item}
              className={`chip chip--button ${draft.includes(item) ? 'chip--accent' : ''}`}
              aria-pressed={draft.includes(item)}
              onClick={() => toggle(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid-2" style={{ marginTop: 6 }}>
          <button className="btn" onClick={() => setDraft([])}>{t('Alles verfügbar')}</button>
          <button className="btn btn--primary" onClick={() => onSave(draft)}>{t('Speichern')}</button>
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

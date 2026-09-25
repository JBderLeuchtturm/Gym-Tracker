import { LANGUAGE_LABELS, t, useI18n, type Language } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import { downloadBackup, importState } from '../storage/db';
import { CustomExerciseDialog } from '../components/ExercisePicker';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { formatDateShort, locale } from '../lib/date';
import {
  ConfirmDialog, Modal, NumberInput, TimeInput, useToast,
} from '../components/ui';
import {
  IconBell, IconCalendar, IconChevronRight, IconCloud, IconDownload, IconEdit, IconPlus,
  IconSettings, IconTarget, IconTrash, IconUpload,
} from '../components/icons';
import { searchPlace, type Place } from '../api/weather';
import { icsFileName, planToIcs } from '../lib/ics';
import { downloadBlob } from '../lib/zip';
import { ALL_EQUIPMENT } from '../data/catalog';
import type { Exercise } from '../types';
import { WeeklyGoalsDialog } from '../components/WeeklyGoals';
import { appBuild, isNativeApp } from '../native/platform';

type Category = 'allgemein' | 'studio' | 'uebungen' | 'erinnerung' | 'daten';

const CATEGORIES: Array<{ id: Category; icon: React.ReactNode; title: string; subtitle: string }> = [
  {
    id: 'allgemein',
    icon: <IconSettings />,
    title: 'Allgemein',
    subtitle: 'Sprache, Erscheinungsbild, Übungsdatenbank',
  },
  {
    id: 'studio',
    icon: <IconTarget />,
    title: 'Training & Studio',
    subtitle: 'Pausenuhr, Hantelstange, RIR/RPE, Wochenziele, Geräte',
  },
  {
    id: 'uebungen',
    icon: <IconEdit />,
    title: 'Eigene Übungen',
    subtitle: 'Selbst angelegte und aus wger geladene Übungen verwalten',
  },
  {
    id: 'erinnerung',
    icon: <IconBell />,
    title: 'Erinnerung & Wetter',
    subtitle: 'Trainingstag-Erinnerung, Kalenderexport, Wetter draußen',
  },
  {
    id: 'daten',
    icon: <IconCloud />,
    title: 'Daten & Sicherung',
    subtitle: 'Export, Import, Sicherung am Konto, Zurücksetzen',
  },
];

/**
 * Einstellungen, gebündelt hinter einem Knopf statt als lange Reihe von
 * Karten auf dem Profil. Die Kategorien darin stellt man einmal ein und
 * schaut selten wieder rein - das gehört nicht zwischen Körperdaten und
 * Gewichtsverlauf, die man tatsächlich oft ansieht.
 */
export function SettingsPage({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<Category | null>(null);

  if (category) {
    return (
      <>
        <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setCategory(null)}>
          ← {t('Zurück zu Einstellungen')}
        </button>
        {category === 'allgemein' && <GeneralSettings />}
        {category === 'studio' && <StudioSettings />}
        {category === 'uebungen' && <ExerciseSettings />}
        {category === 'erinnerung' && <ReminderAndWeather />}
        {category === 'daten' && <DataSettings />}
      </>
    );
  }

  return (
    <>
      <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={onClose}>
        ← {t('Zurück zum Profil')}
      </button>
      <div className="list">
        {CATEGORIES.map((item) => (
          <button key={item.id} className="big-link" onClick={() => setCategory(item.id)}>
            <span className="big-link__icon" aria-hidden="true">{item.icon}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="small bold">{t(item.title)}</span>
              <span className="tiny dim" style={{ display: 'block' }}>{t(item.subtitle)}</span>
            </span>
            <IconChevronRight />
          </button>
        ))}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- Allgemein */

function GeneralSettings() {
  const { state, updateSettings } = useStore();
  const { language, setLanguage } = useI18n();
  const { settings } = state;

  return (
    <div className="card">
      <div className="card__title" style={{ marginBottom: 12 }}>{t('Allgemein')}</div>
      <div className="list">
        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.useWgerApi}
            onChange={(event) => updateSettings({ useWgerApi: event.target.checked })}
          />
          <span className="small">
            {t('Online-Übungsdatenbank (wger) für zusätzliche Suchvorschläge nutzen')}
            <span className="tiny dim" style={{ display: 'block' }}>
              {t('Kostenlos und ohne Konto. Ausgeschaltet funktioniert die Suche nur mit dem eingebauten Katalog.')}
            </span>
          </span>
        </label>

        <div className="field">
          <label className="field__label">{t('Sprache')}</label>
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
            {t('Übungsnamen aus dem Katalog erscheinen auf Englisch, wo eine englische Bezeichnung hinterlegt ist.')}
          </span>
        </div>

        <div className="field">
          <label className="field__label">{t('Erscheinungsbild')}</label>
          <select
            className="select"
            value={settings.theme}
            onChange={(event) => updateSettings({ theme: event.target.value as 'dark' | 'light' | 'system' })}
          >
            <option value="dark">{t('Dunkel')}</option>
            <option value="light">{t('Hell')}</option>
            <option value="system">{t('Wie das Gerät')}</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Training/Studio */

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
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);

  return (
    <>
      <div className="card">
        <div className="card__title" style={{ marginBottom: 12 }}>{t('Im Studio')}</div>
        <div className="list">
          <div className="field">
            <label className="field__label">{t('Standard-Pause zwischen Sätzen (Sekunden)')}</label>
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

          <div className="field">
            <label className="field__label">{t('Trainingspartner')}</label>
            <input
              className="input"
              value={settings.partnerName}
              placeholder={t('Name – leer lassen für aus')}
              onChange={(event) => updateSettings({ partnerName: event.target.value })}
            />
            <span className="field__hint">
              {t('Ist ein Name gesetzt, kannst du im Training Sätze deinem Partner zuordnen. Die zählen nicht in deine Auswertung.')}
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
            <span className="small">{t('Signalton, wenn eine Halteübung abgelaufen ist')}</span>
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

          <button className="btn btn--block" onClick={() => setTargetsOpen(true)}>
            <IconTarget /> {t('Wochenziele')}
          </button>

          <button className="btn btn--block" onClick={() => setEquipmentOpen(true)}>
            {t('Verfügbare Geräte')} ({settings.availableEquipment.length === 0
              ? t('alle')
              : settings.availableEquipment.length})
          </button>
        </div>
      </div>

      {targetsOpen && <WeeklyGoalsDialog onClose={() => setTargetsOpen(false)} />}

      {equipmentOpen && (
        <EquipmentDialog
          chosen={settings.availableEquipment}
          onClose={() => setEquipmentOpen(false)}
          onSave={(next) => { updateSettings({ availableEquipment: next }); setEquipmentOpen(false); }}
        />
      )}
    </>
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
          {t('Kreuze an, was du zur Verfügung hast. Die Übungssuche zeigt dann zuerst, was du auch machen kannst. Nichts angekreuzt heißt: alles verfügbar.')}
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

/* -------------------------------------------------------------- Übungen */

function ExerciseSettings() {
  const {
    state, addExercise, updateExercise, deleteExercise, replaceState, snapshot,
  } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="card">
      <div className="card__title" style={{ marginBottom: 12 }}>{t('Eigene & importierte Übungen')}</div>
      <div className="list">
        <button className="btn btn--primary btn--block" onClick={() => setCreating(true)}>
          <IconPlus /> {t('Neue eigene Übung')}
        </button>

        {state.exercises.length === 0 && (
          <div className="empty tiny">
            {t('Noch keine eigenen Übungen. Der eingebaute Katalog enthält bereits über 200 Einträge – hier landen nur die, die du selbst anlegst oder online hinzufügst.')}
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
              <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setEditing(exercise)} aria-label={t('Bearbeiten')}>
                <IconEdit />
              </button>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                onClick={() => {
                  const before = snapshot();
                  deleteExercise(exercise.id);
                  toast.show(t('Übung gelöscht'), { label: t('Rückgängig'), run: () => replaceState(before) });
                }}
                aria-label={t('Löschen')}
              >
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
          onCreate={(exercise) => { updateExercise(exercise.id, exercise); setEditing(null); }}
        />
      )}

      {creating && (
        <CustomExerciseDialog
          onClose={() => setCreating(false)}
          onCreate={(exercise) => {
            addExercise(exercise);
            setCreating(false);
            toast.show(t('„{name}“ angelegt', { name: exercise.name }));
          }}
        />
      )}

      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* --------------------------------------------------------- Erinnerung/Wetter */

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
function ReminderAndWeather() {
  const { state, updateSettings } = useStore();
  const toast = useToast();
  const reminder = state.settings.reminder;
  const plan = state.plans.find((item) => item.id === state.activePlanId) ?? null;
  const [alarmMin, setAlarmMin] = useState<number | null>(60);

  return (
    <>
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

      <WeatherSettingsCard />
    </>
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

/* -------------------------------------------------------------- Daten */

function DataSettings() {
  const { state, replaceState } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const importBackup = async (file: File) => {
    try {
      replaceState(importState(await file.text()));
      toast.show(t('Backup eingespielt'));
    } catch {
      toast.show(t('Datei konnte nicht gelesen werden'));
    }
  };

  return (
    <div className="card">
      <div className="card__title" style={{ marginBottom: 6 }}>{t('Daten')}</div>
      <div className="tiny dim" style={{ marginBottom: 11 }}>
        {t('Alles wird direkt auf diesem Gerät gespeichert und bleibt nach dem Schließen erhalten. Für den Wechsel auf ein anderes Gerät nutzt du Export und Import.')}
        {' '}
        <strong style={{ color: 'var(--warn)' }}>
          {t('Fortschrittsfotos sind nicht dabei')}
        </strong>{' '}
        {t('– die liegen nur auf diesem Gerät und werden unter Fotos gesondert heruntergeladen.')}
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
        <button className="btn" onClick={() => { downloadBackup(state); toast.show(t('Backup gespeichert')); }}>
          <IconDownload /> {t('Exportieren')}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <IconUpload /> {t('Importieren')}
        </button>
      </div>
      <CloudBackup />

      <div className="tiny dim center" style={{ marginTop: 11 }}>
        {t('App-Version')}: {new Date(__BUILD_TIME__).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}
        {isNativeApp() && ` · ${t('Android-App, Build {build}', { build: appBuild() })}`}
      </div>

      <button className="btn btn--danger btn--block" style={{ marginTop: 9 }} onClick={() => setResetOpen(true)}>
        <IconTrash /> {t('Alle Daten löschen')}
      </button>

      {resetOpen && (
        <ConfirmDialog
          title={t('Wirklich alles löschen?')}
          message={t('Profil, Pläne und sämtliche Trainings werden entfernt. Exportiere vorher ein Backup, wenn du die Daten behalten willst.')}
          confirmLabel={t('Alles löschen')}
          onCancel={() => setResetOpen(false)}
          onConfirm={() => {
            localStorage.clear();
            window.location.reload();
          }}
        />
      )}
    </div>
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

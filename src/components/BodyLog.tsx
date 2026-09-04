import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import type { MeasurementEntry } from '../types';
import { formatDateShort, todayISO } from '../lib/date';
import { useStore } from '../storage/store';
import {
  POSE_LABELS, deletePhoto, listPhotos, photosAvailable, savePhoto, shrinkImage,
  type PhotoPose, type ProgressPhoto,
} from '../storage/photos';
import { LineChart, type Point } from './charts/Charts';
import { ConfirmDialog, Modal, NumberInput, fmt, useToast } from './ui';
import { IconCamera, IconPlus, IconTrash } from './icons';

/** Die erfassten Umfaenge in der Reihenfolge, in der sie abgefragt werden. */
const FIELDS: Array<{ key: keyof Omit<MeasurementEntry, 'date'>; label: string }> = [
  { key: 'neckCm', label: 'Hals' },
  { key: 'chestCm', label: 'Brust' },
  { key: 'armCm', label: 'Oberarm' },
  { key: 'waistCm', label: 'Taille' },
  { key: 'hipCm', label: 'Hüfte' },
  { key: 'thighCm', label: 'Oberschenkel' },
  { key: 'calfCm', label: 'Wade' },
];

const emptyEntry = (date: string): MeasurementEntry => ({
  date,
  neckCm: null,
  chestCm: null,
  armCm: null,
  waistCm: null,
  hipCm: null,
  thighCm: null,
  calfCm: null,
});

/**
 * Koerpermasse.
 *
 * Das Gewicht allein taeuscht: Wer Muskeln aufbaut und Fett verliert, steht
 * wochenlang bei derselben Zahl. Umfaenge zeigen die Veraenderung deutlich
 * frueher - deshalb hier ein eigener Verlauf je Mass.
 */
export function MeasurementsDialog({ onClose }: { onClose: () => void }) {
  const { state, logMeasurement, removeMeasurement } = useStore();
  const toast = useToast();
  const entries = state.measurements ?? [];

  const [date, setDate] = useState(todayISO());
  const [draft, setDraft] = useState<MeasurementEntry>(() => (
    entries.find((entry) => entry.date === todayISO()) ?? emptyEntry(todayISO())
  ));
  const [chartKey, setChartKey] = useState<keyof Omit<MeasurementEntry, 'date'>>('waistCm');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Beim Datumswechsel den vorhandenen Eintrag laden, sonst ein leeres Formular.
  useEffect(() => {
    setDraft(entries.find((entry) => entry.date === date) ?? emptyEntry(date));
    // Absichtlich nur am Datum haengend: Tippen soll nicht zuruecksetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const points: Point[] = useMemo(() => entries
    .filter((entry) => entry[chartKey] != null)
    .map((entry) => ({
      label: formatDateShort(entry.date).replace(/\.\d{4}$/, ''),
      value: entry[chartKey] as number,
      detail: formatDateShort(entry.date),
    })), [entries, chartKey]);

  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];

  const save = () => {
    const hasValue = FIELDS.some(({ key }) => draft[key] != null);
    if (!hasValue) {
      toast.show(t('Trag mindestens ein Maß ein'));
      return;
    }
    logMeasurement({ ...draft, date });
    toast.show(t('Maße gespeichert'));
  };

  return (
    <Modal title={t('Körpermaße')} onClose={onClose}>
      <div className="list">
        <p className="small muted">
          {t("Immer an derselben Stelle und möglichst zur selben Tageszeit messen – sonst vergleichst du Zufall mit Zufall.")}
        </p>

        <div className="field">
          <label className="field__label">{t("Datum")}</label>
          <input
            className="input"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(event) => setDate(event.target.value || todayISO())}
          />
        </div>

        <div className="grid-2">
          {FIELDS.map(({ key, label }) => (
            <div className="field" key={key}>
              <label className="field__label">{t(label)} (cm)</label>
              <NumberInput
                value={draft[key]}
                min={0}
                max={300}
                step={0.5}
                placeholder="–"
                onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
              />
            </div>
          ))}
        </div>

        <button className="btn btn--primary btn--block" onClick={save}>{t('Speichern')}</button>

        {points.length > 1 && (
          <div className="card">
            <div className="card__header">
              <div className="card__title">{t("Verlauf")}</div>
            </div>
            <div className="chip-scroll" style={{ marginBottom: 10 }}>
              {FIELDS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`chip chip--button ${chartKey === key ? 'chip--accent' : ''}`}
                  onClick={() => setChartKey(key)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <LineChart points={points} unit="cm" formatValue={(value) => fmt(value, 1)} />
          </div>
        )}

        {latest && (
          <div className="card">
            <div className="card__title" style={{ marginBottom: 8 }}>
              {t('Zuletzt: {date}', { date: formatDateShort(latest.date) })}
            </div>
            <div className="list">
              {FIELDS.filter(({ key }) => latest[key] != null).map(({ key, label }) => {
                const before = previous?.[key];
                const delta = before != null ? (latest[key] as number) - before : null;
                return (
                  <div className="row row--between" key={key}>
                    <span className="small">{t(label)}</span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="mono bold">{fmt(latest[key] as number, 1)} cm</span>
                      {delta != null && Math.abs(delta) >= 0.05 && (
                        <span className={`chip ${delta > 0 ? 'chip--success' : 'chip--warn'}`}>
                          {delta > 0 ? '+' : '−'}{fmt(Math.abs(delta), 1)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <div className="card card--flush">
            <div className="section-label" style={{ padding: '12px 14px 4px' }}>
              {t('Alle Einträge')}
            </div>
            {[...entries].reverse().slice(0, 20).map((entry) => (
              <div className="row row--between" style={{ padding: '6px 14px' }} key={entry.date}>
                <button className="small link-row" onClick={() => setDate(entry.date)}>
                  {formatDateShort(entry.date)}
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => setConfirmDelete(entry.date)}
                  aria-label={t('Eintrag löschen')}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('Eintrag löschen?')}
          message={t('Die Maße vom {date} werden entfernt.', { date: formatDateShort(confirmDelete) })}
          confirmLabel={t('Löschen')}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => { removeMeasurement(confirmDelete); setConfirmDelete(null); }}
        />
      )}
    </Modal>
  );
}

/**
 * Fortschrittsfotos.
 *
 * Die Bilder bleiben ausdruecklich auf diesem Geraet: kein Server, keine
 * Freigabe, kein Backup. Zwei Aufnahmen lassen sich nebeneinander legen.
 */
export function PhotosDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [compare, setCompare] = useState<string[]>([]);
  const [pose, setPose] = useState<PhotoPose>('front');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const reload = async () => {
    const list = await listPhotos();
    setPhotos(list);
    setUrls((old) => {
      for (const url of Object.values(old)) URL.revokeObjectURL(url);
      const next: Record<string, string> = {};
      for (const photo of list) next[photo.id] = URL.createObjectURL(photo.blob);
      return next;
    });
  };

  useEffect(() => {
    void reload();
    // Beim Schliessen die Objekt-URLs wieder freigeben.
    return () => setUrls((old) => {
      for (const url of Object.values(old)) URL.revokeObjectURL(url);
      return {};
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (file: File) => {
    setBusy(true);
    try {
      const { blob, width, height } = await shrinkImage(file);
      await savePhoto({
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date: todayISO(),
        pose,
        blob,
        width,
        height,
        createdAt: new Date().toISOString(),
      });
      await reload();
      toast.show(t('Foto gespeichert'));
    } catch {
      toast.show(t('Das Foto ließ sich nicht speichern'));
    } finally {
      setBusy(false);
    }
  };

  const toggleCompare = (id: string) => setCompare((current) => {
    if (current.includes(id)) return current.filter((entry) => entry !== id);
    return [...current, id].slice(-2);
  });

  if (!photosAvailable()) {
    return (
      <Modal title={t('Fortschrittsfotos')} onClose={onClose}>
        <div className="empty">
          <div className="empty__icon">📷</div>
          <div>{t("Dieser Browser kann keine Bilder dauerhaft speichern.")}</div>
        </div>
      </Modal>
    );
  }

  const chosen = compare.map((id) => photos.find((photo) => photo.id === id)).filter(Boolean) as ProgressPhoto[];

  return (
    <Modal title={t('Fortschrittsfotos')} onClose={onClose}>
      <div className="list">
        <p className="small muted">
          {t("Die Bilder bleiben auf diesem Gerät. Sie werden nicht synchronisiert, nicht geteilt und liegen auch nicht im Backup.")}
        </p>

        <div className="chip-scroll">
          {(Object.keys(POSE_LABELS) as PhotoPose[]).map((key) => (
            <button
              key={key}
              className={`chip chip--button ${pose === key ? 'chip--accent' : ''}`}
              onClick={() => setPose(key)}
            >
              {t(POSE_LABELS[key])}
            </button>
          ))}
        </div>

        <label className="btn btn--primary btn--block" style={{ cursor: 'pointer' }}>
          <IconCamera /> {busy ? t('Wird gespeichert…') : t('Foto aufnehmen oder wählen')}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void add(file);
              event.target.value = '';
            }}
          />
        </label>

        {chosen.length === 2 && (
          <div className="card">
            <div className="card__title" style={{ marginBottom: 8 }}>{t("Vergleich")}</div>
            <div className="photo-compare">
              {chosen.map((photo) => (
                <figure key={photo.id}>
                  <img src={urls[photo.id]} alt="" loading="lazy" />
                  <figcaption className="tiny dim">
                    {formatDateShort(photo.date)} · {t(POSE_LABELS[photo.pose])}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {photos.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">📷</div>
            <div>{t("Noch keine Fotos")}</div>
            <div className="tiny" style={{ marginTop: 5 }}>
              {t("Gleiche Stelle, gleiches Licht, gleiche Tageszeit – sonst vergleichst du Beleuchtung statt Fortschritt.")}
            </div>
          </div>
        ) : (
          <>
            <div className="tiny dim">
              {t("Tippe zwei Bilder an, um sie nebeneinander zu legen.")}
            </div>
            <div className="photo-grid">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className={`photo-tile ${compare.includes(photo.id) ? 'photo-tile--on' : ''}`}
                >
                  <button onClick={() => toggleCompare(photo.id)}>
                    <img src={urls[photo.id]} alt="" loading="lazy" />
                  </button>
                  <div className="row row--between tiny dim" style={{ padding: '4px 6px' }}>
                    <span>{formatDateShort(photo.date)}</span>
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => setConfirmDelete(photo.id)}
                      aria-label={t('Foto löschen')}
                    >
                      <IconTrash style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('Foto löschen?')}
          message={t('Das Bild wird von diesem Gerät entfernt. Rückgängig geht das nicht.')}
          confirmLabel={t('Löschen')}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            await deletePhoto(confirmDelete);
            setCompare((current) => current.filter((id) => id !== confirmDelete));
            setConfirmDelete(null);
            await reload();
          }}
        />
      )}
    </Modal>
  );
}

/** Kleiner Einstieg fuers Profil. */
export function BodyLogButtons({
  onMeasurements, onPhotos,
}: {
  onMeasurements: () => void;
  onPhotos: () => void;
}) {
  return (
    <div className="grid-2">
      <button className="btn" onClick={onMeasurements}><IconPlus /> {t('Maße')}</button>
      <button className="btn" onClick={onPhotos}><IconCamera /> {t('Fotos')}</button>
    </div>
  );
}

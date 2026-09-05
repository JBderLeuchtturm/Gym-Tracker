import { exerciseName, t } from '../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, ExerciseCategory, ExerciseKind } from '../types';
import { ALL_EQUIPMENT, CATEGORY_LABELS, KIND_LABELS, slugify } from '../data/catalog';
import { normalize, searchExercises } from '../lib/search';
import { recentExerciseIds } from '../lib/stats';
import { categoryColor, categoryTint } from '../lib/categoryColors';
import { enrichWgerExercise, isWgerUnavailable, searchWger } from '../api/wger';
import { useStore } from '../storage/store';
import { Modal, useToast } from './ui';
import { IconInfo, IconPlus, IconSearch } from './icons';
import { BodyMap } from './MuscleMap';
import {
  REGION_LABELS, fitsEquipment, regionRole, suggestForRegion, type MuscleRegion,
} from '../lib/muscles';

/**
 * Kurzbeschreibung fuer die Trefferliste - ohne die Kategorie, die davor
 * schon in ihrer Farbe steht.
 */
function describeRest(exercise: Exercise): string {
  const parts: string[] = [];
  if (exercise.primaryMuscles.length > 0) parts.push(exercise.primaryMuscles.slice(0, 2).join(', '));
  if (exercise.equipment.length > 0) parts.push(exercise.equipment.slice(0, 2).join(', '));
  return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
}

export function ExercisePicker({
  onPick, onClose, title = t('Übung suchen'), excludeIds = [],
}: {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  title?: string;
  excludeIds?: string[];
}) {
  const { state, allExercises, addExercise } = useStore();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [equipment, setEquipment] = useState<string>('all');
  const [remote, setRemote] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiDown, setApiDown] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showMap, setShowMap] = useState(false);
  // Ist ein Geraeteprofil hinterlegt, filtert die Suche zunaechst danach.
  const ownEquipment = state.settings.availableEquipment;
  const [onlyMine, setOnlyMine] = useState(ownEquipment.length > 0);
  const [region, setRegion] = useState<MuscleRegion | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Online-Suche mit Entprellung - der lokale Katalog liefert sofort Treffer.
  useEffect(() => {
    if (!state.settings.useWgerApi || query.trim().length < 2) { setRemote([]); return; }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const results = await searchWger(query);
      if (!cancelled) { setRemote(results); setLoading(false); setApiDown(isWgerUnavailable()); }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); setLoading(false); };
  }, [query, state.settings.useWgerApi]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filteredPool = useMemo(() => {
    return allExercises.filter((exercise) => {
      if (category !== 'all' && exercise.category !== category) return false;
      if (equipment !== 'all' && !exercise.equipment.includes(equipment)) return false;
      if (region && !regionRole(exercise, region)) return false;
      if (onlyMine && !fitsEquipment(exercise, ownEquipment)) return false;
      return true;
    });
  }, [allExercises, category, equipment, region, onlyMine, ownEquipment]);

  /*
   * Zuletzt Benutztes steht oben - aber nur in der offenen Liste. Sobald
   * jemand tippt oder eine Muskelgruppe antippt, hat er gesagt, was er sucht;
   * dann waere eine Vorschlagszeile darueber nur noch im Weg.
   */
  const recent = useMemo(() => {
    if (query.trim().length > 0 || region || category !== 'all' || equipment !== 'all') return [];
    const byId = new Map(allExercises.map((exercise) => [exercise.id, exercise]));
    return recentExerciseIds(state, 10)
      .map((id) => byId.get(id))
      .filter((exercise): exercise is Exercise => Boolean(exercise));
  }, [state, allExercises, query, region, category, equipment]);

  const localResults = useMemo(() => {
    if (query.trim().length === 0) {
      if (region) {
        // Vorschlaege zur angetippten Muskelgruppe: erst die Uebungen, die sie
        // direkt treffen, danach die, bei denen sie mitarbeitet.
        return suggestForRegion(filteredPool, region).slice(0, 80).map((exercise) => ({
          exercise,
          score: 0,
          reason: regionRole(exercise, region) === 'primary' ? t('Zielmuskel') : t('unterstützt'),
        }));
      }
      // Ohne Suchbegriff: die Auswahl nach Kategorie sortiert anzeigen.
      const shownAbove = new Set(recent.map((exercise) => exercise.id));
      return filteredPool
        .filter((exercise) => !shownAbove.has(exercise.id))
        .slice(0, 80)
        .map((exercise) => ({ exercise, score: 0, reason: '' }));
    }
    return searchExercises(filteredPool, query, 70);
  }, [filteredPool, query, region, recent]);

  const remoteResults = useMemo(() => {
    const known = new Set(allExercises.map((exercise) => normalize(exercise.name)));
    for (const exercise of allExercises) {
      if (exercise.nameEn) known.add(normalize(exercise.nameEn));
    }
    return remote.filter((exercise) => {
      if (known.has(normalize(exercise.name))) return false;
      if (category !== 'all' && exercise.category !== category) return false;
      if (region && !regionRole(exercise, region)) return false;
      return true;
    });
  }, [remote, allExercises, category, region]);

  const pick = async (exercise: Exercise, isRemote: boolean) => {
    let final = exercise;
    if (isRemote) {
      final = await enrichWgerExercise(exercise);
      addExercise(final);
    }
    onPick(final);
  };

  const totalCount = localResults.length + remoteResults.length;

  return (
    <Modal title={title} onClose={onClose} flush>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: 'var(--text-dim)' }}
          />
          <input
            ref={inputRef}
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder={t("z. B. Bankdrücken, Squat, Latissimus, Kurzhantel…")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="chip-scroll" style={{ marginTop: 10 }}>
          <button
            className={`chip chip--button ${category === 'all' ? 'chip--accent' : ''}`}
            onClick={() => setCategory('all')}
          >
            Alle
          </button>
          {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((key) => (
            <button
              key={key}
              className={`chip chip--button ${category === key ? 'chip--cat' : ''}`}
              style={{ '--cat': categoryColor(key), '--cat-tint': categoryTint(key, 0.18) } as React.CSSProperties}
              onClick={() => setCategory(category === key ? 'all' : key)}
            >
              <span className="cat-dot" style={{ '--cat': categoryColor(key) } as React.CSSProperties} />
              {t(CATEGORY_LABELS[key])}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <select
            className="select"
            style={{ padding: '7px 9px', fontSize: '0.82rem' }}
            value={equipment}
            onChange={(event) => setEquipment(event.target.value)}
          >
            <option value="all">{t("Alle Geräte")}</option>
            {ALL_EQUIPMENT.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button
            className={`chip chip--button ${showMap ? 'chip--accent' : ''}`}
            onClick={() => setShowMap((open) => !open)}
          >
            {t("Muskelkarte")}
          </button>
          {ownEquipment.length > 0 && (
            <button
              className={`chip chip--button ${onlyMine ? 'chip--accent' : ''}`}
              aria-pressed={onlyMine}
              onClick={() => setOnlyMine((value) => !value)}
            >
              {t("Meine Geräte")}
            </button>
          )}
          <span className="tiny dim nowrap">{totalCount} Treffer</span>
        </div>

        {showMap && (
          <div style={{ marginTop: 10 }}>
            <BodyMap
              size={130}
              selected={region}
              onSelect={(picked) => setRegion(picked === region ? null : picked)}
              intensity={(candidate) => (candidate === region ? 'primary' : 'none')}
            />
            <div className="tiny dim" style={{ textAlign: 'center', marginTop: 6 }}>
              {region
                ? t('Vorschläge für {muscle}', { muscle: t(REGION_LABELS[region]) })
                : t('Tippe eine Muskelgruppe an, um passende Übungen zu sehen.')}
            </div>
          </div>
        )}

        {region && (
          <div className="row row--wrap" style={{ marginTop: 8, gap: 6 }}>
            <span className="chip chip--accent">{t(REGION_LABELS[region])}</span>
            <button className="chip chip--button" onClick={() => setRegion(null)}>
              {t("Filter aufheben")}
            </button>
          </div>
        )}
      </div>

      <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        {recent.length > 0 && (
          <div className="section-label" style={{ padding: '12px 14px 6px' }}>
            {t('Zuletzt benutzt')}
          </div>
        )}
        {recent.map((exercise) => (
          <button
            key={`recent-${exercise.id}`}
            className="search-result"
            disabled={excluded.has(exercise.id)}
            style={excluded.has(exercise.id) ? { opacity: 0.4 } : undefined}
            onClick={() => pick(exercise, false)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{exerciseName(exercise)}</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                <span
                  className="cat-dot"
                  style={{ '--cat': categoryColor(exercise.category) } as React.CSSProperties}
                />
                <span style={{ fontWeight: 550 }}>{t(CATEGORY_LABELS[exercise.category])}</span>
                {describeRest(exercise)}
              </span>
            </span>
            {excluded.has(exercise.id)
              ? <span className="chip">{t("drin")}</span>
              : <IconPlus style={{ width: 17, height: 17, color: 'var(--text-dim)', flexShrink: 0 }} />}
          </button>
        ))}

        {recent.length > 0 && localResults.length > 0 && (
          <div className="section-label" style={{ padding: '14px 14px 6px' }}>
            {t('Alle Übungen')}
          </div>
        )}

        {localResults.map(({ exercise, reason }) => (
          <button
            key={exercise.id}
            className="search-result"
            disabled={excluded.has(exercise.id)}
            style={excluded.has(exercise.id) ? { opacity: 0.4 } : undefined}
            onClick={() => pick(exercise, false)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{exerciseName(exercise)}</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                <span
                  className="cat-dot"
                  style={{ '--cat': categoryColor(exercise.category) } as React.CSSProperties}
                />
                <span style={{ fontWeight: 550 }}>{t(CATEGORY_LABELS[exercise.category])}</span>
                {describeRest(exercise)}{reason ? ` · ${reason}` : ''}
              </span>
            </span>
            {exercise.source === 'custom' && <span className="chip chip--warn">{t("eigen")}</span>}
            {excluded.has(exercise.id)
              ? <span className="chip">{t("drin")}</span>
              : <IconPlus style={{ width: 17, height: 17, color: 'var(--text-dim)', flexShrink: 0 }} />}
          </button>
        ))}

        {remoteResults.length > 0 && (
          <div className="section-label" style={{ padding: '12px 14px 6px' }}>
            Weitere Vorschläge aus der wger-Datenbank
          </div>
        )}
        {remoteResults.map((exercise) => (
          <button
            key={exercise.id}
            className="search-result"
            onClick={() => pick(exercise, true)}
          >
            {exercise.imageUrl && (
              <span className="search-result__thumb">
                <img src={exercise.imageUrl} alt="" loading="lazy" />
              </span>
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{exerciseName(exercise)}</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                <span
                  className="cat-dot"
                  style={{ '--cat': categoryColor(exercise.category) } as React.CSSProperties}
                />
                <span style={{ fontWeight: 550 }}>{t(CATEGORY_LABELS[exercise.category])}</span>
                {` · ${t('online')}`}
              </span>
            </span>
            <IconPlus style={{ width: 17, height: 17, color: 'var(--text-dim)', flexShrink: 0 }} />
          </button>
        ))}

        {loading && <div className="empty tiny">{t("Suche online weiter…")}</div>}

        {totalCount === 0 && !loading && (
          <div className="empty">
                        <div>Nichts gefunden für „{query}“</div>
            <div className="tiny" style={{ marginTop: 6 }}>
              Lege die Übung einfach selbst an – sie steht dann dauerhaft zur Verfügung.
            </div>
          </div>
        )}

        {query.trim().length >= 2 && (
          <button
            className="search-result"
            style={{ color: 'var(--accent)' }}
            onClick={() => setShowCustom(true)}
          >
            <span className="search-result__thumb"><IconPlus style={{ width: 18, height: 18 }} /></span>
            <span style={{ flex: 1 }}>
              <span className="search-result__name">„{query.trim()}“ als eigene Übung anlegen</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                Mit Muskelgruppe, Gerät und MET-Wert
              </span>
            </span>
          </button>
        )}

        {state.settings.useWgerApi && apiDown && (
          <div className="row tiny dim" style={{ padding: '10px 14px', gap: 6 }}>
            <IconInfo style={{ width: 14, height: 14, flexShrink: 0 }} />
            Online-Datenbank gerade nicht erreichbar – der eingebaute Katalog funktioniert weiter.
          </div>
        )}
      </div>

      {showCustom && (
        <CustomExerciseDialog
          initialName={query.trim()}
          onClose={() => setShowCustom(false)}
          onCreate={(exercise) => {
            addExercise(exercise);
            toast.show(t('„{name}“ angelegt', { name: exercise.name }));
            setShowCustom(false);
            onPick(exercise);
          }}
        />
      )}
    </Modal>
  );
}

/* ---------------------------------------------------- Eigene Übung anlegen */

export function CustomExerciseDialog({
  initialName, onClose, onCreate, initial,
}: {
  initialName?: string;
  onClose: () => void;
  onCreate: (exercise: Exercise) => void;
  initial?: Exercise;
}) {
  const [name, setName] = useState(initial?.name ?? initialName ?? '');
  const [category, setCategory] = useState<ExerciseCategory>(initial?.category ?? 'chest');
  const [kind, setKind] = useState<ExerciseKind>(initial?.kind ?? 'strength');
  const [muscles, setMuscles] = useState(initial?.primaryMuscles.join(', ') ?? '');
  const [equipment, setEquipment] = useState(initial?.equipment.join(', ') ?? '');
  const [met, setMet] = useState(String(initial?.met ?? 5));
  const [description, setDescription] = useState(initial?.description ?? '');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({
      id: initial?.id ?? `own_${slugify(trimmed)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      nameEn: initial?.nameEn,
      category,
      kind,
      primaryMuscles: muscles.split(',').map((item) => item.trim()).filter(Boolean),
      secondaryMuscles: initial?.secondaryMuscles ?? [],
      equipment: equipment.split(',').map((item) => item.trim()).filter(Boolean),
      met: Number.parseFloat(met.replace(',', '.')) || 5,
      description: description.trim() || undefined,
      source: 'custom',
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <Modal title={initial ? t('Übung bearbeiten') : t('Eigene Übung')} onClose={onClose}>
      <div className="list">
        <div className="field">
          <label className="field__label">{t("Name")}</label>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label">{t("Muskelgruppe")}</label>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value as ExerciseCategory)}>
              {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((key) => (
                <option key={key} value={key}>{t(CATEGORY_LABELS[key])}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">{t("Art")}</label>
            <select className="select" value={kind} onChange={(event) => setKind(event.target.value as ExerciseKind)}>
              {(Object.keys(KIND_LABELS) as ExerciseKind[]).map((key) => (
                <option key={key} value={key}>{t(KIND_LABELS[key])}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label">{t("Muskeln (mit Komma trennen)")}</label>
          <input className="input" value={muscles} placeholder={t("Brust groß, Trizeps")} onChange={(event) => setMuscles(event.target.value)} />
        </div>

        <div className="field">
          <label className="field__label">{t("Geräte (mit Komma trennen)")}</label>
          <input className="input" value={equipment} placeholder={t("Langhantel, Flachbank")} onChange={(event) => setEquipment(event.target.value)} />
        </div>

        <div className="field">
          <label className="field__label">{t("MET-Wert")}</label>
          <input className="input" value={met} inputMode="decimal" onChange={(event) => setMet(event.target.value)} />
          <span className="field__hint">
            Anstrengung für die Kalorienberechnung: 3 = leicht, 5 = Krafttraining, 8+ = intensives Cardio.
          </span>
        </div>

        <div className="field">
          <label className="field__label">Notiz / Ausführung (optional)</label>
          <textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t("Abbrechen")}</button>
          <button className="btn btn--primary" onClick={submit} disabled={!name.trim()}>
            {initial ? t('Speichern') : t('Anlegen')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

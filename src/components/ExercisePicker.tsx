import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, ExerciseCategory, ExerciseKind } from '../types';
import { ALL_EQUIPMENT, CATEGORY_LABELS, KIND_LABELS, slugify } from '../data/catalog';
import { normalize, searchExercises } from '../lib/search';
import { enrichWgerExercise, isWgerUnavailable, searchWger } from '../api/wger';
import { useStore } from '../storage/store';
import { Modal, useToast } from './ui';
import { IconInfo, IconPlus, IconSearch } from './icons';

const CATEGORY_ICONS: Record<ExerciseCategory, string> = {
  chest: '🫁', back: '🔙', legs: '🦵', shoulders: '🏋️', arms: '💪',
  core: '🎯', glutes: '🍑', cardio: '🏃', fullbody: '🔥', mobility: '🧘', other: '⚙️',
};

/** Erzeugt eine Kurzbeschreibung fuer die Trefferliste. */
function describe(exercise: Exercise): string {
  const parts: string[] = [CATEGORY_LABELS[exercise.category]];
  if (exercise.primaryMuscles.length > 0) parts.push(exercise.primaryMuscles.slice(0, 2).join(', '));
  if (exercise.equipment.length > 0) parts.push(exercise.equipment.slice(0, 2).join(', '));
  return parts.join(' · ');
}

export function ExercisePicker({
  onPick, onClose, title = 'Übung suchen', excludeIds = [],
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
      return true;
    });
  }, [allExercises, category, equipment]);

  const localResults = useMemo(() => {
    if (query.trim().length === 0) {
      // Ohne Suchbegriff: die Auswahl nach Kategorie sortiert anzeigen.
      return filteredPool.slice(0, 80).map((exercise) => ({ exercise, score: 0, reason: '' }));
    }
    return searchExercises(filteredPool, query, 70);
  }, [filteredPool, query]);

  const remoteResults = useMemo(() => {
    const known = new Set(allExercises.map((exercise) => normalize(exercise.name)));
    for (const exercise of allExercises) {
      if (exercise.nameEn) known.add(normalize(exercise.nameEn));
    }
    return remote.filter((exercise) => {
      if (known.has(normalize(exercise.name))) return false;
      if (category !== 'all' && exercise.category !== category) return false;
      return true;
    });
  }, [remote, allExercises, category]);

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
            placeholder="z. B. Bankdrücken, Squat, Latissimus, Kurzhantel…"
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
              className={`chip chip--button ${category === key ? 'chip--accent' : ''}`}
              onClick={() => setCategory(category === key ? 'all' : key)}
            >
              {CATEGORY_ICONS[key]} {CATEGORY_LABELS[key]}
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
            <option value="all">Alle Geräte</option>
            {ALL_EQUIPMENT.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <span className="tiny dim nowrap">{totalCount} Treffer</span>
        </div>
      </div>

      <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
        {localResults.map(({ exercise, reason }) => (
          <button
            key={exercise.id}
            className="search-result"
            disabled={excluded.has(exercise.id)}
            style={excluded.has(exercise.id) ? { opacity: 0.4 } : undefined}
            onClick={() => pick(exercise, false)}
          >
            <span className="search-result__thumb">{CATEGORY_ICONS[exercise.category]}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{exercise.name}</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                {describe(exercise)}{reason ? ` · ${reason}` : ''}
              </span>
            </span>
            {exercise.source === 'custom' && <span className="chip chip--warn">eigen</span>}
            {excluded.has(exercise.id)
              ? <span className="chip">drin</span>
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
            <span className="search-result__thumb">
              {exercise.imageUrl
                ? <img src={exercise.imageUrl} alt="" loading="lazy" />
                : CATEGORY_ICONS[exercise.category]}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{exercise.name}</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                {CATEGORY_LABELS[exercise.category]} · online
              </span>
            </span>
            <IconPlus style={{ width: 17, height: 17, color: 'var(--text-dim)', flexShrink: 0 }} />
          </button>
        ))}

        {loading && <div className="empty tiny">Suche online weiter…</div>}

        {totalCount === 0 && !loading && (
          <div className="empty">
            <div className="empty__icon">🔍</div>
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
            toast.show(`„${exercise.name}“ angelegt`);
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
    <Modal title={initial ? 'Übung bearbeiten' : 'Eigene Übung'} onClose={onClose}>
      <div className="list">
        <div className="field">
          <label className="field__label">Name</label>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label">Muskelgruppe</label>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value as ExerciseCategory)}>
              {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((key) => (
                <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Art</label>
            <select className="select" value={kind} onChange={(event) => setKind(event.target.value as ExerciseKind)}>
              {(Object.keys(KIND_LABELS) as ExerciseKind[]).map((key) => (
                <option key={key} value={key}>{KIND_LABELS[key]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label">Muskeln (mit Komma trennen)</label>
          <input className="input" value={muscles} placeholder="Brust groß, Trizeps" onChange={(event) => setMuscles(event.target.value)} />
        </div>

        <div className="field">
          <label className="field__label">Geräte (mit Komma trennen)</label>
          <input className="input" value={equipment} placeholder="Langhantel, Flachbank" onChange={(event) => setEquipment(event.target.value)} />
        </div>

        <div className="field">
          <label className="field__label">MET-Wert</label>
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
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn btn--primary" onClick={submit} disabled={!name.trim()}>
            {initial ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

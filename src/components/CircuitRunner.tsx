import { exerciseName, t } from '../i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, SetLog, TrackingMode } from '../types';
import { fieldsOf, setText } from '../lib/tracking';
import { formatClock } from '../lib/date';
import { beep } from '../lib/beep';
import { useWakeLock } from '../lib/wakeLock';
import { IconCheck, IconPause, IconPlay, IconSkip, IconX } from './icons';

/**
 * Der gefuehrte Zirkel.
 *
 * "30 Sekunden Burpees, direkt 30 Sekunden Kniebeugen, dann eine Minute
 * Pause, das Ganze viermal" - so steht es an der Tafel, und so laeuft es an
 * der Hallenuhr. Vorher musste man dafuer jede Uebung von Hand abhaken und die
 * Zeit selbst im Kopf behalten; jetzt zaehlt die App herunter, springt
 * weiter, zaehlt die Runden und hakt dabei die Saetze ab.
 *
 * Uebungen ohne Zeit (Wiederholungen, "nur Saetze") laufen trotzdem mit: Dann
 * zaehlt die Uhr hoch statt herunter, und ein grosser Knopf sagt "fertig".
 */

export interface CircuitMember {
  key: string;
  exercise: Exercise | undefined;
  tracking: TrackingMode;
  /** Die Arbeitssaetze in Reihenfolge - Runde n ist der n-te Satz. */
  sets: SetLog[];
  /** Arbeitszeit je Satz bei Zeit-Erfassung. */
  workSec: number | null;
  /** Wechselzeit nach dieser Uebung, bevor die naechste der Runde beginnt. */
  transitionSec: number;
}

type Stage = 'ready' | 'work' | 'transition' | 'rest' | 'done';

interface Cursor {
  stage: Stage;
  round: number;
  member: number;
}

/** Vor dem Start drei Sekunden - Zeit, das Handy hinzulegen. */
const READY_SEC = 3;

export function CircuitRunner({
  members, restSec, startRound, sound, onCompleteSet, onClose,
}: {
  members: CircuitMember[];
  restSec: number;
  startRound: number;
  sound: boolean;
  onCompleteSet: (memberKey: string, setId: string, patch: Partial<SetLog>) => void;
  onClose: () => void;
}) {
  useWakeLock(true);

  const rounds = Math.max(1, ...members.map((member) => member.sets.length));
  /** Ein Satz dieser Uebung in dieser Runde, sofern es ihn gibt und er noch offen ist. */
  const openSet = useCallback((memberIndex: number, round: number): SetLog | null => {
    const set = members[memberIndex]?.sets[round - 1];
    return set && !set.done ? set : null;
  }, [members]);

  const firstIn = useCallback((round: number, from = 0): number => {
    for (let index = from; index < members.length; index += 1) {
      if (openSet(index, round)) return index;
    }
    return -1;
  }, [members.length, openSet]);

  const [cursor, setCursor] = useState<Cursor>(() => ({
    stage: 'ready', round: Math.min(rounds, Math.max(1, startRound)), member: 0,
  }));
  const [endsAt, setEndsAt] = useState<number | null>(() => Date.now() + READY_SEC * 1000);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [paused, setPaused] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastBeep = useRef<number | null>(null);

  const current = members[cursor.member];
  const timed = current ? fieldsOf(current.tracking).time && !fieldsOf(current.tracking).reps : false;

  /** Setzt eine Phase mit Countdown oder - ohne Dauer - mit hochzaehlender Uhr. */
  const enter = useCallback((next: Cursor, seconds: number | null) => {
    setCursor(next);
    setPaused(null);
    lastBeep.current = null;
    const start = Date.now();
    setStartedAt(start);
    setEndsAt(seconds && seconds > 0 ? start + seconds * 1000 : null);
    if (sound) beep(next.stage === 'work' ? 2 : 1, next.stage === 'work' ? 990 : 660);
    navigator.vibrate?.(next.stage === 'work' ? [40, 60, 40] : 30);
  }, [sound]);

  const workSeconds = useCallback((memberIndex: number): number | null => {
    const member = members[memberIndex];
    if (!member) return null;
    const fields = fieldsOf(member.tracking);
    if (!fields.time || fields.reps) return null;
    const set = member.sets[cursor.round - 1];
    return set?.durationSec ?? member.workSec ?? 30;
  }, [members, cursor.round]);

  /** Weiter zur naechsten Uebung, Runde oder zum Ende. */
  const advance = useCallback((from: Cursor) => {
    const nextMember = firstIn(from.round, from.member + 1);
    if (nextMember >= 0) {
      const transition = members[from.member]?.transitionSec ?? 0;
      if (transition > 0) {
        enter({ stage: 'transition', round: from.round, member: nextMember }, transition);
      } else {
        const seconds = workSeconds(nextMember);
        enter({ stage: 'work', round: from.round, member: nextMember }, seconds);
      }
      return;
    }
    // Runde vorbei - naechste Runde mit einer offenen Uebung suchen.
    for (let round = from.round + 1; round <= rounds; round += 1) {
      const first = firstIn(round);
      if (first >= 0) {
        if (restSec > 0) enter({ stage: 'rest', round, member: first }, restSec);
        else enter({ stage: 'work', round, member: first }, workSeconds(first));
        return;
      }
    }
    enter({ stage: 'done', round: from.round, member: from.member }, null);
    if (sound) beep(3, 1180);
  }, [enter, firstIn, members, rounds, restSec, sound, workSeconds]);

  /** Die laufende Uebung ist geschafft: Satz abhaken, dann weiter. */
  const finishWork = useCallback((skip = false) => {
    const set = openSet(cursor.member, cursor.round);
    if (set && !skip) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const member = members[cursor.member];
      const fields = fieldsOf(member.tracking);
      onCompleteSet(member.key, set.id, {
        done: true,
        ...(fields.time ? { durationSec: endsAt ? (set.durationSec ?? member.workSec ?? elapsed) : elapsed } : {}),
      });
    }
    advance(cursor);
  }, [advance, cursor, endsAt, members, onCompleteSet, openSet, startedAt]);

  /* Takt: fuenfmal pro Sekunde reicht fuer eine Anzeige in ganzen Sekunden. */
  useEffect(() => {
    if (paused !== null || cursor.stage === 'done') return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [paused, cursor.stage]);

  /* Ablauf eines Countdowns - und die drei Pieptoene davor. */
  useEffect(() => {
    if (paused !== null || endsAt === null) return;
    const remaining = Math.ceil((endsAt - now) / 1000);
    if (remaining <= 3 && remaining >= 1 && lastBeep.current !== remaining) {
      lastBeep.current = remaining;
      if (sound) beep(1, 660);
    }
    if (now < endsAt) return;
    if (cursor.stage === 'ready') {
      const first = firstIn(cursor.round);
      if (first < 0) { advance({ ...cursor, member: members.length }); return; }
      enter({ stage: 'work', round: cursor.round, member: first }, workSeconds(first));
    } else if (cursor.stage === 'work') {
      finishWork();
    } else if (cursor.stage === 'transition' || cursor.stage === 'rest') {
      enter({ ...cursor, stage: 'work' }, workSeconds(cursor.member));
    }
  }, [now, endsAt, paused, cursor, enter, finishWork, firstIn, advance, members.length, sound, workSeconds]);

  const togglePause = () => {
    if (paused === null) {
      setPaused(Date.now());
      return;
    }
    const pausedFor = Date.now() - paused;
    setStartedAt((value) => value + pausedFor);
    setEndsAt((value) => (value === null ? null : value + pausedFor));
    setPaused(null);
    setNow(Date.now());
  };

  const skip = () => {
    if (cursor.stage === 'work') finishWork(true);
    else if (cursor.stage === 'ready' || cursor.stage === 'transition' || cursor.stage === 'rest') {
      setEndsAt(Date.now());
      setNow(Date.now());
    }
  };

  const reference = paused ?? now;
  const remainingSec = endsAt !== null ? Math.max(0, Math.ceil((endsAt - reference) / 1000)) : null;
  const elapsedSec = Math.max(0, Math.floor((reference - startedAt) / 1000));
  const totalSec = endsAt !== null ? Math.max(1, Math.round((endsAt - startedAt) / 1000)) : null;
  const progress = totalSec !== null && remainingSec !== null ? 1 - remainingSec / totalSec : 0;

  const upcoming = useMemo(() => {
    if (cursor.stage === 'done') return null;
    if (cursor.stage !== 'work') return members[cursor.member];
    const next = firstIn(cursor.round, cursor.member + 1);
    if (next >= 0) return members[next];
    for (let round = cursor.round + 1; round <= rounds; round += 1) {
      const first = firstIn(round);
      if (first >= 0) return members[first];
    }
    return null;
  }, [cursor, firstIn, members, rounds]);

  const label: Record<Stage, string> = {
    ready: t('Gleich geht es los'),
    work: t('Los'),
    transition: t('Wechseln'),
    rest: t('Pause'),
    done: t('Zirkel geschafft'),
  };

  const set = current?.sets[cursor.round - 1];

  return (
    <div className={`circuit circuit--${cursor.stage}`} role="dialog" aria-modal="true" aria-label={t('Zirkel')}>
      <div className="circuit__top">
        <span className="circuit__round">
          {t('Runde {n}/{total}', { n: cursor.round, total: rounds })}
        </span>
        <button className="circuit__close" onClick={onClose} aria-label={t('Zirkel beenden')}>
          <IconX />
        </button>
      </div>

      <div className="circuit__stage">{label[cursor.stage]}</div>

      {cursor.stage === 'done' ? (
        <div className="circuit__center">
          <div className="circuit__name">{t('{rounds} Runden', { rounds })}</div>
          <p className="circuit__hint">{t('Alle Sätze sind abgehakt.')}</p>
          <button className="circuit__big" onClick={onClose}><IconCheck /> {t('Fertig')}</button>
        </div>
      ) : (
        <div className="circuit__center">
          <div className="circuit__name">
            {cursor.stage === 'work' || cursor.stage === 'ready'
              ? exerciseName(current?.exercise)
              : exerciseName(upcoming?.exercise)}
          </div>
          {cursor.stage === 'work' && set && !timed && current && (
            <div className="circuit__target">{setText(set, current.tracking, current.exercise?.kind)}</div>
          )}

          <div className="circuit__clock mono" aria-live="off">
            {remainingSec !== null ? formatClock(remainingSec) : formatClock(elapsedSec)}
          </div>
          <div className="circuit__bar" aria-hidden="true">
            <div className="circuit__bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>

          {cursor.stage === 'work' && !timed && (
            <button className="circuit__big" onClick={() => finishWork()}>
              <IconCheck /> {t('Fertig')}
            </button>
          )}

          {upcoming && cursor.stage === 'work' && (
            <p className="circuit__hint">{t('Danach: {name}', { name: exerciseName(upcoming.exercise) })}</p>
          )}
        </div>
      )}

      {cursor.stage !== 'done' && (
        <div className="circuit__controls">
          <button className="circuit__ctrl" onClick={togglePause} aria-label={paused !== null ? t('Weiter') : t('Anhalten')}>
            {paused !== null ? <IconPlay /> : <IconPause />}
            <span>{paused !== null ? t('Weiter') : t('Anhalten')}</span>
          </button>
          <button className="circuit__ctrl" onClick={skip} aria-label={t('Überspringen')}>
            <IconSkip />
            <span>{t('Überspringen')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

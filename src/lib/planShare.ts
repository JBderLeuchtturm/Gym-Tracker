import type { Exercise, Plan, PlanDay, PlanExercise, Weekday } from '../types';

/**
 * Plaene weitergeben.
 *
 * Bewusst ohne Server: Der Plan wird in einen Textbaustein verpackt, den man
 * per Nachricht verschickt. Das funktioniert auch mit Leuten, die kein Konto
 * haben, es wandern keine Trainingsdaten ueber fremde Wege, und niemand muss
 * dafuer Freund sein.
 *
 * Eigene Uebungen reisen mit - sonst stuende beim Empfaenger eine Luecke im
 * Plan, wo im Original "Reverse Nordic Curl" steht.
 */

const PREFIX = 'GTPLAN1:';

interface PackedExercise {
  e: string;              // exerciseId
  s: number;              // targetSets
  a?: number | null;      // targetRepsMin
  b?: number | null;      // targetRepsMax
  w?: number | null;      // targetWeightKg
  r?: number | null;      // restSec
  p?: number | null;      // progressionKg
  g?: string;             // groupId
  n?: string;             // note
}

interface PackedDay {
  t: string;              // title
  x?: 1;                  // isRestDay
  l: PackedExercise[];
}

interface PackedCustom {
  id: string;
  name: string;
  category: string;
  kind: string;
  equipment: string[];
  primary: string[];
  secondary: string[];
  met: number;
}

interface Packed {
  v: 1;
  n: string;              // Plan-Name
  d?: string;             // Beschreibung
  c?: {                   // Zyklus
    w: number; dw: number | null; sp: number; dp: number;
  };
  days: PackedDay[];
  custom: PackedCustom[];
}

/** Base64 mit Umlauten, url-tauglich. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64(code: string): string {
  const padded = code.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Verpackt einen Plan samt der darin verwendeten eigenen Uebungen. */
export function encodePlan(
  plan: Plan,
  getExercise: (id: string) => Exercise | undefined,
): string {
  const usedIds = new Set<string>();
  for (const day of plan.days) {
    for (const item of day.exercises) usedIds.add(item.exerciseId);
  }

  const custom: PackedCustom[] = [];
  for (const id of usedIds) {
    const exercise = getExercise(id);
    // Katalog-Uebungen kennt der Empfaenger bereits - nur Eigene reisen mit.
    if (!exercise || exercise.source === 'catalog') continue;
    custom.push({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      kind: exercise.kind,
      equipment: exercise.equipment,
      primary: exercise.primaryMuscles,
      secondary: exercise.secondaryMuscles,
      met: exercise.met,
    });
  }

  const packed: Packed = {
    v: 1,
    n: plan.name,
    d: plan.description || undefined,
    c: plan.cycle
      ? {
          w: plan.cycle.weeks,
          dw: plan.cycle.deloadWeek,
          sp: plan.cycle.stepPct,
          dp: plan.cycle.deloadPct,
        }
      : undefined,
    days: plan.days.map((day) => ({
      t: day.title,
      x: day.isRestDay ? 1 : undefined,
      l: day.exercises.map((item) => ({
        e: item.exerciseId,
        s: item.targetSets,
        a: item.targetRepsMin,
        b: item.targetRepsMax,
        w: item.targetWeightKg,
        r: item.restSec,
        p: item.progressionKg ?? undefined,
        g: item.groupId,
        n: item.note,
      })),
    })),
    custom,
  };

  return PREFIX + toBase64(JSON.stringify(packed));
}

export interface DecodedPlan {
  name: string;
  description?: string;
  days: PlanDay[];
  cycleWeeks: number | null;
  cycle: Packed['c'];
  custom: PackedCustom[];
  /** Wie viele Uebungen der Empfaenger nicht kennt. */
  unknownCount: number;
}

/**
 * Liest einen Textbaustein wieder ein. Gibt null zurueck, wenn er nicht passt -
 * damit ein versehentlich kopierter Absatz keine Fehlermeldung produziert.
 */
export function decodePlan(
  raw: string,
  knows: (id: string) => boolean,
  newId: () => string,
): DecodedPlan | null {
  const text = raw.trim();
  const start = text.indexOf(PREFIX);
  if (start < 0) return null;

  try {
    const code = text.slice(start + PREFIX.length).split(/\s/)[0];
    const packed = JSON.parse(fromBase64(code)) as Packed;
    if (packed.v !== 1 || !Array.isArray(packed.days) || packed.days.length !== 7) return null;

    const customIds = new Set(packed.custom?.map((item) => item.id) ?? []);
    let unknownCount = 0;

    const days: PlanDay[] = packed.days.map((day, index) => ({
      weekday: index as Weekday,
      title: typeof day.t === 'string' ? day.t : 'Ruhetag',
      isRestDay: day.x === 1,
      exercises: (day.l ?? []).map((item): PlanExercise => {
        if (!knows(item.e) && !customIds.has(item.e)) unknownCount += 1;
        return {
          id: newId(),
          exerciseId: item.e,
          groupId: item.g,
          targetSets: Math.max(1, Math.min(20, item.s || 3)),
          targetRepsMin: item.a ?? null,
          targetRepsMax: item.b ?? null,
          targetWeightKg: item.w ?? null,
          restSec: item.r ?? null,
          progressionKg: item.p ?? null,
          note: item.n,
        };
      }),
    }));

    return {
      name: packed.n || 'Geteilter Plan',
      description: packed.d,
      days,
      cycleWeeks: packed.c?.w ?? null,
      cycle: packed.c,
      custom: packed.custom ?? [],
      unknownCount,
    };
  } catch {
    return null;
  }
}

/** Baut aus den mitgereisten Angaben wieder eigene Uebungen. */
export function customToExercises(custom: PackedCustom[]): Exercise[] {
  return custom.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category as Exercise['category'],
    kind: item.kind as Exercise['kind'],
    primaryMuscles: item.primary ?? [],
    secondaryMuscles: item.secondary ?? [],
    equipment: item.equipment ?? [],
    met: item.met || 5,
    source: 'custom',
    createdAt: new Date().toISOString(),
  }));
}

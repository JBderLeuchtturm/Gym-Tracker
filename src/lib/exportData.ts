import type { AppState, Exercise, Plan, PlanExercise } from '../types';
import { WEEKDAY_NAMES, formatDateShort } from './date';
import { countsAsWork, exerciseVolume, workoutSetCount, workoutVolume } from './stats';

/**
 * Ausgabe fuer andere Programme und fuers Archiv.
 *
 * CSV ist bewusst schlicht gehalten: eine Zeile je Satz, damit sich in einer
 * Tabellenkalkulation alles Weitere selbst bauen laesst. Fuer den Ausdruck
 * gibt es eine eigene Seite, die der Browser als PDF speichern kann - ein
 * eigener PDF-Erzeuger waere ein halbes Megabyte Programmcode fuer etwas,
 * das jeder Browser schon kann.
 */

/** Maskiert ein Feld nach RFC 4180. */
function cell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Eine Zeile je Satz - die vollstaendigen Rohdaten. */
export function workoutsToCsv(
  state: AppState,
  getExercise: (id: string) => Exercise | undefined,
): string {
  const header = [
    'Datum', 'Training', 'Übung', 'Kategorie', 'Satz', 'Art',
    'Gewicht (kg)', 'Wiederholungen', 'Dauer (s)', 'Distanz (km)', 'RPE',
    'Volumen (kg)', 'Notiz',
  ];

  const lines = [header.join(';')];

  for (const workout of [...state.workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const logged of workout.exercises) {
      const exercise = getExercise(logged.exerciseId);
      let index = 0;
      for (const set of logged.sets) {
        if (!set.done) continue;
        index += 1;
        const kind = set.forPartner ? 'Partner' : set.isWarmup ? 'Aufwärmen' : 'Arbeitssatz';
        const volume = countsAsWork(set) ? (set.weightKg ?? 0) * (set.reps ?? 0) : 0;
        lines.push([
          workout.date,
          workout.title,
          exercise?.name ?? logged.exerciseId,
          exercise?.category ?? '',
          index,
          kind,
          set.weightKg ?? '',
          set.reps ?? '',
          set.durationSec ?? '',
          set.distanceKm ?? '',
          set.rpe ?? '',
          volume > 0 ? Math.round(volume) : '',
          set.note ?? logged.note ?? '',
        ].map(cell).join(';'));
      }
    }
  }

  return lines.join('\n');
}

/** Eine Zeile je Trainingstag - fuer den schnellen Ueberblick. */
export function summaryToCsv(state: AppState): string {
  const header = ['Datum', 'Training', 'Sätze', 'Volumen (kg)', 'Dauer (min)', 'Körpergewicht (kg)', 'Notiz'];
  const lines = [header.join(';')];

  for (const workout of [...state.workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    const sets = workoutSetCount(workout);
    if (sets === 0) continue;
    lines.push([
      workout.date,
      workout.title,
      sets,
      Math.round(workoutVolume(workout)),
      workout.durationMin ?? '',
      workout.bodyWeightKg ?? '',
      workout.notes ?? '',
    ].map(cell).join(';'));
  }

  return lines.join('\n');
}

/** Koerpergewicht und Umfaenge. */
export function bodyToCsv(state: AppState): string {
  const header = ['Datum', 'Gewicht (kg)', 'Hals', 'Brust', 'Oberarm', 'Taille', 'Hüfte', 'Oberschenkel', 'Wade'];
  const lines = [header.join(';')];

  const dates = new Set<string>([
    ...state.weightLog.map((entry) => entry.date),
    ...(state.measurements ?? []).map((entry) => entry.date),
  ]);

  for (const date of [...dates].sort()) {
    const weight = state.weightLog.find((entry) => entry.date === date);
    const measure = (state.measurements ?? []).find((entry) => entry.date === date);
    lines.push([
      date,
      weight?.kg ?? '',
      measure?.neckCm ?? '',
      measure?.chestCm ?? '',
      measure?.armCm ?? '',
      measure?.waistCm ?? '',
      measure?.hipCm ?? '',
      measure?.thighCm ?? '',
      measure?.calfCm ?? '',
    ].map(cell).join(';'));
  }

  return lines.join('\n');
}

/** Laedt einen Text als Datei herunter. */
export function downloadText(filename: string, content: string, mime = 'text/csv'): void {
  // Byte Order Mark, damit Excel die Umlaute richtig liest.
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' : '', content], {
    type: `${mime};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ReportInput {
  title: string;
  rangeLabel: string;
  stats: Array<{ label: string; value: string }>;
  sections: Array<{ heading: string; rows: Array<[string, string]> }>;
}

/**
 * Baut eine schlichte Seite zum Ausdrucken. Der Browser macht daraus per
 * "Als PDF speichern" ein PDF - ohne zusaetzliche Bibliothek.
 */
export function printReport(report: ReportInput): void {
  const escape = (value: string) => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${escape(report.title)}</title>
<style>
  body { font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #16181d; margin: 28px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #6b7280; margin-bottom: 20px; }
  .stats { display: flex; flex-wrap: wrap; gap: 18px; margin-bottom: 22px; }
  .stat { min-width: 110px; }
  .stat b { display: block; font-size: 19px; }
  .stat span { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  h2 { font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid #d6d9e0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  td:last-child { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr:nth-child(even) { background: #f6f7f9; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<h1>${escape(report.title)}</h1>
<div class="sub">${escape(report.rangeLabel)} · ${escape(formatDateShort(new Date().toISOString().slice(0, 10)))}</div>
<div class="stats">${report.stats.map((stat) => (
    `<div class="stat"><b>${escape(stat.value)}</b><span>${escape(stat.label)}</span></div>`
  )).join('')}</div>
${report.sections.map((section) => (
    `<h2>${escape(section.heading)}</h2><table>${section.rows.map(([left, right]) => (
      `<tr><td>${escape(left)}</td><td>${escape(right)}</td></tr>`
    )).join('')}</table>`
  )).join('')}
</body></html>`;

  openPrintWindow(html);
}

/* ------------------------------------------------------- Plan zum Ausdrucken */

/**
 * Der Wochenplan auf Papier.
 *
 * Ein Zettel in der Sporttasche braucht kein Netz, keinen Akku und keine
 * feuchten Finger auf dem Glas. Bewusst als Tabelle mit leeren Feldern zum
 * Eintragen - so ist der Ausdruck nicht nur zum Nachlesen, sondern auch zum
 * Mitschreiben zu gebrauchen.
 */
export function printPlan(
  plan: Plan,
  nameOf: (id: string) => string,
  options: { blankColumns: number } = { blankColumns: 4 },
): void {
  const escape = (value: string) => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const target = (exercise: PlanExercise): string => {
    const reps = exercise.targetRepsMin && exercise.targetRepsMax
      && exercise.targetRepsMin !== exercise.targetRepsMax
      ? `${exercise.targetRepsMin}–${exercise.targetRepsMax}`
      : String(exercise.targetRepsMin ?? '');
    const weight = exercise.targetWeightKg ? ` @ ${exercise.targetWeightKg} kg` : '';
    return `${exercise.targetSets} × ${reps || '?'}${weight}`;
  };

  const days = plan.days
    .map((day, index) => ({ day, index }))
    .filter((entry) => !entry.day.isRestDay && entry.day.exercises.length > 0);

  const blanks = Array.from({ length: Math.max(0, options.blankColumns) }, () => '<td class="blank"></td>').join('');
  const blankHeads = Array.from({ length: Math.max(0, options.blankColumns) }, (_, index) => (
    `<th class="blank">${index + 1}</th>`
  )).join('');

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${escape(plan.name)}</title>
<style>
  body { font: 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #16181d; margin: 24px; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  .sub { color: #6b7280; margin-bottom: 18px; font-size: 11px; }
  h2 { font-size: 13px; margin: 18px 0 5px; border-bottom: 1px solid #c9ccd4; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em;
       color: #6b7280; font-weight: 600; padding: 2px 4px; border-bottom: 1px solid #d6d9e0; }
  td { padding: 5px 4px; border-bottom: 1px solid #e6e8ec; vertical-align: top; }
  td.target { white-space: nowrap; color: #4b5563; font-variant-numeric: tabular-nums; }
  .blank { width: 34px; border-left: 1px solid #e6e8ec; }
  .note { color: #6b7280; font-size: 10px; }
  /* Ein Trainingstag soll nicht ueber zwei Seiten reissen. */
  section { break-inside: avoid; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<h1>${escape(plan.name)}</h1>
<div class="sub">${escape(plan.description ?? '')}${plan.description ? ' · ' : ''}Ausgedruckt am ${escape(formatDateShort(new Date().toISOString().slice(0, 10)))}</div>
${days.map(({ day, index }) => `
<section>
  <h2>${escape(WEEKDAY_NAMES[index])} · ${escape(day.title || '')}</h2>
  <table>
    <thead><tr><th>Übung</th><th>Ziel</th>${blankHeads}</tr></thead>
    <tbody>
      ${day.exercises.map((exercise) => `
        <tr>
          <td>${escape(nameOf(exercise.exerciseId))}${
            exercise.note ? `<div class="note">${escape(exercise.note)}</div>` : ''
          }</td>
          <td class="target">${escape(target(exercise))}</td>
          ${blanks}
        </tr>`).join('')}
    </tbody>
  </table>
</section>`).join('')}
</body></html>`;

  openPrintWindow(html);
}

/**
 * Druckt ein fertiges HTML-Dokument ueber einen unsichtbaren Rahmen.
 * Ein neues Fenster waere der naheliegende Weg, wird auf dem Handy aber
 * regelmaessig als Werbung weggeblockt.
 */
function openPrintWindow(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();

  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
}

/** Nur zur Vollstaendigkeit: Volumen einer Uebung im Training. */
export const loggedVolume = exerciseVolume;

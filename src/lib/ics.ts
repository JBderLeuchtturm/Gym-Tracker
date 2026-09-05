/**
 * Trainingstage als Kalenderdatei.
 *
 * Warum so und nicht als Push-Erinnerung: Eine Web-App kann sich nicht selbst
 * zu einer bestimmten Uhrzeit wecken. Alles, was ohne fremden Server ginge,
 * setzt voraus, dass die App gerade offen ist - und dann braucht man keine
 * Erinnerung mehr. Der Kalender des Telefons kann genau das, seit Jahren,
 * zuverlaessig und ohne dass irgendwo Daten liegen bleiben.
 *
 * Erzeugt wird iCalendar nach RFC 5545: eine Serie je Trainingstag, mit einer
 * Voranmeldung zur gewuenschten Uhrzeit.
 */

import type { Plan } from '../types';
import { WEEKDAY_NAMES } from './date';

/** Kuerzel der Wochentage, wie iCalendar sie erwartet (Montag zuerst). */
const ICAL_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/**
 * Zeilen duerfen nach RFC 5545 hoechstens 75 Oktette lang sein; laengere
 * werden umgebrochen und mit einem Leerzeichen fortgesetzt.
 */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

/** Sonderzeichen, die in iCalendar-Werten maskiert werden muessen. */
const escape = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

const pad = (value: number): string => String(value).padStart(2, '0');

/** Naechstes Vorkommen eines Wochentags, ab heute gerechnet. */
function nextOccurrence(weekday: number, hour: number, minute: number): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  // getDay(): 0 = Sonntag. Intern ist 0 = Montag.
  const todayIndex = (start.getDay() + 6) % 7;
  let ahead = (weekday - todayIndex + 7) % 7;
  if (ahead === 0 && start.getTime() <= now.getTime()) ahead = 7;
  start.setDate(start.getDate() + ahead);
  return start;
}

const localStamp = (date: Date): string =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  + `T${pad(date.getHours())}${pad(date.getMinutes())}00`;

const utcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
  + `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

export interface CalendarOptions {
  /** Uhrzeit des Termins, "HH:MM". */
  time: string;
  /** Dauer in Minuten. */
  durationMin: number;
  /** Voranmeldung in Minuten vor dem Termin. 0 = puenktlich. */
  alarmMin: number;
}

/**
 * Baut die Kalenderdatei zu einem Plan: je Trainingstag eine woechentliche
 * Serie. Ruhetage bekommen keinen Termin - ein Kalendereintrag "heute nichts"
 * waere Laerm.
 */
export function planToIcs(plan: Plan, options: CalendarOptions): string {
  const [hourText, minuteText] = options.time.split(':');
  const hour = Number(hourText) || 17;
  const minute = Number(minuteText) || 0;
  const stamp = utcStamp(new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gym-Tracker//Trainingsplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(plan.name)}`,
  ];

  plan.days.forEach((day, index) => {
    if (day.isRestDay || day.exercises.length === 0) return;

    const start = nextOccurrence(index, hour, minute);
    const end = new Date(start.getTime() + options.durationMin * 60000);
    const summary = day.title?.trim() || WEEKDAY_NAMES[index];

    lines.push(
      'BEGIN:VEVENT',
      `UID:${plan.id}-${index}@gym-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localStamp(start)}`,
      `DTEND:${localStamp(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICAL_DAYS[index]}`,
      fold(`SUMMARY:${escape(summary)}`),
      fold(`DESCRIPTION:${escape(
        `${day.exercises.length} Übungen · aus ${plan.name}`,
      )}`),
      'TRANSP:OPAQUE',
    );

    if (options.alarmMin > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        fold(`DESCRIPTION:${escape(summary)}`),
        `TRIGGER:-PT${options.alarmMin}M`,
        'END:VALARM',
      );
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export const icsFileName = (plan: Plan): string =>
  `${plan.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'trainingsplan'}.ics`;

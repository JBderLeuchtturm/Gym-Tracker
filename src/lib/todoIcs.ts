import type { Todo } from '../types';
import { escape, fold, localStamp, utcStamp } from './ics';
import { dueAt } from './todos';

/**
 * Aufgaben mit Uhrzeit als Kalenderdatei.
 *
 * Aus demselben Grund wie beim Trainingsplan: Eine Web-App kann sich nicht
 * selbst wecken, solange sie zu ist. Die Erinnerung in der App greift, sobald
 * man sie oeffnet - der Kalender des Telefons greift auch dann, wenn man es
 * nicht tut. Beides zusammen ist ehrlicher als ein Versprechen, das nur
 * manchmal gehalten wird.
 *
 * Aufgenommen wird nur, was einen Zeitpunkt hat: Ein ganztaegiger Eintrag
 * "irgendwann diese Woche" ist im Kalender kein Termin, sondern Laerm.
 */
export function todosToIcs(todos: Todo[], durationMin = 30): string {
  const stamp = utcStamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gym-Tracker//Aufgaben//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Gym-Tracker Aufgaben',
  ];

  for (const todo of todos) {
    if (todo.done) continue;
    const start = dueAt(todo);
    if (!start) continue;
    const end = new Date(start.getTime() + durationMin * 60000);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${todo.id}@gym-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localStamp(start)}`,
      `DTEND:${localStamp(end)}`,
      fold(`SUMMARY:${escape(todo.title || 'Aufgabe')}`),
      'TRANSP:TRANSPARENT',
    );

    const description = [todo.note.trim(), ...todo.steps.map((step) => `• ${step.text}`)]
      .filter(Boolean).join('\n');
    if (description) lines.push(fold(`DESCRIPTION:${escape(description)}`));
    if (todo.place.trim()) lines.push(fold(`LOCATION:${escape(todo.place.trim())}`));

    /*
     * Die Wiederholung wandert mit, soweit iCalendar sie kennt. "Alle drei
     * Wochen" kann es, "alle drei Wochen ausser im Urlaub" nicht - dafuer
     * bleibt die App zustaendig.
     */
    if (todo.repeat) {
      const freq = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }[todo.repeat.every];
      lines.push(`RRULE:FREQ=${freq}${todo.repeat.interval > 1 ? `;INTERVAL=${todo.repeat.interval}` : ''}`);
    }

    if (todo.remindMin != null) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        fold(`DESCRIPTION:${escape(todo.title || 'Aufgabe')}`),
        `TRIGGER:-PT${Math.max(0, todo.remindMin)}M`,
        'END:VALARM',
      );
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

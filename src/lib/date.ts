import { currentLanguage } from '../i18n';
/** Datums-Helfer. Intern wird ueberall das Format yyyy-mm-dd verwendet. */

export const toISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayISO = (): string => toISODate(new Date());

export const parseISODate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

export const addDays = (iso: string, days: number): string => {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

/** 0 = Montag ... 6 = Sonntag */
export const weekdayOf = (iso: string): number => (parseISODate(iso).getDay() + 6) % 7;

export const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/** Das Gebietsschema fuer Datums- und Zahlenformate folgt der Sprachwahl. */
export const locale = (): string => (currentLanguage() === 'en' ? 'en-GB' : 'de-DE');
export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const formatDateLong = (iso: string): string =>
  parseISODate(iso).toLocaleDateString(locale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export const formatDateShort = (iso: string): string =>
  parseISODate(iso).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: '2-digit' });

export const formatDateTiny = (iso: string): string =>
  parseISODate(iso).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' });

export function relativeDayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Heute';
  if (iso === addDays(today, -1)) return 'Gestern';
  if (iso === addDays(today, 1)) return 'Morgen';
  return formatDateLong(iso);
}

/** Montag der Woche, in der das Datum liegt. */
export const startOfWeek = (iso: string): string => addDays(iso, -weekdayOf(iso));

/** Ganze Tage zwischen zwei Datumsangaben (spaeter minus frueher). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86400000);

/** ISO-Kalenderwochen-Schluessel wie "2026-KW12" - fuer Gruppierungen. */
export function weekKey(iso: string): string {
  const date = parseISODate(iso);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  const week = 1 + Math.round((diff / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-KW${`${week}`.padStart(2, '0')}`;
}

export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const born = parseISODate(birthDate);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export const formatDuration = (minutes: number): string => {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
};

export const formatClock = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${`${safe % 60}`.padStart(2, '0')}`;
};

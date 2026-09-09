/**
 * Die Abend-Erinnerung und der Wochenrückblick als echte Push-Nachricht.
 *
 * Bisher gab es dafür nur ein Banner in der App - das sieht nur, wer sie an
 * dem Tag ohnehin schon offen hat, und genau dann ist eine Erinnerung
 * überflüssig. Diese Funktion läuft stattdessen stündlich per Cron (siehe
 * "Erinnerung und Wochenrückblick" unten in schema.sql) und schickt selbst
 * einen Anstupser, wenn es so weit ist - unabhängig davon, ob die App gerade
 * offen ist.
 *
 * Bewusst kein Aufruf mit dem Konto einer einzelnen Person: Der Cron-Job
 * kennt kein Konto, er ruft einmal pro Stunde für alle auf. Autorisiert wird
 * deshalb über den Service-Role-Schlüssel selbst als Shared Secret, nicht
 * über ein Nutzer-Token.
 *
 * Ohne Nutzlast wie bei "notify-friends": Der Push meldet nur "sieh nach",
 * nie wieso. Was zu tun ist, holt sich die App beim Öffnen selbst.
 *
 * Einrichtung (einmalig):
 *   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:du@example.com
 *   supabase functions deploy daily-nudge --no-verify-jwt
 *   -- dann den stündlichen Aufruf in schema.sql einrichten (siehe dort)
 */

import {
  cleanupGone, json, loadVapidConfig, pushOnce, restClient, CORS,
} from '../_shared/push.ts';

/* ------------------------------------------------------------- Ortszeit */

/** Lokales Datum (YYYY-MM-DD), Stunde (0-23) und Wochentag (0=Montag) in "tz". */
function localParts(tz: string): { date: string; hour: number; weekday: number } {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: 'numeric', hourCycle: 'h23',
  }).format(now));
  const shortDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
  // Montag = 0 ... Sonntag = 6, wie im Client (siehe src/lib/date.ts).
  const weekday = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[shortDay] ?? 0;
  return { date, hour, weekday };
}

/** Montag der Woche, in der "dateStr" liegt - als stabiler Wochenschlüssel. */
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d.toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- Zustand */

interface PlanDayLike { weekday: number; isRestDay: boolean; exercises?: unknown[] }
interface PlanLike { id: string; days?: PlanDayLike[] }
interface SetLike { done?: boolean }
interface LoggedExerciseLike { sets?: SetLike[] }
interface WorkoutLike { date: string; exercises?: LoggedExerciseLike[] }
interface StateLike {
  activePlanId?: string | null;
  plans?: PlanLike[];
  workouts?: WorkoutLike[];
  settings?: {
    reminder?: { enabled?: boolean; time?: string };
    timezone?: string;
  };
}

const hasLoggedSets = (workouts: WorkoutLike[] | undefined, date: string): boolean =>
  (workouts ?? []).some((workout) => workout.date === date
    && (workout.exercises ?? []).some((exercise) => (exercise.sets ?? []).some((set) => set.done)));

/** Ob laut aktivem Plan an diesem Wochentag trainiert wird. */
function isTrainingDay(state: StateLike, weekday: number): boolean {
  const plan = (state.plans ?? []).find((item) => item.id === state.activePlanId);
  const day = plan?.days?.[weekday];
  return Boolean(day && !day.isRestDay && (day.exercises?.length ?? 0) > 0);
}

/* -------------------------------------------------------------- Hauptteil */

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Nur POST' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Projekt nicht konfiguriert' }, 500);

  // Shared Secret statt Nutzer-Token: Der Cron-Job handelt fuer niemand
  // Bestimmtes, sondern fuer alle - ein einzelnes Konto-Token gaebe es hier
  // gar nicht sinnvoll.
  const auth = request.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${serviceKey}`) return json({ error: 'Nicht autorisiert' }, 401);

  const vapid = await loadVapidConfig();
  if (!vapid) return json({ error: 'VAPID-Schlüssel fehlen' }, 500);

  const rest = restClient(supabaseUrl, serviceKey);

  const statesResponse = await rest.get('user_state?select=user_id,data');
  if (!statesResponse.ok) return json({ error: 'Zustand nicht lesbar' }, 500);
  const states = await statesResponse.json() as Array<{ user_id: string; data: StateLike }>;

  let reminders = 0;
  let digests = 0;
  const gone: string[] = [];

  /*
   * Erinnerung und Wochenrueckblick sind unabhaengig voneinander faellig -
   * an einem Sonntagabend, an dem beides zutrifft, sollen auch beide raus,
   * nicht nur eine der beiden (vorher stand hier ein "kind = dueReminder ?
   * ... : ..." - das liess die Erinnerung die Woche ueber jede Stunde
   * gewinnen, und der Rueckblick kam nie an die Reihe).
   */
  async function maybeSend(
    userId: string, kind: 'reminder' | 'digest', sentOn: string,
  ): Promise<void> {
    const already = await rest.get(
      `push_log?select=user_id&user_id=eq.${userId}&kind=eq.${kind}&sent_on=eq.${sentOn}`,
    );
    if (already.ok && (await already.json() as unknown[]).length > 0) return;

    const subsResponse = await rest.get(`push_subscriptions?select=endpoint&user_id=eq.${userId}`);
    if (!subsResponse.ok) return;
    const subs = await subsResponse.json() as Array<{ endpoint: string }>;
    if (subs.length === 0) return;

    let anySent = false;
    await Promise.all(subs.map(async ({ endpoint }) => {
      const outcome = await pushOnce(endpoint, vapid);
      if (outcome === 'sent') anySent = true;
      else if (outcome === 'gone') gone.push(endpoint);
    }));
    if (!anySent) return;

    if (kind === 'reminder') reminders += 1; else digests += 1;
    await rest.post(
      'push_log',
      { user_id: userId, kind, sent_on: sentOn },
      { Prefer: 'resolution=ignore-duplicates' },
    );
  }

  await Promise.all(states.map(async ({ user_id: userId, data: state }) => {
    const tz = state.settings?.timezone;
    if (!tz) return; // Alte Geraete ohne Zeitzone: lieber nichts schicken als zur falschen Stunde.
    const { date, hour, weekday } = localParts(tz);

    const dueReminder = Boolean(state.settings?.reminder?.enabled)
      && hour >= Number((state.settings?.reminder?.time ?? '17:00').split(':')[0] || 17)
      && isTrainingDay(state, weekday)
      && !hasLoggedSets(state.workouts, date);

    // Sonntagabend, ab 18 Uhr Ortszeit, nur wenn diese Woche ueberhaupt
    // etwas stand - ein Rueckblick auf eine leere Woche waere kein Anreiz,
    // sondern nur eine Erinnerung an eine Luecke.
    const week = mondayOf(date);
    const trainedThisWeek = (state.workouts ?? []).some(
      (workout) => workout.date >= week && hasLoggedSets(state.workouts, workout.date),
    );
    const dueDigest = weekday === 6 && hour >= 18 && trainedThisWeek;

    if (dueReminder) await maybeSend(userId, 'reminder', date);
    if (dueDigest) await maybeSend(userId, 'digest', week);
  }));

  await cleanupGone(rest, gone);

  return json({ reminders, digests, cleaned: gone.length, checked: states.length });
});

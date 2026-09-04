import { t } from '../i18n';
/**
 * Benachrichtigungen, wenn ein Freund trainiert hat.
 *
 * Bewusst ohne Server: Der Browser meldet sich, sobald die App beim Abgleich
 * ein neues Training bei einem Freund entdeckt. Das erreicht einen, solange
 * die App offen ist - auch in einem Hintergrund-Tab.
 *
 * Echte Push-Nachrichten bei geschlossener App braeuchten zusaetzlich einen
 * Dienst, der sie verschickt; siehe README.
 */

const SEEN_KEY = 'gym-tracker:seen-activity';

type SeenMap = Record<string, string>;

function readSeen(): SeenMap {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as SeenMap;
  } catch {
    return {};
  }
}

function writeSeen(map: SeenMap): void {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(map)); } catch { /* egal */ }
}

export const notificationsSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export interface FriendActivity {
  userId: string;
  name: string;
  emoji: string;
  date: string;
  title: string;
  sets: number;
}

/**
 * Meldet neue Trainings von Freunden und merkt sich, was schon gezeigt wurde.
 * Beim allerersten Durchlauf wird nur gemerkt, nicht gemeldet - sonst
 * prasselt beim ersten Anmelden die ganze Historie herein.
 */
export function announceNewActivity(activities: FriendActivity[]): FriendActivity[] {
  const seen = readSeen();
  const firstRun = Object.keys(seen).length === 0;
  const fresh: FriendActivity[] = [];

  for (const activity of activities) {
    const known = seen[activity.userId];
    if (!known || activity.date > known) {
      if (!firstRun && known) fresh.push(activity);
      seen[activity.userId] = activity.date;
    }
  }
  writeSeen(seen);

  if (fresh.length > 0 && notificationPermission() === 'granted') {
    for (const activity of fresh.slice(0, 3)) {
      try {
        new Notification(
          `${activity.emoji} ${t('{name} hat trainiert', { name: activity.name })}`, {
          body: `${activity.title} · ${t('{count} Sätze', { count: activity.sets })}`,
          tag: `gym-${activity.userId}-${activity.date}`,
        });
      } catch {
        // Manche Browser erlauben das nur aus einem Service Worker heraus.
      }
    }
  }

  return fresh;
}

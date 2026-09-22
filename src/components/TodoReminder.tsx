import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { useStore } from '../storage/store';
import { todayISO } from '../lib/date';
import { dueReminders } from '../lib/todos';
import { IconBell } from './icons';

/**
 * Erinnerung an eine Aufgabe mit Uhrzeit.
 *
 * Was eine Web-App hier kann und was nicht, steht in types.ts an `remindMin`:
 * Sie kann sich nicht selbst wecken, solange sie zu ist. Was sie kann, ist
 * beim Oeffnen daran erinnern - und wenn sie offen ist, auch zur Minute.
 * Deshalb zwei Wege gleichzeitig: ein Band oben in der App, und, sofern der
 * Nutzer das erlaubt hat, eine Meldung des Systems.
 *
 * Bewusst je Aufgabe einmal am Tag (`remindedOn`): Eine Erinnerung, die alle
 * dreissig Sekunden wiederkommt, ist keine Erinnerung, sondern ein Wecker
 * ohne Schlummertaste.
 */
export function TodoReminder({ onOpen }: { onOpen: () => void }) {
  const { state, updateTodo } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string[]>([]);

  /* Einmal die Minute reicht - genauer wird eine Erinnerung nicht abgelesen. */
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const due = dueReminders(state.todos, new Date(now))
    .filter((todo) => !dismissed.includes(todo.id));
  const first = due[0];

  /*
   * Die Systemmeldung geht raus, sobald eine Aufgabe faellig wird - und nur
   * dann, wenn der Nutzer sie ausdruecklich erlaubt hat. Ohne Erlaubnis
   * bleibt es beim Band; danach zu fragen ist Sache der Aufgabenseite.
   */
  useEffect(() => {
    if (!first) return;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(first.title || t('Aufgabe'), {
          body: first.dueTime ? t('Fällig um {time} Uhr', { time: first.dueTime }) : undefined,
          tag: first.id,
        });
      }
    } catch {
      /* Manche Browser werfen hier im eingebetteten Zustand - dann eben nicht. */
    }
  }, [first?.id]);

  if (!first) return null;

  const close = () => {
    updateTodo(first.id, { remindedOn: todayISO() });
    setDismissed((value) => [...value, first.id]);
  };

  return (
    <div className="update-banner" role="status">
      <IconBell style={{ width: 18, height: 18, color: 'var(--warn)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bold small">{first.title || t('Aufgabe')}</div>
        <div className="tiny" style={{ opacity: 0.85 }}>
          {first.dueTime
            ? t('Fällig um {time} Uhr', { time: first.dueTime })
            : t('Jetzt fällig')}
          {due.length > 1 && ` · ${t('und {count} weitere', { count: due.length - 1 })}`}
        </div>
      </div>
      <button className="btn btn--sm" onClick={() => { onOpen(); close(); }}>{t('Ansehen')}</button>
      <button className="btn btn--sm btn--ghost" onClick={close}>{t('Später')}</button>
    </div>
  );
}

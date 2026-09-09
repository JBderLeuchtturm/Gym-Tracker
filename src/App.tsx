import { t } from './i18n';
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useStore } from './storage/store';
import { TodayPage } from './pages/Today';

/*
 * Nur "Heute" wird mitgeliefert - das ist die Seite, auf der die App startet
 * und auf der man neun von zehn Mal bleibt. Alles andere kommt beim ersten
 * Antippen nach. Das spart beim Start rund die Haelfte des Programmcodes,
 * und die Diagramme, die den groessten Teil davon ausmachen, sieht man
 * ohnehin erst, wenn Daten da sind.
 */
const PlansPage = lazy(() => import('./pages/Plans').then((m) => ({ default: m.PlansPage })));
const ProgressPage = lazy(() => import('./pages/Progress').then((m) => ({ default: m.ProgressPage })));
const RankPage = lazy(() => import('./pages/Rank').then((m) => ({ default: m.RankPage })));
const ProfilePage = lazy(() => import('./pages/Profile').then((m) => ({ default: m.ProfilePage })));
const HistoryPage = lazy(() => import('./pages/History').then((m) => ({ default: m.HistoryPage })));
const FriendsPage = lazy(() => import('./pages/Friends').then((m) => ({ default: m.FriendsPage })));
import { useSync } from './sync/SyncProvider';
import { applyUpdate, onUpdateAvailable } from './lib/appUpdate';
import { workoutSetCount } from './lib/stats';
import { formatDateLong, todayISO, weekdayOf } from './lib/date';
import { PageSkeleton } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RankUpWatcher } from './components/RankUp';
import { IconCalendar, IconChart, IconDumbbell, IconTrophy, IconUser } from './components/icons';
import { IconUsers } from './components/icons';

type Tab = 'today' | 'plans' | 'progress' | 'rank' | 'friends' | 'profile';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'today', label: 'Heute', icon: <IconDumbbell /> },
  { id: 'plans', label: 'Pläne', icon: <IconCalendar /> },
  { id: 'progress', label: 'Fortschritt', icon: <IconChart /> },
  /*
   * Rang statt Kalorien: Die Kalorienseite traegt man einmal am Tag ein, den
   * Rang sieht man jedes Mal an. Sie liegt vollstaendig unter Profil, und der
   * Trainingsverbrauch - das Einzige, was man taeglich davon braucht - steht
   * unter dem Training selbst.
   */
  { id: 'rank', label: 'Rang', icon: <IconTrophy /> },
  { id: 'friends', label: 'Freunde', icon: <IconUsers /> },
  { id: 'profile', label: 'Profil', icon: <IconUser /> },
];

const TITLE_KEYS: Record<Tab, string> = {
  today: 'Training',
  plans: 'Wochenpläne',
  progress: 'Fortschritt',
  rank: 'Rang',
  friends: 'Freunde',
  profile: 'Profil',
};

const title = (tab: Tab): string => t(TITLE_KEYS[tab]);

export function App() {
  const { state } = useStore();
  const sync = useSync();

  const pendingRequests = sync.friends.filter((friend) => friend.state === 'incoming').length;
  // Wer über einen Einladungslink kommt, landet direkt bei den Freunden.
  const [tab, setTab] = useState<Tab>(() => (sync.pendingInvite ? 'friends' : 'today'));
  const [historyOpen, setHistoryOpen] = useState(false);
  /* Der scrollende Bereich - beim Reiterwechsel geht er zurueck nach oben. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [updateReady, setUpdateReady] = useState(false);
  /*
   * Traegt "app--boot" fuer die ersten paar hundert Millisekunden - nur
   * dann duerfen Listen gestaffelt einblenden (siehe ".app--boot .list > *"
   * in styles.css). Reiterwechsel danach unmounten und montieren zwar auch
   * React-Baeume neu, sehen davon aber nichts mehr: sofort da statt jedes
   * Mal erneut hochsteigend.
   */
  const [booting, setBooting] = useState(true);

  useEffect(() => onUpdateAvailable(setUpdateReady), []);
  useEffect(() => {
    const id = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(id);
  }, []);

  // Farbschema anwenden (dunkel, hell oder Systemvorgabe).
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const theme = state.settings.theme;
      if (theme === 'system') {
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        root.dataset.theme = prefersLight ? 'light' : 'dark';
      } else {
        root.dataset.theme = theme;
      }
    };
    apply();
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [state.settings.theme]);

  const activePlan = state.plans.find((plan) => plan.id === state.activePlanId);

  const workoutCount = state.workouts.filter((workout) => workoutSetCount(workout) > 0).length;
  const subtitle =
    tab === 'today' ? formatDateLong(todayISO())
      : tab === 'plans'
        ? activePlan ? t('Aktiv: {name}', { name: activePlan.name }) : t('Kein Plan aktiv')
        : tab === 'progress' && workoutCount > 0
          ? t('{count} Einheiten aufgezeichnet', { count: workoutCount })
          : tab === 'rank' ? t('Bronze bis Elite, je drei Divisionen')
            : null;

  return (
    <div className={`app ${booting ? 'app--boot' : ''}`}>
      {/* Erste Tabulatorstelle: an der Navigation vorbei direkt in den Inhalt. */}
      <a className="skip-link" href="#inhalt">{t('Zum Inhalt springen')}</a>

      <header className="topbar">
        <div className="topbar__title">
          {/*
            * Der Titel benennt die Sache, nicht die Person - ein Trainingsbuch
            * begruesst einen nicht. Wo man steht, sagt die Zeile darunter.
            */}
          <h1>{title(tab)}</h1>
          {/*
            * Die Unterzeile stand frueher auf jeder Seite und wiederholte dort
            * nur die Ueberschrift. Jetzt erscheint sie nur, wo sie etwas sagt.
            */}
          {subtitle && <div className="topbar__sub">{subtitle}</div>}
        </div>
        {(tab === 'today' || tab === 'progress') && (
          <button className="btn btn--sm" onClick={() => setHistoryOpen(true)}>{t("Verlauf")}</button>
        )}
      </header>

      <nav className="nav" aria-label={t("Hauptnavigation")}>
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`nav__item ${tab === item.id ? 'nav__item--active' : ''}`}
            onClick={() => { setTab(item.id); setHistoryOpen(false); scrollRef.current?.scrollTo({ top: 0 }); }}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            <span className="nav__icon">
              {item.icon}
              {item.id === 'friends' && pendingRequests > 0 && (
                <span className="nav__badge" aria-label={t('{count} offene Anfragen', { count: pendingRequests })}>
                  {pendingRequests}
                </span>
              )}
            </span>
            <span>{t(item.label)}</span>
          </button>
        ))}
      </nav>

      {/*
        * Der einzige Bereich, der scrollt. Kopfzeile und Reiter stehen
        * ausserhalb und koennen deshalb nicht wegrutschen.
        */}
      <div className="app__scroll" ref={scrollRef}>
      {/*
        * Auf- und Abstieg melden - unabhaengig davon, auf welcher Seite man
        * gerade steht. Wer beim Eintragen eine Stufe knackt, sieht es sofort.
        */}
      <RankUpWatcher />

      <TrainingReminder onOpen={() => { setTab('today'); setHistoryOpen(false); }} />

      {updateReady && (
        <div className="update-banner" role="status">
                    <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">{t('Neue Version verfügbar')}</div>
            <div className="tiny" style={{ opacity: 0.85 }}>{t('Einmal neu laden, dann ist sie da.')}</div>
          </div>
          <button className="btn btn--sm" onClick={applyUpdate}>{t('Jetzt laden')}</button>
        </div>
      )}

      {/*
        * Training und Auswertung stellen auf breiten Fenstern zwei Spalten
        * nebeneinander und duerfen dafuer breiter sein. Alles andere bleibt
        * auf Lesebreite.
        */}
      <main
        className={`page ${!historyOpen && (tab === 'today' || tab === 'progress') ? 'page--split' : ''}`}
        id="inhalt"
        tabIndex={-1}
      >
        {/*
          * Ein Fehler in einer Seite nimmt sonst die ganze App mit - im Studio
          * ein weisser Bildschirm. Der Fehlerabfang faengt ihn je Seite ab und
          * setzt sich beim naechsten Reiterwechsel von selbst zurueck.
          */}
        <ErrorBoundary resetKey={historyOpen ? 'history' : tab}>
          <Suspense fallback={<PageSkeleton />}>
            {historyOpen ? (
              <>
                <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setHistoryOpen(false)}>
                  ← Zurück
                </button>
                <HistoryPage />
              </>
            ) : (
              <>
                {tab === 'today' && <TodayPage onNavigate={setTab} />}
                {tab === 'plans' && <PlansPage />}
                {tab === 'progress' && <ProgressPage />}
                {tab === 'rank' && <RankPage />}
                {tab === 'friends' && <FriendsPage />}
                {tab === 'profile' && <ProfilePage />}
              </>
            )}
          </Suspense>
        </ErrorBoundary>
      </main>
      </div>
    </div>
  );
}

/**
 * Hinweis an einem Trainingstag, an dem noch nichts eingetragen ist.
 *
 * Bewusst kein Versprechen von mehr: Eine Web-App kann sich nicht selbst zu
 * einer Uhrzeit wecken, solange sie geschlossen ist. Was sie kann, ist beim
 * Oeffnen daran erinnern - und dafuer, dass man auch ohne offene App erinnert
 * wird, gibt es im Profil den Kalender-Export.
 *
 * Einmal am Tag, ab der eingestellten Uhrzeit, und nur wenn wirklich noch
 * nichts steht.
 */
function TrainingReminder({ onOpen }: { onOpen: () => void }) {
  const { state, updateSettings } = useStore();
  const [dismissed, setDismissed] = useState(false);
  const reminder = state.settings.reminder;
  const today = todayISO();

  const due = (() => {
    if (!reminder.enabled || dismissed) return null;
    if (reminder.lastShownOn === today) return null;

    const plan = state.plans.find((item) => item.id === state.activePlanId);
    const day = plan?.days[weekdayOf(today)];
    if (!day || day.isRestDay || day.exercises.length === 0) return null;

    const [hour, minute] = reminder.time.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < (hour || 0) * 60 + (minute || 0)) return null;

    const workout = state.workouts.find((item) => item.date === today);
    if (workout && workoutSetCount(workout) > 0) return null;

    return day.title || t('Trainingstag');
  })();

  if (!due) return null;

  const close = () => {
    setDismissed(true);
    updateSettings({ reminder: { ...state.settings.reminder, lastShownOn: today } });
  };

  return (
    <div className="update-banner" role="status">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bold small">{t('Heute steht an: {title}', { title: due })}</div>
        <div className="tiny" style={{ opacity: 0.85 }}>{t('Noch nichts eingetragen.')}</div>
      </div>
      <button className="btn btn--sm" onClick={() => { onOpen(); close(); }}>{t('Los')}</button>
      <button className="btn btn--sm btn--ghost" onClick={close}>{t('Später')}</button>
    </div>
  );
}

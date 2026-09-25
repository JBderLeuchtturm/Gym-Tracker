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
const TodosPage = lazy(() => import('./pages/Todos').then((m) => ({ default: m.TodosPage })));
import { useSync } from './sync/SyncProvider';
import { announceAppDownload, applyUpdate, onUpdateAvailable, pendingAppDownload } from './lib/appUpdate';
import { appBuild, isNativeApp } from './native/platform';
import { requestFocusView } from './lib/focusRequest';
import { workoutSetCount } from './lib/stats';
import { formatDateLong, todayISO, weekdayOf } from './lib/date';
import { PageSkeleton } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RankUpWatcher } from './components/RankUp';
import { Onboarding } from './components/Onboarding';
import { TodoReminder } from './components/TodoReminder';
import {
  IconCalendar, IconChart, IconChecklist, IconDumbbell, IconTrophy, IconUser, IconUsers,
} from './components/icons';
import { dueTodoCount } from './lib/todos';

type Tab = 'today' | 'plans' | 'todos' | 'progress' | 'rank' | 'friends' | 'profile';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'today', label: 'Heute', icon: <IconDumbbell /> },
  { id: 'plans', label: 'Pläne', icon: <IconCalendar /> },
  /*
   * Die Aufgaben stehen neben den Plaenen, nicht am Ende der Leiste: Beides
   * ist "was ich mir vorgenommen habe" - einmal fuer das Training, einmal
   * fuer alles andere.
   */
  { id: 'todos', label: 'To-dos', icon: <IconChecklist /> },
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
  todos: 'To-dos',
  progress: 'Fortschritt',
  rank: 'Rang',
  friends: 'Freunde',
  profile: 'Profil',
};

const title = (tab: Tab): string => t(TITLE_KEYS[tab]);

/** Wie oft die Android-App hoechstens nach einer neuen APK fragt. */
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;

export function App() {
  const { state, updateSettings, getExercise } = useStore();
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

  /*
   * Nur in der Android-App: Zurueck-Taste, Tipps auf Widgets und die Frage
   * nach einer neueren APK. Im Browser wird davon nichts geladen.
   */
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const historyRef = useRef(historyOpen);
  historyRef.current = historyOpen;
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    let active = true;
    void import('./native/native').then((native) => {
      if (!active) return;
      void native.initNative({
        onTarget: (target) => {
          setHistoryOpen(false);
          setTab(target === 'todos' ? 'todos' : 'today');
          scrollRef.current?.scrollTo({ top: 0 });
          if (target === 'focus') requestFocusView();
        },
        onBack: () => {
          if (historyRef.current) { setHistoryOpen(false); return true; }
          if (tabRef.current !== 'today') { setTab('today'); return true; }
          return false;
        },
      });
      let lastCheck = 0;
      const check = () => {
        if (Date.now() - lastCheck < UPDATE_CHECK_MS) return;
        lastCheck = Date.now();
        void native.checkForUpdate(appBuild()).then((info) => { if (info) announceAppDownload(info); });
      };
      check();
      native.onResume(check);
    });
    return () => { active = false; };
  }, []);

  /*
   * Widgets fuettern: Nach jeder Aenderung (kurz gebuendelt) bekommt der
   * Startbildschirm den neuen Stand - Satz abgehakt, Aufgabe erledigt, Ziel
   * geaendert. Auch die Sprache zaehlt, die Texte stehen fertig darin.
   */
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    const timer = window.setTimeout(() => {
      void Promise.all([import('./lib/widgetSnapshot'), import('./native/native')])
        .then(([snapshot, native]) => native.updateWidgets(
          JSON.stringify(snapshot.buildWidgetSnapshot(state, getExercise)),
        ))
        .catch(() => { /* Ohne Widgets laeuft die App genauso. */ });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, getExercise]);
  useEffect(() => {
    const id = setTimeout(() => setBooting(false), 650);
    return () => clearTimeout(id);
  }, []);

  /*
   * Zeitzone einmalig festhalten - eine serverseitige Erinnerung (siehe
   * supabase/functions/daily-nudge) braucht sie, um "17:00" in der richtigen
   * Ortszeit statt in UTC auszuwerten. Der Vergleich verhindert, dass jeder
   * Start unnoetig schreibt; nur beim ersten Mal oder nach einem Ortswechsel
   * aendert sich etwas.
   */
  useEffect(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone && zone !== state.settings.timezone) updateSettings({ timezone: zone });
    } catch {
      /* Ohne Intl.DateTimeFormat bleibt die Erinnerung lokal, wie bisher. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.timezone]);

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
  /* Heute oder frueher faellig - siehe dueTodoCount. */
  const openTodos = dueTodoCount(state.todos);
  const subtitle =
    tab === 'today' ? formatDateLong(todayISO())
      : tab === 'plans'
        ? activePlan ? t('Aktiv: {name}', { name: activePlan.name }) : t('Kein Plan aktiv')
        : tab === 'todos'
          ? openTodos > 0
            ? t('{count} fällig bis heute', { count: openTodos })
            : t('Nichts mehr für heute')
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
              {/*
                * Die Zahl an den Aufgaben ist eine Auskunft, keine Mahnung -
                * deshalb in der Zeitfarbe und nicht in Rot wie die Anfragen,
                * die wirklich jemand anderen warten lassen.
                */}
              {item.id === 'todos' && openTodos > 0 && (
                <span
                  className="nav__badge nav__badge--soft"
                  aria-label={t('{count} Aufgaben offen', { count: openTodos })}
                >
                  {openTodos}
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

      <Onboarding />

      <TrainingReminder onOpen={() => { setTab('today'); setHistoryOpen(false); }} />

      {/*
        * Faellige Aufgaben melden sich von jeder Seite aus - eine Erinnerung,
        * die man nur auf der Aufgabenseite sieht, erinnert niemanden.
        */}
      <TodoReminder onOpen={() => { setTab('todos'); setHistoryOpen(false); }} />

      {updateReady && (
        <div className="update-banner" role="status">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">{t('Neue Version verfügbar')}</div>
            <div className="tiny" style={{ opacity: 0.85 }}>
              {pendingAppDownload()
                ? t('Build {build} herunterladen und installieren – deine Daten bleiben.', { build: pendingAppDownload()!.build })
                : t('Einmal neu laden, dann ist sie da.')}
            </div>
          </div>
          <button className="btn btn--sm" onClick={applyUpdate}>
            {pendingAppDownload() ? t('Herunterladen') : t('Jetzt laden')}
          </button>
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
                {tab === 'todos' && <TodosPage />}
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

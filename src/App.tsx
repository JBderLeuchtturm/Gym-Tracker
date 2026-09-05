import { t } from './i18n';
import React, { useEffect, useState } from 'react';
import { useStore } from './storage/store';
import { TodayPage } from './pages/Today';
import { PlansPage } from './pages/Plans';
import { ProgressPage } from './pages/Progress';
import { CaloriesPage } from './pages/Calories';
import { ProfilePage } from './pages/Profile';
import { HistoryPage } from './pages/History';
import { FriendsPage } from './pages/Friends';
import { useSync } from './sync/SyncProvider';
import { applyUpdate, onUpdateAvailable } from './lib/appUpdate';
import { workoutSetCount } from './lib/stats';
import { formatDateLong, todayISO } from './lib/date';
import { IconCalendar, IconChart, IconDumbbell, IconFlame, IconUser } from './components/icons';
import { IconUsers } from './components/icons';

type Tab = 'today' | 'plans' | 'progress' | 'calories' | 'friends' | 'profile';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'today', label: 'Heute', icon: <IconDumbbell /> },
  { id: 'plans', label: 'Pläne', icon: <IconCalendar /> },
  { id: 'progress', label: 'Fortschritt', icon: <IconChart /> },
  { id: 'calories', label: 'Kalorien', icon: <IconFlame /> },
  { id: 'friends', label: 'Freunde', icon: <IconUsers /> },
  { id: 'profile', label: 'Profil', icon: <IconUser /> },
];

const TITLE_KEYS: Record<Tab, string> = {
  today: 'Training',
  plans: 'Wochenpläne',
  progress: 'Fortschritt',
  calories: 'Kalorien',
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
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => onUpdateAvailable(setUpdateReady), []);

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
  const greeting = state.profile.name ? t('Hallo {name}', { name: state.profile.name }) : 'Gym Tracker';

  const workoutCount = state.workouts.filter((workout) => workoutSetCount(workout) > 0).length;
  const subtitle =
    tab === 'today' ? formatDateLong(todayISO())
      : tab === 'plans'
        ? activePlan ? t('Aktiv: {name}', { name: activePlan.name }) : t('Kein Plan aktiv')
        : tab === 'progress' && workoutCount > 0
          ? t('{count} Einheiten aufgezeichnet', { count: workoutCount })
          : tab === 'calories' ? formatDateLong(todayISO())
            : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__title">
          <h1>{tab === 'today' ? greeting : title(tab)}</h1>
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
            onClick={() => { setTab(item.id); setHistoryOpen(false); window.scrollTo({ top: 0 }); }}
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

      {updateReady && (
        <div className="update-banner" role="status">
                    <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">{t('Neue Version verfügbar')}</div>
            <div className="tiny" style={{ opacity: 0.85 }}>{t('Einmal neu laden, dann ist sie da.')}</div>
          </div>
          <button className="btn btn--sm" onClick={applyUpdate}>{t('Jetzt laden')}</button>
        </div>
      )}

      <main className="page">
        {historyOpen ? (
          <>
            <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setHistoryOpen(false)}>
              ← Zurück
            </button>
            <HistoryPage />
          </>
        ) : (
          <>
            {tab === 'today' && <TodayPage />}
            {tab === 'plans' && <PlansPage />}
            {tab === 'progress' && <ProgressPage />}
            {tab === 'calories' && <CaloriesPage />}
            {tab === 'friends' && <FriendsPage />}
            {tab === 'profile' && <ProfilePage />}
          </>
        )}
      </main>
    </div>
  );
}

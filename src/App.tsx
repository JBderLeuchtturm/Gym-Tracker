import React, { useEffect, useState } from 'react';
import { useStore } from './storage/store';
import { TodayPage } from './pages/Today';
import { PlansPage } from './pages/Plans';
import { ProgressPage } from './pages/Progress';
import { CaloriesPage } from './pages/Calories';
import { ProfilePage } from './pages/Profile';
import { HistoryPage } from './pages/History';
import { formatDateLong, todayISO } from './lib/date';
import { IconCalendar, IconChart, IconDumbbell, IconFlame, IconUser } from './components/icons';

type Tab = 'today' | 'plans' | 'progress' | 'calories' | 'profile';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'today', label: 'Heute', icon: <IconDumbbell /> },
  { id: 'plans', label: 'Pläne', icon: <IconCalendar /> },
  { id: 'progress', label: 'Fortschritt', icon: <IconChart /> },
  { id: 'calories', label: 'Kalorien', icon: <IconFlame /> },
  { id: 'profile', label: 'Profil', icon: <IconUser /> },
];

const TITLES: Record<Tab, string> = {
  today: 'Training',
  plans: 'Wochenpläne',
  progress: 'Fortschritt',
  calories: 'Kalorien',
  profile: 'Profil',
};

export function App() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [historyOpen, setHistoryOpen] = useState(false);

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
  const greeting = state.profile.name ? `Hallo ${state.profile.name}` : 'Gym Tracker';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__title">
          <h1>{tab === 'today' ? greeting : TITLES[tab]}</h1>
          <div className="topbar__sub">
            {tab === 'today'
              ? formatDateLong(todayISO())
              : tab === 'plans'
                ? activePlan ? `Aktiv: ${activePlan.name}` : 'Kein Plan aktiv'
                : TITLES[tab]}
          </div>
        </div>
        {(tab === 'today' || tab === 'progress') && (
          <button className="btn btn--sm" onClick={() => setHistoryOpen(true)}>Verlauf</button>
        )}
      </header>

      <nav className="nav" aria-label="Hauptnavigation">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`nav__item ${tab === item.id ? 'nav__item--active' : ''}`}
            onClick={() => { setTab(item.id); setHistoryOpen(false); window.scrollTo({ top: 0 }); }}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

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
            {tab === 'profile' && <ProfilePage />}
          </>
        )}
      </main>
    </div>
  );
}

import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { RoutinesList } from './components/RoutinesList';
import { RoutineGenerator } from './components/RoutineGenerator';
import { LiveWorkout } from './components/LiveWorkout';
import { ProgressView } from './components/ProgressView';
import { CustomRoutineBuilder } from './components/CustomRoutineBuilder';
import { HabitTracker } from './components/HabitTracker';
import { Routine } from './types';
import { initError } from './firebase';

const MainView = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('routines');
  const [activeWorkout, setActiveWorkout] = useState<Routine | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([tab]));
  const [routinesRefreshKey, setRoutinesRefreshKey] = useState(0);

  const changeTab = (newTab: string) => {
    setTab(newTab);
    setMountedTabs(prev => prev.has(newTab) ? prev : new Set([...prev, newTab]));
  };

  const handleRoutineSaved = () => {
    setRoutinesRefreshKey(k => k + 1);
    changeTab('routines');
  };

  if (!user) return <Login />;

  if (activeWorkout) {
    return (
      <Layout currentTab="none" setTab={() => {}}>
        <LiveWorkout routine={activeWorkout} onFinish={() => setActiveWorkout(null)} />
      </Layout>
    );
  }

  return (
    <Layout currentTab={tab} setTab={changeTab}>
      {mountedTabs.has('routines') && (
        <div style={{ display: tab === 'routines' ? 'contents' : 'none' }} aria-hidden={tab !== 'routines'} inert={tab !== 'routines' ? ('' as unknown as boolean) : undefined}>
          <RoutinesList
            onStartWorkout={setActiveWorkout}
            onCreateCustom={() => changeTab('custom')}
            onGenerateAI={() => changeTab('generate')}
            refreshKey={routinesRefreshKey}
          />
        </div>
      )}
      {mountedTabs.has('generate') && (
        <div style={{ display: tab === 'generate' ? 'contents' : 'none' }} aria-hidden={tab !== 'generate'} inert={tab !== 'generate' ? ('' as unknown as boolean) : undefined}>
          <RoutineGenerator onRoutineSaved={handleRoutineSaved} />
        </div>
      )}
      {mountedTabs.has('custom') && (
        <div style={{ display: tab === 'custom' ? 'contents' : 'none' }} aria-hidden={tab !== 'custom'} inert={tab !== 'custom' ? ('' as unknown as boolean) : undefined}>
          <CustomRoutineBuilder
            onCancel={() => changeTab('routines')}
            onSave={handleRoutineSaved}
          />
        </div>
      )}
      {mountedTabs.has('progress') && (
        <div style={{ display: tab === 'progress' ? 'contents' : 'none' }} aria-hidden={tab !== 'progress'} inert={tab !== 'progress' ? ('' as unknown as boolean) : undefined}>
          <ProgressView />
        </div>
      )}
      {mountedTabs.has('habits') && (
        <div style={{ display: tab === 'habits' ? 'contents' : 'none' }} aria-hidden={tab !== 'habits'} inert={tab !== 'habits' ? ('' as unknown as boolean) : undefined}>
          <HabitTracker />
        </div>
      )}
    </Layout>
  );
};

export default function App() {
  if (initError) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-sm font-black uppercase tracking-widest text-[var(--action)] mb-4">Initialization Failed</h1>
          <p className="text-[11px] font-mono text-[var(--stone)] mb-2">Failed to connect to Firebase services.</p>
          <p className="text-[10px] font-mono text-[var(--hairline-2)] break-all">{initError}</p>
          <p className="text-[10px] font-mono text-[var(--hairline-2)] mt-4">Check your network connection and Firebase configuration, then reload the page.</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <MainView />
      </AuthProvider>
    </ThemeProvider>
  );
}

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
import { Routine } from './types';
import { initError } from './firebase';

const MainView = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('routines');
  const [activeWorkout, setActiveWorkout] = useState<Routine | null>(null);

  if (!user) return <Login />;

  if (activeWorkout) {
    return (
      <Layout currentTab="none" setTab={() => {}}>
        <LiveWorkout routine={activeWorkout} onFinish={() => setActiveWorkout(null)} />
      </Layout>
    );
  }

  return (
    <Layout currentTab={tab} setTab={setTab}>
      {tab === 'routines' && <RoutinesList onStartWorkout={setActiveWorkout} onCreateCustom={() => setTab('custom')} onGenerateAI={() => setTab('generate')} />}
      {tab === 'generate' && <RoutineGenerator onRoutineSaved={() => setTab('routines')} />}
      {tab === 'custom' && <CustomRoutineBuilder onCancel={() => setTab('routines')} onSave={() => setTab('routines')} />}
      {tab === 'progress' && <ProgressView />}
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

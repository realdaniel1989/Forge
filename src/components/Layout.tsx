import React from 'react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

export const Layout: React.FC<{ children: React.ReactNode; currentTab: string; setTab: (t: string) => void }> = ({ children, currentTab, setTab }) => {
  const { user, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navTabs = [
    { id: 'routines', label: 'Routines' },
    { id: 'generate', label: 'Generate' },
    { id: 'progress', label: 'Analytics' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[var(--canvas)] text-[var(--ink)] font-sans">

      {/* ── TOP NAV ── */}
      <header className="bg-[var(--canvas)] border-b border-[var(--hairline)] h-[60px] flex items-center px-8 gap-0 sticky top-0 z-40 shrink-0">

        {/* Brand */}
        <div className="flex items-center gap-0 mr-10 shrink-0">
          <span
            className="font-mono text-[22px] font-black tracking-[0.02em] uppercase text-[var(--ink)] leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Forge
          </span>
          <span
            className="font-mono text-[22px] font-black tracking-[0.02em] uppercase text-[var(--action)] leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            .AI
          </span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center h-full gap-0 flex-1">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`relative flex items-center h-full px-5 border-none bg-none cursor-pointer transition-colors text-[13px] font-semibold tracking-[0.06em] uppercase
                ${currentTab === tab.id
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--stone)] hover:text-[var(--ash)]'
                }`}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}
            >
              {tab.label}
              {currentTab === tab.id && (
                <span className="absolute bottom-[-1px] left-5 right-5 h-[2px] bg-[var(--ink)]" />
              )}
            </button>
          ))}
        </nav>

        {/* Right side: theme toggle + user */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--hairline-2)] bg-none cursor-pointer text-[var(--stone)] hover:text-[var(--ash)] hover:border-[var(--ash)] transition-colors"
          >
            {theme === 'light' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>

          {/* User chip */}
          {user && (
            <button
              onClick={logOut}
              title="Sign out"
              className="flex items-center gap-2 px-3 py-[5px] rounded-full border border-[var(--hairline-2)] bg-none cursor-pointer hover:border-[var(--ash)] transition-colors"
            >
              <div className="w-[22px] h-[22px] rounded-full bg-[var(--surface-2)] border border-[var(--hairline-2)] flex items-center justify-center text-[10px] font-bold text-[var(--stone)]">
                {user.email?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-[12px] font-medium text-[var(--ash)]">
                {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Account'}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto bg-[var(--canvas)]">
        <div className="max-w-[900px] mx-auto px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  );
};

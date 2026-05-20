import React from 'react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

export const Layout: React.FC<{ children: React.ReactNode; currentTab: string; setTab: (t: string) => void }> = ({ children, currentTab, setTab }) => {
  const { user, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navTabs = [
    { id: 'routines', label: 'Routines', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>
      </svg>
    )},
    { id: 'generate', label: 'Generate', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3c-1 3-3 5-5 6 2 1 4 3 5 6 1-3 3-5 5-6-2-1-4-3-5-6z"/>
      </svg>
    )},
    { id: 'exercises', label: 'Exercises', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    )},
    { id: 'progress', label: 'Analytics', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )},
    { id: 'habits', label: 'Habits', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    )},
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[var(--canvas)] text-[var(--ink)] font-sans">

      {/* ── TOP NAV (hidden during LiveWorkout) ── */}
      {currentTab !== 'none' && (
      <header className="bg-[var(--canvas)] border-b border-[var(--hairline)] h-[60px] flex items-center px-4 sm:px-8 gap-0 sticky top-0 z-40 shrink-0 safe-top">

        {/* Brand */}
        <div className="flex items-center gap-0 sm:mr-10 shrink-0">
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

        {/* Desktop nav tabs — hidden on mobile */}
        <nav className="hidden sm:flex items-center h-full gap-0 flex-1">
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
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-[var(--hairline-2)] bg-none cursor-pointer text-[var(--stone)] hover:text-[var(--ash)] hover:border-[var(--ash)] transition-colors"
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

          {/* User chip — hidden on mobile */}
          {user && (
            <button
              onClick={logOut}
              title="Sign out"
              className="hidden sm:flex items-center gap-2 px-3 py-[5px] rounded-full border border-[var(--hairline-2)] bg-none cursor-pointer hover:border-[var(--ash)] transition-colors"
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
      )}

      {/* ── MAIN CONTENT ── */}
      <main className={`flex-1 overflow-y-auto bg-[var(--canvas)] ${currentTab !== 'none' ? 'pb-20 sm:pb-0' : ''}`}>
        <div className="max-w-[900px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      {currentTab !== 'none' && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--canvas)] border-t border-[var(--hairline)] safe-bottom">
          <div className="flex items-center justify-around h-[56px]">
            {navTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full border-none bg-none cursor-pointer transition-colors
                  ${currentTab === tab.id
                    ? 'text-[var(--ink)]'
                    : 'text-[var(--stone)]'
                  }`}
              >
                {tab.icon}
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.04em]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

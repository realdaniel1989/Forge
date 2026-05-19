import React from 'react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning.';
    if (hour < 18) return 'Good afternoon.';
    return 'Good evening.';
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-6 relative">

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Toggle theme"
        className="absolute top-5 right-6 w-8 h-8 flex items-center justify-center rounded-full border border-[var(--hairline-2)] text-[var(--stone)] hover:text-[var(--ash)] hover:border-[var(--ash)] transition-colors"
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

      <div className="w-full max-w-[360px] flex flex-col">

        {/* Brand */}
        <div className="mb-12">
          <div
            className="text-[40px] font-black uppercase leading-none tracking-tight mb-2 text-[var(--ink)]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '-0.01em' }}
          >
            Forge<span className="text-[var(--action)]">.AI</span>
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)]"
             style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            High-Performance Training
          </p>
        </div>

        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-[28px] font-bold text-[var(--ink)] tracking-tight mb-2 leading-tight">
            {getGreeting()}
          </h1>
          <p className="text-[14px] text-[var(--stone)] font-medium">
            Sign in to access your training program.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={signIn}
          className="w-full bg-[var(--ink)] text-[var(--canvas)] border-none rounded-full py-[14px] font-sans text-[13px] font-semibold uppercase tracking-[0.08em] cursor-pointer hover:opacity-85 transition-opacity"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Continue with Google
        </button>

        <p className="mt-5 text-[11px] text-[var(--stone)] text-center">
          Your data is private and secured with Firebase Auth.
        </p>
      </div>
    </div>
  );
};

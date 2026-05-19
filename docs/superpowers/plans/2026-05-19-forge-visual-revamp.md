# Forge.AI Visual Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire Forge.AI workout tracker from emerald-green accent + wide sidebar + all-caps aesthetic to a crimson-red accent + 60px icon rail + mixed-case editorial design.

**Architecture:** CSS custom properties define the design token system in `src/index.css`. Components use Tailwind utilities referencing these variables. All emerald references replaced with red tokens. Google Fonts (Syne + Space Mono) replace system defaults. No new features, no backend changes.

**Tech Stack:** React 19, Tailwind CSS 4 (CSS-based `@theme` config), Lucide React icons, Firebase

---

## File Structure

| File | Change |
|---|---|
| `index.html` | Add Google Fonts `<link>` tags |
| `src/index.css` | Add CSS custom properties + `@theme` block |
| `src/components/Layout.tsx` | Full rewrite — 60px icon rail |
| `src/components/Login.tsx` | Full rewrite — left-aligned + greeting |
| `src/components/RoutinesList.tsx` | Full rewrite — list cards + empty state |
| `src/components/RoutineGenerator.tsx` | Restyle — tokens, typography, card structure |
| `src/components/CustomRoutineBuilder.tsx` | Restyle — tokens, card sections, button labels |
| `src/components/LiveWorkout.tsx` | Restyle + full-screen timer takeover |
| `src/components/ProgressView.tsx` | Restyle — tokens, calendar, modal, table |

---

### Task 1: Foundation — Fonts & CSS Tokens

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add Google Fonts to `index.html`**

Replace the existing `<head>` content with Google Fonts preconnect + stylesheet links, and update the title:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Forge.AI — High-Performance Training</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</head>
```

- [ ] **Step 2: Add CSS custom properties and Tailwind `@theme` block to `src/index.css`**

Replace the entire file content with:

```css
@import "tailwindcss";

:root {
  --bg:       #080808;
  --bg-1:     #0e0e0e;
  --bg-2:     #141414;
  --bg-3:     #1a1a1a;
  --border:   #1e1e1e;
  --border-2: #2a2a2a;
  --muted:    #3a3a3a;
  --dim:      #555;
  --text-2:   #999;
  --text:     #e8e8e8;
  --white:    #ffffff;
  --red:      #C0392B;
  --red-dim:  #1a0808;
  --red-hi:   #E74C3C;
  --radius:   8px;
  --radius-sm: 5px;
}

@theme {
  --font-sans: 'Syne', sans-serif;
  --font-mono: 'Space Mono', monospace;
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 2px; }

/* Animations */
@keyframes pulse-red { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
```

- [ ] **Step 3: Verify fonts load in dev server**

Run: `cd "/Users/djedidiahw007/Desktop/Project/Workout App/gym-workout-tracker" && npm run dev`

Open browser, check that Syne and Space Mono are applied. Verify CSS variables are present in DevTools.

---

### Task 2: Layout — Icon Rail (`Layout.tsx`)

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Rewrite Layout.tsx to 60px icon rail**

Replace entire file content with:

```tsx
import React from 'react';
import { useAuth } from '../AuthContext';
import { Dumbbell, Calendar, Sparkles, BarChart2, LogOut } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode; currentTab: string; setTab: (t: string) => void }> = ({ children, currentTab, setTab }) => {
  const { user, logOut } = useAuth();

  const navItems = [
    { id: 'routines', icon: Calendar, label: 'My Routines' },
    { id: 'generate', icon: Sparkles, label: 'AI Generator' },
    { id: 'progress', icon: BarChart2, label: 'Analytics' },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans">
      {/* Icon Rail */}
      <aside className="w-[60px] shrink-0 border-r border-[var(--border)] flex flex-col items-center py-4 gap-1 bg-[var(--bg)]">
        {/* Logo */}
        <div className="w-8 h-8 bg-[var(--red)] rounded-[7px] flex items-center justify-center mb-5 shrink-0">
          <Dumbbell className="w-4 h-4 text-white" style={{ stroke: '#fff' }} />
        </div>

        {/* Nav buttons */}
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            title={item.label}
            className={`w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer transition-colors ${
              currentTab === item.id
                ? 'bg-[var(--red-dim)] text-[var(--red)]'
                : 'text-[var(--muted)] hover:bg-[var(--bg-2)] hover:text-[var(--text-2)]'
            }`}
          >
            <item.icon className="w-4 h-4" />
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Avatar */}
        {user && (
          <button
            onClick={logOut}
            title="Sign out"
            className="w-7 h-7 rounded-full bg-[var(--bg-3)] border border-[var(--border-2)] flex items-center justify-center text-[10px] font-bold text-[var(--dim)] cursor-pointer hover:text-[var(--text-2)] transition-colors"
          >
            {user.email?.[0]?.toUpperCase() || '?'}
          </button>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[var(--bg)]">
        <div className="min-h-full p-5 sm:p-7">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
```

- [ ] **Step 2: Verify icon rail renders correctly**

Check: 60px sidebar, logo square, three icon buttons, avatar circle at bottom. Active state shows red-dim bg + red icon.

---

### Task 3: Login Page (`Login.tsx`)

**Files:**
- Modify: `src/components/Login.tsx`

- [ ] **Step 1: Rewrite Login.tsx to left-aligned layout with greeting**

Replace entire file content with:

```tsx
import React from 'react';
import { useAuth } from '../AuthContext';
import { Dumbbell } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning.';
    if (hour < 18) return 'Good afternoon.';
    return 'Good evening.';
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="w-full max-w-[380px] flex flex-col">
        {/* Brand */}
        <div className="mb-11">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-[30px] h-[30px] bg-[var(--red)] rounded-[7px] shrink-0 flex items-center justify-center">
              <Dumbbell className="w-[15px] h-[15px] text-white" style={{ stroke: '#fff' }} />
            </div>
            <span className="text-2xl font-extrabold text-[var(--white)] tracking-tight">Forge</span>
            <span className="text-2xl font-normal text-[var(--muted)] tracking-tight">.AI</span>
          </div>
          <p className="font-mono text-[10px] text-[var(--border-2)] tracking-[0.14em] uppercase">
            High-Performance Training · v2.4.0
          </p>
        </div>

        {/* Greeting */}
        <div className="mb-7">
          <h1 className="text-[28px] font-bold text-[var(--white)] tracking-tight mb-1.5">
            {getGreeting()}
          </h1>
          <p className="text-[13px] text-[var(--dim)]">Sign in to continue your program.</p>
        </div>

        {/* CTA */}
        <button
          onClick={signIn}
          className="w-full bg-[var(--red)] text-white border-none rounded-[var(--radius)] py-[13px] font-sans text-[12px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:opacity-88 transition-opacity"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify login page renders with greeting, brand mark, and red button**

---

### Task 4: My Routines (`RoutinesList.tsx`)

**Files:**
- Modify: `src/components/RoutinesList.tsx`

- [ ] **Step 1: Rewrite RoutinesList.tsx with list card layout + empty state**

Replace entire file content with:

```tsx
import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';
import { Routine } from '../types';
import { Trash2, Plus, Sparkles, Dumbbell } from 'lucide-react';

export const RoutinesList: React.FC<{onStartWorkout: (r: Routine) => void, onCreateCustom: () => void}> = ({onStartWorkout, onCreateCustom}) => {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutines = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'routines'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetched: Routine[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as Routine);
      });
      fetched.sort((a,b) => b.createdAt - a.createdAt);
      setRoutines(fetched);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'routines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
  }, [user]);

  const deleteRoutine = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'routines', id));
      setRoutines(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `routines/${id}`);
    }
  };

  if (loading) return <div className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-[0.12em] p-6 text-center">Initializing Data...</div>;

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex justify-between items-end pb-4 border-b border-[var(--border)]">
        <div>
          <p className="font-mono text-[10px] text-[var(--muted)] tracking-[0.12em] uppercase mb-1">
            {routines.length} routine{routines.length !== 1 ? 's' : ''}
          </p>
          <h2 className="text-[22px] font-bold text-[var(--white)] tracking-tight">My Routines</h2>
        </div>
        <button
          onClick={onCreateCustom}
          className="bg-[var(--red)] text-white border-none rounded-[var(--radius-sm)] px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:opacity-88 transition-opacity flex items-center gap-1.5"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>

      {routines.length === 0 ? (
        /* Empty state */
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-[320px]">
            <div className="w-12 h-12 bg-[var(--bg-2)] border border-[var(--border)] rounded-[10px] flex items-center justify-center mx-auto mb-5">
              <Dumbbell className="w-[22px] h-[22px] text-[var(--muted)]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--white)] mb-2 tracking-tight">No routines yet</h3>
            <p className="text-xs text-[var(--dim)] leading-relaxed mb-6">
              Create your first routine manually or let the AI build one for your goals.
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                onClick={onCreateCustom}
                className="bg-[var(--red)] text-white border-none rounded-[var(--radius-sm)] px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:opacity-88 transition-opacity flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> Generate with AI
              </button>
              <button
                onClick={onCreateCustom}
                className="bg-transparent text-[var(--dim)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--text-2)] transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Build manually
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Routine cards */
        <div className="flex flex-col gap-2">
          {routines.map((routine, idx) => (
            <div
              key={routine.id}
              className={`bg-[var(--bg-1)] border rounded-[var(--radius)] overflow-hidden ${idx === 0 ? 'border-[var(--border-2)]' : 'border-[var(--border)]'}`}
            >
              <div className="px-4 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-[var(--white)] tracking-tight">{routine.name}</span>
                    {routine.bodyPart && (
                      <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full tracking-[0.06em] uppercase ${
                        idx === 0
                          ? 'bg-[var(--red-dim)] text-[var(--red)]'
                          : 'bg-[var(--bg-2)] text-[var(--muted)] border border-[var(--border)]'
                      }`}>
                        {routine.bodyPart}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRoutine(routine.id!, e); }}
                  className="text-[var(--muted)] hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onStartWorkout(routine)}
                  className={`shrink-0 px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer transition-opacity rounded-[var(--radius-sm)] ${
                    idx === 0
                      ? 'bg-[var(--red)] text-white border-none hover:opacity-88'
                      : 'bg-transparent text-[var(--dim)] border border-[var(--border-2)] hover:border-[var(--muted)] hover:text-[var(--text-2)]'
                  }`}
                >
                  Start
                </button>
              </div>

              {/* Exercise preview for first card */}
              {idx === 0 && routine.exercises.length > 0 && (
                <div className="px-4 py-2.5 border-t border-[var(--border)] flex flex-col gap-1">
                  {routine.exercises.slice(0, 3).map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`font-mono text-[9px] ${i === 0 ? 'text-[var(--red)]' : 'text-[var(--muted)]'}`}>›</span>
                      <span className={`text-[11px] ${i === 0 ? 'text-[var(--text-2)]' : 'text-[var(--muted)]'}`}>{ex.name}</span>
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {ex.type === 'cardio' ? `${ex.duration} min` : `${ex.sets}×${ex.reps}`}
                      </span>
                    </div>
                  ))}
                  {routine.exercises.length > 3 && (
                    <p className="font-mono text-[10px] text-[var(--border-2)] pl-3.5">+{routine.exercises.length - 3} more</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify routine list renders as horizontal cards with exercise preview on first card, empty state when no routines**

---

### Task 5: AI Generator (`RoutineGenerator.tsx`)

**Files:**
- Modify: `src/components/RoutineGenerator.tsx`

- [ ] **Step 1: Rewrite RoutineGenerator.tsx with new visual language**

Replace entire file content with:

```tsx
import React, { useState } from 'react';
import { Sparkles, Loader2, Bookmark } from 'lucide-react';
import { Exercise } from '../types';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';

export const RoutineGenerator: React.FC<{onRoutineSaved: () => void}> = ({onRoutineSaved}) => {
  const { user } = useAuth();
  const [bodyPart, setBodyPart] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRoutine, setGeneratedRoutine] = useState<{name: string, exercises: Exercise[]} | null>(null);
  const [saving, setSaving] = useState(false);
  
  const generate = async () => {
    if (!bodyPart.trim()) return;
    setLoading(true);
    setGeneratedRoutine(null);
    try {
      const res = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyPart })
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedRoutine(data);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate routine');
    } finally {
      setLoading(false);
    }
  };

  const saveRoutine = async () => {
    if (!generatedRoutine || !user) return;
    setSaving(true);
    try {
      const routineData = {
        userId: user.uid,
        name: generatedRoutine.name,
        bodyPart: bodyPart,
        exercises: generatedRoutine.exercises,
        isGenerated: true,
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'routines'), routineData);
      onRoutineSaved();
      setGeneratedRoutine(null);
      setBodyPart('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'routines');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex justify-between items-end pb-4 border-b border-[var(--border)]">
        <div>
          <p className="font-mono text-[10px] text-[var(--muted)] tracking-[0.12em] uppercase mb-1">AI Generator</p>
          <h2 className="text-[22px] font-bold text-[var(--white)] tracking-tight">
            {generatedRoutine ? generatedRoutine.name : 'Build a program.'}
          </h2>
        </div>
        {generatedRoutine && (
          <button
            onClick={saveRoutine}
            disabled={saving}
            className="bg-[var(--red)] text-white border-none rounded-[var(--radius-sm)] px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:opacity-88 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3" />}
            Save Routine
          </button>
        )}
      </div>

      {/* Parameters card */}
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text)]">Parameters</span>
          <span className="font-mono text-[10px] text-[var(--muted)]">Define your target</span>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-[0.1em]">Muscle group</span>
            <input
              type="text"
              className="bg-[var(--bg-2)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] font-medium text-[var(--white)] outline-none w-full transition-colors focus:border-[var(--red)] placeholder:text-[var(--muted)]"
              placeholder="e.g. Chest, Legs…"
              value={bodyPart}
              onChange={e => setBodyPart(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>
          <button
            onClick={generate}
            disabled={loading || !bodyPart.trim()}
            className="self-end bg-[var(--red)] text-white border-none rounded-[var(--radius-sm)] px-6 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:opacity-88 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? 'Generating...' : 'Generate Plan'}
          </button>
        </div>
      </div>

      {/* Empty result or generated exercises */}
      {!generatedRoutine && !loading && (
        <div className="border border-dashed border-[var(--border-2)] rounded-[var(--radius)] py-10 px-6 text-center">
          <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.1em]">Your generated routine will appear here</p>
        </div>
      )}

      {generatedRoutine && (
        <div className="flex flex-col gap-2">
          {generatedRoutine.exercises.map((ex, idx) => (
            <div key={idx} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`font-mono text-[10px] font-bold ${idx === 0 ? 'text-[var(--red)]' : 'text-[var(--muted)]'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--white)]">{ex.name}</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--muted)]">
                  {ex.type === 'cardio' ? `${ex.duration} min` : `${ex.sets}×${ex.reps}`}
                </span>
              </div>
              <div className="px-4 py-3 flex flex-col gap-1.5">
                {ex.tip && (
                  <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
                    <span className="text-[var(--red)]">›</span> {ex.tip}
                  </p>
                )}
                {ex.weight > 0 && (
                  <p className="font-mono text-[10px] text-[var(--muted)]">Suggested load: {ex.weight} lbs</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify AI Generator renders with Parameters card, dashed empty state, and exercise cards when results present**

---

### Task 6: Custom Routine Builder (`CustomRoutineBuilder.tsx`)

**Files:**
- Modify: `src/components/CustomRoutineBuilder.tsx`

- [ ] **Step 1: Rewrite CustomRoutineBuilder.tsx with new visual language**

Replace entire file content with:

```tsx
import React, { useState } from 'react';
import { Exercise } from '../types';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firestoreUtils';
import { useAuth } from '../AuthContext';
import { Plus, Trash2, Check } from 'lucide-react';

export const CustomRoutineBuilder: React.FC<{onCancel: () => void, onSave: () => void}> = ({onCancel, onSave}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  const addExercise = (type: 'strength' | 'cardio') => {
    if (type === 'strength') {
      setExercises([...exercises, { name: '', sets: 3, reps: 10, weight: 0, type: 'strength' }]);
    } else {
      setExercises([...exercises, { name: '', type: 'cardio', duration: 30, distance: 0 }]);
    }
  };

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    const newEx = [...exercises];
    newEx[index] = { ...newEx[index], [field]: value };
    setExercises(newEx);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const saveRoutine = async () => {
    if (!user || !name.trim() || exercises.length === 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'routines'), {
        userId: user.uid,
        name: name.trim(),
        exercises: exercises.filter(e => e.name.trim() !== ''),
        createdAt: Date.now()
      });
      onSave();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'routines');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      {/* Page header */}
      <div className="flex justify-between items-end pb-4 border-b border-[var(--border)]">
        <div>
          <p className="font-mono text-[10px] text-[var(--muted)] tracking-[0.12em] uppercase mb-1">New Routine</p>
          <h2 className="text-[22px] font-bold text-[var(--white)] tracking-tight">Configure Routine</h2>
        </div>
        <button
          onClick={onCancel}
          className="bg-transparent text-[var(--dim)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--text-2)] transition-colors"
        >
          Discard
        </button>
      </div>

      {/* Identifier card */}
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <span className="text-xs font-semibold text-[var(--text)]">Identifier</span>
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-[0.1em]">Routine name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Upper Power A"
              className="bg-[var(--bg-2)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] font-medium text-[var(--white)] outline-none w-full transition-colors focus:border-[var(--red)] placeholder:text-[var(--muted)]"
            />
          </div>
        </div>
      </div>

      {/* Protocol Structure card */}
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text)]">Protocol Structure</span>
          <div className="flex gap-2">
            <button
              onClick={() => addExercise('strength')}
              className="bg-transparent text-[var(--dim)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-2.5 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--text-2)] transition-colors flex items-center gap-1"
            >
              <Plus className="w-2.5 h-2.5" /> Strength
            </button>
            <button
              onClick={() => addExercise('cardio')}
              className="bg-transparent text-[var(--dim)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-2.5 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--muted)] hover:text-[var(--text-2)] transition-colors flex items-center gap-1"
            >
              <Plus className="w-2.5 h-2.5" /> Cardio
            </button>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-2.5">
          {exercises.length === 0 ? (
            <div className="text-center font-mono text-[10px] text-[var(--muted)] py-8 border border-dashed border-[var(--border-2)] rounded-[var(--radius-sm)] uppercase tracking-[0.1em]">
              No exercises added
            </div>
          ) : (
            exercises.map((ex, idx) => (
              <div
                key={idx}
                className="bg-[var(--bg-2)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2.5 flex gap-2.5 items-end flex-wrap"
              >
                <div className="flex-1 min-w-[140px]">
                  <div className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                    {ex.type === 'cardio' ? 'Cardio activity' : 'Exercise'}
                  </div>
                  <input
                    type="text"
                    value={ex.name}
                    onChange={e => updateExercise(idx, 'name', e.target.value)}
                    placeholder={ex.type === 'cardio' ? 'Treadmill Run' : 'Bench Press'}
                    className="bg-transparent border border-[var(--border-2)] rounded-[var(--radius-sm)] px-2 py-2 text-[12px] text-[var(--white)] outline-none w-full transition-colors focus:border-[var(--red)] placeholder:text-[var(--muted)]"
                  />
                </div>
                {ex.type === 'cardio' ? (
                  <>
                    <div className="w-14">
                      <div className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">Min</div>
                      <input
                        type="number"
                        min="0"
                        value={ex.duration || 0}
                        onChange={e => updateExercise(idx, 'duration', parseInt(e.target.value) || 0)}
                        className="bg-transparent border border-[var(--border-2)] rounded-[var(--radius-sm)] px-2 py-2 text-[12px] text-[var(--white)] outline-none w-full text-center transition-colors focus:border-[var(--red)]"
                      />
                    </div>
                    <div className="w-14">
                      <div className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">Dist</div>
                      <input
                        type="number"
                        min="0"
                        value={ex.distance || 0}
                        onChange={e => updateExercise(idx, 'distance', parseFloat(e.target.value) || 0)}
                        className="bg-transparent border border-[var(--border-2)] rounded-[var(--radius-sm)] px-2 py-2 text-[12px] text-[var(--white)] outline-none w-full text-center transition-colors focus:border-[var(--red)]"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-14">
                      <div className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">Sets</div>
                      <input
                        type="number"
                        min="1"
                        value={ex.sets || 1}
                        onChange={e => updateExercise(idx, 'sets', parseInt(e.target.value) || 1)}
                        className="bg-transparent border border-[var(--border-2)] rounded-[var(--radius-sm)] px-2 py-2 text-[12px] text-[var(--white)] outline-none w-full text-center transition-colors focus:border-[var(--red)]"
                      />
                    </div>
                    <div className="w-14">
                      <div className="font-mono text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">Reps</div>
                      <input
                        type="number"
                        min="1"
                        value={ex.reps || 1}
                        onChange={e => updateExercise(idx, 'reps', parseInt(e.target.value) || 1)}
                        className="bg-transparent border border-[var(--border-2)] rounded-[var(--radius-sm)] px-2 py-2 text-[12px] text-[var(--white)] outline-none w-full text-center transition-colors focus:border-[var(--red)]"
                      />
                    </div>
                  </>
                )}
                <button
                  onClick={() => removeExercise(idx)}
                  className="bg-transparent border-none cursor-pointer text-[var(--muted)] p-2 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={saveRoutine}
        disabled={saving || !name.trim() || exercises.length === 0}
        className="w-full bg-[var(--red)] text-white border-none rounded-[var(--radius)] py-[13px] font-sans text-[12px] font-bold uppercase tracking-[0.06em] cursor-pointer hover:opacity-88 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Check className="w-3 h-3" /> Save Routine
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Verify custom builder renders with Identifier card, Protocol Structure card with exercise rows, and red Save Routine button**

---

### Task 7: Live Workout (`LiveWorkout.tsx`)

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

- [ ] **Step 1: Rewrite LiveWorkout.tsx with new visual language + full-screen rest timer**

This is the largest file. Replace the entire file content with the new version that:
1. Uses all new design tokens (red instead of emerald, new bg colors, new borders)
2. Adds opacity dimming for non-active exercises (45%)
3. Replaces the floating timer widget with a full-screen takeover
4. Updates button labels ("Done"/"Pending" instead of all-caps)
5. Adds set progress squares in exercise headers
6. Uses the new modal styling for Add Exercise modal

The full replacement code is shown in the execution step below.

- [ ] **Step 2: Verify live workout renders with red accents, active exercise at full opacity, upcoming at 45%, and full-screen timer when rest active**

---

### Task 8: Analytics (`ProgressView.tsx`)

**Files:**
- Modify: `src/components/ProgressView.tsx`

- [ ] **Step 1: Rewrite ProgressView.tsx with new visual language**

Replace entire file content with new version that:
1. Uses all new design tokens
2. Updates page header with eyebrow + title + chevron nav
3. Updates calendar cells with new colors and typography
4. Updates weekly output table with red accents
5. Updates workout detail modal with 12px border-radius
6. Removes Trophy icon, uses mixed-case throughout

The full replacement code is shown in the execution step below.

- [ ] **Step 2: Verify analytics page renders with new tokens, calendar, weekly output table, and modal**

---

### Task 9: Verification

- [ ] **Step 1: Run dev server and verify all pages**

Run: `cd "/Users/djedidiahw007/Desktop/Project/Workout App/gym-workout-tracker" && npm run dev`

Manually verify:
1. Login page — left-aligned brand + greeting + red button
2. My Routines — list cards with exercise preview on first card
3. AI Generator — Parameters card + dashed empty state
4. Custom Builder — Identifier card + Protocol card + red save
5. Live Workout — red accents, dimmed upcoming, full-screen timer
6. Analytics — calendar grid + weekly output table + modal

- [ ] **Step 2: Run TypeScript check**

Run: `cd "/Users/djedidiahw007/Desktop/Project/Workout App/gym-workout-tracker" && npx tsc --noEmit`

Expected: No type errors

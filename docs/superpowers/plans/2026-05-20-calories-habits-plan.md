# Calories Tracking & Habit Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post-workout calorie capture with Analytics bar chart, and a new Habits tab with custom habit CRUD, daily logging, GitHub-style heatmaps, and streak stats.

**Architecture:** Calories are an optional field on the existing `workoutLogs` Firestore documents — no new collection. Habits and daily logs use two new collections (`habits`, `habitLogs`). The Habit Tracker is a single new component (`HabitTracker.tsx`). All data fetching uses `getDocs` (same pattern as the rest of the app). The calorie bar chart and heatmap are pure SVG — no charting library.

**Tech Stack:** React 18, TypeScript, Firebase 10 Firestore Web SDK, Vite, Tailwind CSS, Lucide React, date-fns. No test framework — verification is `npm run lint` + manual smoke testing.

---

## File Map

| File | Change |
|---|---|
| `src/types.ts` | Add `calories?: number` to `WorkoutLog`; add `Habit` and `HabitLog` interfaces |
| `src/components/LiveWorkout.tsx` | Capture `addDoc` ref; show calorie modal before `onFinish`; import `updateDoc`, `doc` |
| `src/components/ProgressView.tsx` | Add date-range selector; add calorie bar chart section; add inline calorie edit on workout modal |
| `src/components/Layout.tsx` | Add Habits tab to `navTabs` array (desktop + mobile) |
| `src/App.tsx` | Import `HabitTracker`; add `habits` tab to lazy-mount system |
| `src/components/HabitTracker.tsx` | **Create new** — habits CRUD, daily log modal, heatmap SVG, streak stats |

---

## Task 1: Update types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `calories` to `WorkoutLog` and add `Habit` + `HabitLog` interfaces**

  Replace the entire `src/types.ts` with:

  ```ts
  export interface TrackedSet {
    reps: number;
    weight: number;
    completed: boolean;
  }

  export interface Exercise {
    _id?: string;
    name: string;
    type?: 'strength' | 'cardio';
    sets?: number;
    reps?: number;
    weight?: number;
    duration?: number;
    distance?: number;
    tip?: string;
    actualSets?: number;
    actualReps?: number;
    actualWeight?: number;
    completed?: boolean;
    trackedSets?: TrackedSet[];
  }

  export interface Routine {
    id: string;
    userId: string;
    name: string;
    bodyPart?: string;
    exercises: Exercise[];
    isGenerated?: boolean;
    createdAt: number;
  }

  export interface WorkoutLog {
    id?: string;
    userId: string;
    routineId?: string;
    name: string;
    bodyPart?: string;
    date: number;
    unit: 'lbs' | 'kgs';
    exercises: Exercise[];
    calories?: number;
  }

  export interface Habit {
    id: string;
    userId: string;
    name: string;
    target: number;
    unit: string;
    createdAt: number;
    archived: boolean;
  }

  export interface HabitLog {
    id: string;
    userId: string;
    habitId: string;
    date: string;    // "YYYY-MM-DD"
    actual: number;
    createdAt: number;
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 3: Commit**

  ```bash
  git add src/types.ts
  git commit -m "feat: add calories to WorkoutLog, add Habit and HabitLog types"
  ```

---

## Task 2: Post-finish calorie modal in LiveWorkout

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

The `finishWorkout` function currently calls `addDoc` then immediately clears the draft and calls `onFinish()`. We intercept after a successful save: store the new document ID in state, show a modal, and only call `onFinish()` after the user saves or skips.

- [ ] **Step 1: Add `updateDoc` and `doc` to the Firestore import**

  In `src/components/LiveWorkout.tsx`, line 4, change:
  ```ts
  import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
  ```
  To:
  ```ts
  import { collection, addDoc, updateDoc, doc, query, where, getDocs, limit } from 'firebase/firestore';
  ```

- [ ] **Step 2: Add calorie modal state variables**

  After line 52 (`const [showAbortConfirm, setShowAbortConfirm] = useState(false);`), add:
  ```ts
  const [showCalorieModal, setShowCalorieModal] = useState(false);
  const [savedLogId, setSavedLogId] = useState<string | null>(null);
  const [calorieInput, setCalorieInput] = useState('');
  const [calorieSaving, setCalorieSaving] = useState(false);
  const [calorieError, setCalorieError] = useState('');
  ```

- [ ] **Step 3: Rewrite `finishWorkout` to show the modal instead of immediately calling `onFinish`**

  Replace the entire `finishWorkout` function (lines 234–262) with:

  ```ts
  const finishWorkout = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const exercisesToSave = exercises.map(ex => ({
        ...ex,
        weight: ex.weight != null ? parseFloat(toDisplayUnit(ex.weight).toFixed(1)) : undefined,
        trackedSets: ex.trackedSets?.map(s => ({
          ...s,
          weight: parseFloat(toDisplayUnit(s.weight).toFixed(1)),
        })),
      }));
      const docRef = await addDoc(collection(db, 'workoutLogs'), {
        userId: user.uid,
        routineId: routine.id,
        name: routine.name,
        bodyPart: routine.bodyPart || null,
        date: Date.now(),
        unit: unit,
        exercises: exercisesToSave
      });
      localStorage.removeItem(draftKey);
      setSavedLogId(docRef.id);
      setCalorieInput('');
      setCalorieError('');
      setShowCalorieModal(true);
    } catch(e) {
      handleFirestoreError(e, OperationType.CREATE, 'workoutLogs');
    } finally {
      setSaving(false);
    }
  };

  const handleCalorieSave = async () => {
    if (!savedLogId) return;
    const val = parseInt(calorieInput, 10);
    if (isNaN(val) || val < 0) {
      setCalorieError('Enter a valid number');
      return;
    }
    setCalorieSaving(true);
    try {
      await updateDoc(doc(db, 'workoutLogs', savedLogId), { calories: val });
      setShowCalorieModal(false);
      onFinish();
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, `workoutLogs/${savedLogId}`);
      setCalorieError('Failed to save. Try again.');
    } finally {
      setCalorieSaving(false);
    }
  };

  const handleCalorieSkip = () => {
    setShowCalorieModal(false);
    onFinish();
  };
  ```

- [ ] **Step 4: Add the calorie modal JSX**

  In the component's return statement, find the abort-confirm modal (search for `showAbortConfirm`). Add the calorie modal immediately before it:

  ```tsx
  {/* ── CALORIE MODAL ── */}
  {showCalorieModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl w-full max-w-[360px] p-6 flex flex-col gap-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Workout Complete</p>
          <h2 className="text-[22px] font-black uppercase text-[var(--white)] leading-tight">{routine.name}</h2>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Calories burnt
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="e.g. 450"
              value={calorieInput}
              onChange={e => { setCalorieInput(e.target.value); setCalorieError(''); }}
              className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--white)] text-[15px] font-mono outline-none focus:border-[var(--red)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCalorieSave(); if (e.key === 'Escape') handleCalorieSkip(); }}
            />
            <span className="text-[13px] font-semibold text-[var(--muted)]">kcal</span>
          </div>
          {calorieError && <p className="text-[11px] text-[var(--red)]">{calorieError}</p>}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCalorieSkip}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-[var(--muted)] text-[13px] font-semibold uppercase tracking-[0.06em] bg-none cursor-pointer hover:border-[var(--muted)] transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleCalorieSave}
            disabled={calorieSaving}
            className="flex-1 py-2.5 rounded-lg bg-[var(--red)] text-white text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {calorieSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )}
  ```

- [ ] **Step 5: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 6: Smoke test**

  Run `npm run dev`. Start and finish a workout. Verify:
  - Calorie modal appears after finishing
  - Skip navigates back without crashing
  - Saving a number works and navigates back
  - Invalid input shows the error message

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/LiveWorkout.tsx
  git commit -m "feat: add post-finish calorie modal to LiveWorkout"
  ```

---

## Task 3: Calorie chart + inline edit in ProgressView

**Files:**
- Modify: `src/components/ProgressView.tsx`

Adds: (1) a 3-button date-range toggle that controls a calorie bar chart, (2) summary stats row (total / avg / max), and (3) an inline calorie edit field in the workout detail modal.

- [ ] **Step 1: Add `updateDoc` and `doc` to the Firestore import**

  In `src/components/ProgressView.tsx`, line 2, change:
  ```ts
  import { collection, query, where, getDocs, doc, deleteDoc, limit } from 'firebase/firestore';
  ```
  To:
  ```ts
  import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, limit } from 'firebase/firestore';
  ```

- [ ] **Step 2: Add `Pencil` to the Lucide import**

  Line 8, change:
  ```ts
  import { X, Trash2 } from 'lucide-react';
  ```
  To:
  ```ts
  import { X, Trash2, Pencil } from 'lucide-react';
  ```

- [ ] **Step 3: Add date-range and calorie-edit state**

  After line 18 (`const [deleting, setDeleting] = useState(false);`), add:
  ```ts
  const [dateRange, setDateRange] = useState<'week' | '30days' | 'alltime'>('week');
  const [editingCalorieId, setEditingCalorieId] = useState<string | null>(null);
  const [calorieEditValue, setCalorieEditValue] = useState('');
  const [calorieSaving, setCalorieSaving] = useState(false);
  ```

- [ ] **Step 4: Add calorie-range helpers below the existing `weeklySummary` block (before `return`)**

  After the `weeklySummary` block (around line 90), add:

  ```ts
  // Calorie chart helpers
  const now = Date.now();
  const msPerDay = 86_400_000;
  const calorieLogs = (() => {
    if (dateRange === 'week') {
      return logs.filter(l => l.calories != null && l.date >= weekStart.getTime() && l.date <= weekEnd.getTime());
    }
    if (dateRange === '30days') {
      return logs.filter(l => l.calories != null && l.date >= now - 30 * msPerDay);
    }
    return logs.filter(l => l.calories != null);
  })();

  const totalCalories = calorieLogs.reduce((s, l) => s + (l.calories || 0), 0);
  const avgCalories = calorieLogs.length > 0 ? Math.round(totalCalories / calorieLogs.length) : 0;
  const maxCalories = calorieLogs.length > 0 ? Math.max(...calorieLogs.map(l => l.calories || 0)) : 0;

  // Build bar chart data: one entry per day in range
  const barDays: { label: string; date: Date; calories: number }[] = (() => {
    const days: { label: string; date: Date; calories: number }[] = [];
    const count = dateRange === 'week' ? 7 : dateRange === '30days' ? 30 : Math.min(90, Math.ceil((now - (logs[0]?.date || now)) / msPerDay) + 1);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now - i * msPerDay);
      const dayLogs = logs.filter(l => l.calories != null && isSameDay(new Date(l.date), d));
      const cal = dayLogs.reduce((s, l) => s + (l.calories || 0), 0);
      days.push({ label: format(d, dateRange === 'week' ? 'EEE' : 'd'), date: d, calories: cal });
    }
    return days;
  })();

  const handleCalorieEdit = async (logId: string) => {
    const val = parseInt(calorieEditValue, 10);
    if (isNaN(val) || val < 0) return;
    setCalorieSaving(true);
    try {
      await updateDoc(doc(db, 'workoutLogs', logId), { calories: val });
      setLogs(logs.map(l => l.id === logId ? { ...l, calories: val } : l));
      setEditingCalorieId(null);
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, `workoutLogs/${logId}`);
    } finally {
      setCalorieSaving(false);
    }
  };
  ```

- [ ] **Step 5: Add the date-range toggle + calorie section to the JSX**

  In the `return` block, after the closing `</div>` of the header section (after the prev/next week buttons, around the `</div>` closing the header flex), add the date-range toggle and calorie section. Insert this **between the header and the calendar grid**:

  ```tsx
  {/* ── DATE RANGE TOGGLE ── */}
  <div className="flex gap-1 mb-6 p-1 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg w-fit">
    {(['week', '30days', 'alltime'] as const).map(r => (
      <button
        key={r}
        onClick={() => setDateRange(r)}
        className={`px-4 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors border-none
          ${dateRange === r ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-sm' : 'bg-none text-[var(--stone)] hover:text-[var(--ash)]'}`}
        style={condensed}
      >
        {r === 'week' ? 'This Week' : r === '30days' ? 'Last 30 Days' : 'All Time'}
      </button>
    ))}
  </div>

  {/* ── CALORIE BAR CHART ── */}
  <div className="border border-[var(--hairline)] rounded-lg overflow-hidden mb-6">
    <div className="px-5 py-3.5 border-b border-[var(--hairline)] flex items-center justify-between">
      <span className="text-[13px] font-semibold text-[var(--ink)]">Calories Burnt</span>
      {calorieLogs.length === 0 && (
        <span className="text-[11px] text-[var(--stone)]" style={condensed}>No calorie data in range</span>
      )}
    </div>
    {calorieLogs.length > 0 && (
      <>
        {/* SVG bar chart */}
        <div className="px-5 pt-4 pb-2 overflow-x-auto">
          <svg
            width={Math.max(barDays.length * 20, 300)}
            height={100}
            viewBox={`0 0 ${Math.max(barDays.length * 20, 300)} 100`}
            style={{ display: 'block', minWidth: '100%' }}
          >
            {barDays.map((d, i) => {
              const barH = maxCalories > 0 ? Math.round((d.calories / maxCalories) * 72) : 0;
              const x = i * (Math.max(barDays.length * 20, 300) / barDays.length);
              const barW = Math.max((Math.max(barDays.length * 20, 300) / barDays.length) - 4, 4);
              return (
                <g key={d.label + i}>
                  {d.calories > 0 ? (
                    <rect
                      x={x + 2}
                      y={80 - barH}
                      width={barW}
                      height={barH}
                      rx={2}
                      fill="var(--action)"
                      opacity={0.85}
                    />
                  ) : (
                    <rect
                      x={x + 2}
                      y={8}
                      width={barW}
                      height={72}
                      rx={2}
                      fill="none"
                      stroke="var(--hairline-2)"
                      strokeDasharray="3 2"
                    />
                  )}
                  <text
                    x={x + barW / 2 + 2}
                    y={96}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--stone)"
                    fontFamily="'Barlow Condensed', sans-serif"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        {/* Summary row */}
        <div className="grid grid-cols-3 border-t border-[var(--hairline)]">
          {[
            { label: 'Total', value: `${totalCalories.toLocaleString()} kcal` },
            { label: 'Avg / Session', value: `${avgCalories.toLocaleString()} kcal` },
            { label: 'Best Session', value: `${maxCalories.toLocaleString()} kcal` },
          ].map((stat, i) => (
            <div key={stat.label} className={`px-5 py-3 ${i < 2 ? 'border-r border-[var(--hairline)]' : ''}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-0.5" style={condensed}>{stat.label}</p>
              <p className="text-[16px] font-black text-[var(--action)]" style={condensed}>{stat.value}</p>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
  ```

- [ ] **Step 6: Add inline calorie edit to the workout detail modal**

  In the workout detail modal header section (around line 262 where the workout name and date are shown), add a calorie row after the date line:

  ```tsx
  {/* Calorie edit row */}
  <div className="flex items-center gap-2 mt-2">
    {editingCalorieId === selectedWorkout.id ? (
      <>
        <input
          type="number"
          min="0"
          value={calorieEditValue}
          onChange={e => setCalorieEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && selectedWorkout.id) handleCalorieEdit(selectedWorkout.id);
            if (e.key === 'Escape') setEditingCalorieId(null);
          }}
          onBlur={() => selectedWorkout.id && handleCalorieEdit(selectedWorkout.id)}
          className="w-24 bg-[var(--surface)] border border-[var(--action)] rounded px-2 py-1 text-[12px] font-mono text-[var(--ink)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          autoFocus
          disabled={calorieSaving}
        />
        <span className="text-[11px] text-[var(--stone)]" style={condensed}>kcal</span>
      </>
    ) : (
      <button
        onClick={() => {
          setEditingCalorieId(selectedWorkout.id || null);
          setCalorieEditValue(selectedWorkout.calories?.toString() || '');
        }}
        className="flex items-center gap-1.5 text-[11px] text-[var(--stone)] hover:text-[var(--ash)] transition-colors bg-none border-none cursor-pointer p-0"
        style={condensed}
      >
        <Pencil className="w-3 h-3" />
        {selectedWorkout.calories != null
          ? `${selectedWorkout.calories} kcal`
          : 'Add calories'}
      </button>
    )}
  </div>
  ```

- [ ] **Step 7: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 8: Smoke test**

  Run `npm run dev`. In Analytics:
  - Date-range toggle renders, buttons switch active state
  - No calorie data → shows "No calorie data in range" message
  - After logging a workout with calories → bar chart renders with correct bar heights
  - Pencil edit in workout modal saves and reflects immediately

- [ ] **Step 9: Commit**

  ```bash
  git add src/components/ProgressView.tsx
  git commit -m "feat: add calorie bar chart, date-range selector, and inline calorie edit to Analytics"
  ```

---

## Task 4: Add Habits tab to Layout and App

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Habits to the `navTabs` array in Layout**

  In `src/components/Layout.tsx`, find the `navTabs` array (starts at line 9). Add the Habits tab entry after `progress`:

  ```ts
  { id: 'habits', label: 'Habits', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )},
  ```

  The full `navTabs` array becomes:
  ```ts
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
  ```

- [ ] **Step 2: Add HabitTracker to App.tsx**

  In `src/App.tsx`, add the import after the existing component imports:
  ```ts
  import { HabitTracker } from './components/HabitTracker';
  ```

  Then in the `return` block inside `MainView`, add the habits tab panel after the `progress` block (around line 63):

  ```tsx
  {mountedTabs.has('habits') && (
    <div style={{ display: tab === 'habits' ? 'contents' : 'none' }} aria-hidden={tab !== 'habits'} inert={tab !== 'habits' ? ('' as unknown as boolean) : undefined}>
      <HabitTracker />
    </div>
  )}
  ```

- [ ] **Step 3: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors (HabitTracker doesn't exist yet — this will error until Task 5. Run lint after Task 5.)

- [ ] **Step 4: Commit (after Task 5 passes lint)**

  Hold this commit — combine with Task 5 commit below.

---

## Task 5: Create HabitTracker component

**Files:**
- Create: `src/components/HabitTracker.tsx`

This is the largest task. Build it in three logical sub-steps: data layer → habit cards + CRUD modals → heatmap + stats.

- [ ] **Step 1: Create the file with imports, types, and data-fetch skeleton**

  Create `src/components/HabitTracker.tsx`:

  ```tsx
  import React, { useEffect, useState, useMemo } from 'react';
  import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
  import { db } from '../firebase';
  import { handleFirestoreError, OperationType } from '../firestoreUtils';
  import { useAuth } from '../AuthContext';
  import { Habit, HabitLog } from '../types';
  import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, subWeeks, isSameDay } from 'date-fns';
  import { Plus, MoreVertical, Pencil, Archive, ArchiveRestore } from 'lucide-react';

  const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

  // ── Heatmap cell helper ──────────────────────────────────────────────────────

  function getCellColor(actual: number | undefined, target: number): string {
    if (actual == null) return 'var(--surface)';
    if (actual === 0) return 'var(--hairline-2)';
    if (actual >= target) return '#22c55e';
    if (actual >= target * 0.5) return '#f59e0b';
    return '#ef444466';
  }

  // ── Streak helpers ───────────────────────────────────────────────────────────

  function computeStreaks(logs: HabitLog[], target: number): { current: number; longest: number; hitRate: number } {
    if (logs.length === 0) return { current: 0, longest: 0, hitRate: 0 };

    const byDate: Record<string, number> = {};
    logs.forEach(l => { byDate[l.date] = l.actual; });

    const hits = Object.values(byDate).filter(v => v >= target).length;
    const hitRate = Math.round((hits / Object.keys(byDate).length) * 100);

    // Current streak: walk backwards from today
    let current = 0;
    let d = new Date();
    while (true) {
      const key = format(d, 'yyyy-MM-dd');
      if (byDate[key] != null && byDate[key] >= target) {
        current++;
        d = subDays(d, 1);
      } else {
        break;
      }
    }

    // Longest streak
    const sortedDates = Object.keys(byDate).sort();
    let longest = 0;
    let temp = 0;
    for (const dateStr of sortedDates) {
      if (byDate[dateStr] >= target) {
        temp++;
        longest = Math.max(longest, temp);
      } else {
        temp = 0;
      }
    }

    return { current, longest, hitRate };
  }

  // ── Heatmap component ────────────────────────────────────────────────────────

  const Heatmap: React.FC<{
    logs: HabitLog[];
    habit: Habit;
    dateRange: 'week' | '30days' | 'alltime';
  }> = ({ logs, habit, dateRange }) => {
    const byDate: Record<string, number> = {};
    logs.forEach(l => { byDate[l.date] = l.actual; });

    const today = new Date();
    const CELL = 13;
    const GAP = 2;
    const STEP = CELL + GAP;

    if (dateRange === 'week') {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const w = days.length * STEP;
      return (
        <svg width={w} height={CELL} viewBox={`0 0 ${w} ${CELL}`} style={{ display: 'block' }}>
          {days.map((d, i) => {
            const key = format(d, 'yyyy-MM-dd');
            return (
              <rect
                key={key}
                x={i * STEP}
                y={0}
                width={CELL}
                height={CELL}
                rx={2}
                fill={getCellColor(byDate[key], habit.target)}
              >
                <title>{format(d, 'MMM d')} — {byDate[key] != null ? `${byDate[key]} / ${habit.target} ${habit.unit}` : 'No data'}</title>
              </rect>
            );
          })}
        </svg>
      );
    }

    if (dateRange === '30days') {
      const days = Array.from({ length: 30 }, (_, i) => subDays(today, 29 - i));
      const w = days.length * STEP;
      return (
        <svg width={w} height={CELL} viewBox={`0 0 ${w} ${CELL}`} style={{ display: 'block', maxWidth: '100%' }}>
          {days.map((d, i) => {
            const key = format(d, 'yyyy-MM-dd');
            return (
              <rect key={key} x={i * STEP} y={0} width={CELL} height={CELL} rx={2} fill={getCellColor(byDate[key], habit.target)}>
                <title>{format(d, 'MMM d')} — {byDate[key] != null ? `${byDate[key]} / ${habit.target} ${habit.unit}` : 'No data'}</title>
              </rect>
            );
          })}
        </svg>
      );
    }

    // All time: 52 cols × 7 rows
    const COLS = 52;
    const ROWS = 7;
    const startDate = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), COLS - 1);
    const w = COLS * STEP;
    const h = ROWS * STEP;

    const cells: { x: number; y: number; key: string; d: Date }[] = [];
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + col * 7 + row);
        if (d > today) continue;
        cells.push({ x: col * STEP, y: row * STEP, key: format(d, 'yyyy-MM-dd'), d });
      }
    }

    return (
      <div className="overflow-x-auto">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
          {cells.map(c => (
            <rect key={c.key} x={c.x} y={c.y} width={CELL} height={CELL} rx={2} fill={getCellColor(byDate[c.key], habit.target)}>
              <title>{format(c.d, 'MMM d')} — {byDate[c.key] != null ? `${byDate[c.key]} / ${habit.target} ${habit.unit}` : 'No data'}</title>
            </rect>
          ))}
        </svg>
      </div>
    );
  };

  // ── Main component ───────────────────────────────────────────────────────────

  export const HabitTracker: React.FC = () => {
    const { user } = useAuth();
    const [habits, setHabits] = useState<Habit[]>([]);
    const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false);
    const [dateRange, setDateRange] = useState<'week' | '30days' | 'alltime'>('alltime');

    // Modal state
    const [showHabitModal, setShowHabitModal] = useState(false);
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
    const [habitForm, setHabitForm] = useState({ name: '', target: '', unit: '' });
    const [habitSaving, setHabitSaving] = useState(false);
    const [habitError, setHabitError] = useState('');

    // Log modal state
    const [loggingHabit, setLoggingHabit] = useState<Habit | null>(null);
    const [logValue, setLogValue] = useState('');
    const [logSaving, setLogSaving] = useState(false);
    const [logError, setLogError] = useState('');

    // Kebab menu state
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    useEffect(() => {
      if (!user) return;
      const fetchAll = async () => {
        setLoading(true);
        try {
          const [habitsSnap, logsSnap] = await Promise.all([
            getDocs(query(collection(db, 'habits'), where('userId', '==', user.uid))),
            getDocs(query(collection(db, 'habitLogs'), where('userId', '==', user.uid))),
          ]);
          const fetchedHabits: Habit[] = [];
          habitsSnap.forEach(d => fetchedHabits.push({ id: d.id, ...d.data() } as Habit));
          const fetchedLogs: HabitLog[] = [];
          logsSnap.forEach(d => fetchedLogs.push({ id: d.id, ...d.data() } as HabitLog));
          setHabits(fetchedHabits.sort((a, b) => a.createdAt - b.createdAt));
          setHabitLogs(fetchedLogs);
        } catch(e) {
          handleFirestoreError(e, OperationType.LIST, 'habits');
        } finally {
          setLoading(false);
        }
      };
      fetchAll();
    }, [user?.uid]);

    const today = format(new Date(), 'yyyy-MM-dd');

    const getTodayLog = (habitId: string) =>
      habitLogs.find(l => l.habitId === habitId && l.date === today);

    const getLogsForHabit = (habitId: string) =>
      habitLogs.filter(l => l.habitId === habitId);

    // ── Habit save (create / edit) ─────────────────────────────────────────────
    const handleHabitSave = async () => {
      const name = habitForm.name.trim();
      const target = parseFloat(habitForm.target);
      const unit = habitForm.unit.trim();
      if (!name || isNaN(target) || target <= 0 || !unit) {
        setHabitError('All fields are required. Target must be a positive number.');
        return;
      }
      if (!user) return;
      setHabitSaving(true);
      try {
        if (editingHabit) {
          await updateDoc(doc(db, 'habits', editingHabit.id), { name, target, unit });
          setHabits(habits.map(h => h.id === editingHabit.id ? { ...h, name, target, unit } : h));
        } else {
          const docRef = await addDoc(collection(db, 'habits'), {
            userId: user.uid, name, target, unit, createdAt: Date.now(), archived: false
          });
          setHabits([...habits, { id: docRef.id, userId: user.uid, name, target, unit, createdAt: Date.now(), archived: false }]);
        }
        setShowHabitModal(false);
        setEditingHabit(null);
        setHabitForm({ name: '', target: '', unit: '' });
      } catch(e) {
        handleFirestoreError(e, editingHabit ? OperationType.UPDATE : OperationType.CREATE, 'habits');
        setHabitError('Failed to save. Try again.');
      } finally {
        setHabitSaving(false);
      }
    };

    const handleArchive = async (habit: Habit) => {
      try {
        await updateDoc(doc(db, 'habits', habit.id), { archived: !habit.archived });
        setHabits(habits.map(h => h.id === habit.id ? { ...h, archived: !h.archived } : h));
        setOpenMenuId(null);
      } catch(e) {
        handleFirestoreError(e, OperationType.UPDATE, `habits/${habit.id}`);
      }
    };

    // ── Daily log upsert ───────────────────────────────────────────────────────
    const handleLogSave = async () => {
      if (!loggingHabit || !user) return;
      const val = parseFloat(logValue);
      if (isNaN(val) || val < 0) {
        setLogError('Enter a valid number');
        return;
      }
      setLogSaving(true);
      try {
        const existing = getTodayLog(loggingHabit.id);
        if (existing) {
          await updateDoc(doc(db, 'habitLogs', existing.id), { actual: val });
          setHabitLogs(habitLogs.map(l => l.id === existing.id ? { ...l, actual: val } : l));
        } else {
          const docRef = await addDoc(collection(db, 'habitLogs'), {
            userId: user.uid, habitId: loggingHabit.id, date: today, actual: val, createdAt: Date.now()
          });
          setHabitLogs([...habitLogs, { id: docRef.id, userId: user.uid, habitId: loggingHabit.id, date: today, actual: val, createdAt: Date.now() }]);
        }
        setLoggingHabit(null);
        setLogValue('');
        setLogError('');
      } catch(e) {
        handleFirestoreError(e, OperationType.WRITE, 'habitLogs');
        setLogError('Failed to save. Try again.');
      } finally {
        setLogSaving(false);
      }
    };

    const visibleHabits = habits.filter(h => showArchived ? true : !h.archived);

    if (loading) {
      return <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--stone)] text-center py-10" style={condensed}>Loading Habits…</p>;
    }

    return (
      <div className="flex flex-col gap-0">

        {/* ── HEADER ── */}
        <div className="flex items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
          <h1 className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none" style={{ ...condensed, letterSpacing: '-0.02em' }}>
            Habits
          </h1>
          <button
            onClick={() => { setEditingHabit(null); setHabitForm({ name: '', target: '', unit: '' }); setHabitError(''); setShowHabitModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--action)] text-white rounded-lg text-[12px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity border-none shrink-0"
            style={condensed}
          >
            <Plus className="w-4 h-4" />
            New Habit
          </button>
        </div>

        {/* ── DATE RANGE TOGGLE ── */}
        <div className="flex gap-1 mb-6 p-1 bg-[var(--surface)] border border-[var(--hairline)] rounded-lg w-fit">
          {(['week', '30days', 'alltime'] as const).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-4 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors border-none
                ${dateRange === r ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-sm' : 'bg-none text-[var(--stone)] hover:text-[var(--ash)]'}`}
              style={condensed}
            >
              {r === 'week' ? 'This Week' : r === '30days' ? 'Last 30 Days' : 'All Time'}
            </button>
          ))}
        </div>

        {/* ── EMPTY STATE ── */}
        {visibleHabits.length === 0 && (
          <div className="border border-[var(--hairline)] rounded-lg px-6 py-12 text-center">
            <p className="text-[13px] text-[var(--stone)]" style={condensed}>No habits yet. Create one to start tracking.</p>
          </div>
        )}

        {/* ── HABIT CARDS ── */}
        <div className="flex flex-col gap-4">
          {visibleHabits.map(habit => {
            const todayLog = getTodayLog(habit.id);
            const logs = getLogsForHabit(habit.id);
            const { current, longest, hitRate } = computeStreaks(logs, habit.target);
            return (
              <div key={habit.id} className={`border border-[var(--hairline)] rounded-lg overflow-hidden ${habit.archived ? 'opacity-50' : ''}`}>

                {/* Card header */}
                <div className="px-5 py-4 border-b border-[var(--hairline)] flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-black uppercase text-[var(--ink)] leading-tight" style={condensed}>{habit.name}</h3>
                    <p className="text-[11px] text-[var(--stone)] mt-0.5" style={condensed}>Target: {habit.target} {habit.unit} / day</p>
                    {todayLog ? (
                      <p className="text-[12px] font-semibold mt-1" style={{ ...condensed, color: todayLog.actual >= habit.target ? '#22c55e' : 'var(--action)' }}>
                        Today: {todayLog.actual} {habit.unit}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[var(--stone)] mt-1" style={condensed}>Not logged today</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setLoggingHabit(habit); setLogValue(todayLog?.actual.toString() || ''); setLogError(''); }}
                      className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--hairline-2)] rounded-md text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ash)] hover:border-[var(--ash)] cursor-pointer transition-colors border-none"
                      style={condensed}
                    >
                      {todayLog ? 'Edit today' : 'Log today'}
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === habit.id ? null : habit.id)}
                        className="w-8 h-8 flex items-center justify-center text-[var(--stone)] hover:text-[var(--ash)] cursor-pointer bg-none border-none"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === habit.id && (
                        <div className="absolute right-0 top-9 z-20 bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg shadow-lg w-36 py-1">
                          <button
                            onClick={() => { setEditingHabit(habit); setHabitForm({ name: habit.name, target: habit.target.toString(), unit: habit.unit }); setHabitError(''); setShowHabitModal(true); setOpenMenuId(null); }}
                            className="w-full text-left px-4 py-2 text-[12px] text-[var(--ash)] hover:bg-[var(--surface-2)] cursor-pointer flex items-center gap-2 bg-none border-none"
                            style={condensed}
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleArchive(habit)}
                            className="w-full text-left px-4 py-2 text-[12px] text-[var(--ash)] hover:bg-[var(--surface-2)] cursor-pointer flex items-center gap-2 bg-none border-none"
                            style={condensed}
                          >
                            {habit.archived ? <><ArchiveRestore className="w-3.5 h-3.5" /> Unarchive</> : <><Archive className="w-3.5 h-3.5" /> Archive</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Heatmap */}
                <div className="px-5 py-4 border-b border-[var(--hairline)]">
                  <Heatmap logs={logs} habit={habit} dateRange={dateRange} />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4">
                  {[
                    { label: 'Days Logged', value: logs.length },
                    { label: 'Hit Rate', value: `${hitRate}%` },
                    { label: 'Streak', value: current },
                    { label: 'Best Streak', value: longest },
                  ].map((stat, i) => (
                    <div key={stat.label} className={`px-4 py-3 ${i < 3 ? 'border-r border-[var(--hairline)]' : ''}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-0.5" style={condensed}>{stat.label}</p>
                      <p className="text-[16px] font-black text-[var(--action)]" style={condensed}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── SHOW ARCHIVED TOGGLE ── */}
        {habits.some(h => h.archived) && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--stone)] hover:text-[var(--ash)] cursor-pointer bg-none border-none p-0"
            style={condensed}
          >
            {showArchived ? 'Hide archived' : `Show archived (${habits.filter(h => h.archived).length})`}
          </button>
        )}

        {/* ── HABIT CREATE/EDIT MODAL ── */}
        {showHabitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-xl w-full max-w-[400px] p-6 flex flex-col gap-5">
              <h2 className="text-[20px] font-black uppercase text-[var(--ink)]" style={condensed}>
                {editingHabit ? 'Edit Habit' : 'New Habit'}
              </h2>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Name', key: 'name', placeholder: 'e.g. Intermittent Fasting', type: 'text' },
                  { label: 'Daily Target', key: 'target', placeholder: 'e.g. 16', type: 'number' },
                  { label: 'Unit', key: 'unit', placeholder: 'e.g. hours, liters, steps', type: 'text' },
                ].map(field => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--stone)]" style={condensed}>{field.label}</label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={habitForm[field.key as keyof typeof habitForm]}
                      onChange={e => setHabitForm({ ...habitForm, [field.key]: e.target.value })}
                      className="bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-4 py-2.5 text-[var(--ink)] text-[14px] outline-none focus:border-[var(--action)] transition-colors"
                    />
                  </div>
                ))}
                {habitError && <p className="text-[11px] text-[var(--action)]">{habitError}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowHabitModal(false); setEditingHabit(null); }}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--hairline)] text-[var(--stone)] text-[13px] font-semibold uppercase tracking-[0.06em] bg-none cursor-pointer hover:border-[var(--ash)] transition-colors"
                  style={condensed}
                >
                  Cancel
                </button>
                <button
                  onClick={handleHabitSave}
                  disabled={habitSaving}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--action)] text-white text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 border-none"
                  style={condensed}
                >
                  {habitSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LOG TODAY MODAL ── */}
        {loggingHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-xl w-full max-w-[360px] p-6 flex flex-col gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1]" style={condensed}>{format(new Date(), 'MMM dd, yyyy')}</p>
                <h2 className="text-[20px] font-black uppercase text-[var(--ink)]" style={condensed}>{loggingHabit.name}</h2>
                <p className="text-[11px] text-[var(--stone)] mt-0.5" style={condensed}>Target: {loggingHabit.target} {loggingHabit.unit}</p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--stone)]" style={condensed}>Actual</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder={`e.g. ${loggingHabit.target}`}
                    value={logValue}
                    onChange={e => { setLogValue(e.target.value); setLogError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleLogSave(); if (e.key === 'Escape') setLoggingHabit(null); }}
                    className="flex-1 bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-4 py-2.5 text-[var(--ink)] text-[15px] font-mono outline-none focus:border-[var(--action)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                  <span className="text-[13px] font-semibold text-[var(--stone)]" style={condensed}>{loggingHabit.unit}</span>
                </div>
                {logError && <p className="text-[11px] text-[var(--action)]">{logError}</p>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setLoggingHabit(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--hairline)] text-[var(--stone)] text-[13px] font-semibold uppercase tracking-[0.06em] bg-none cursor-pointer hover:border-[var(--ash)] transition-colors"
                  style={condensed}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogSave}
                  disabled={logSaving}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--action)] text-white text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 border-none"
                  style={condensed}
                >
                  {logSaving ? 'Saving…' : 'Log'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close kebab on outside click */}
        {openMenuId && (
          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
        )}
      </div>
    );
  };
  ```

- [ ] **Step 2: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 3: Smoke test the Habits tab**

  Run `npm run dev`. Navigate to Habits tab:
  - "New Habit" button opens modal
  - Create a habit — appears in the list immediately
  - "Log today" opens log modal, saves, shows "Edit today" on card
  - Log the same habit again — value updates (upsert)
  - Date range toggle changes heatmap layout (week = 7 cells, 30days = strip, all time = grid)
  - Edit habit via kebab menu — name/target/unit update on save
  - Archive habit — disappears from list
  - "Show archived" toggle reveals it with muted styling
  - Unarchive via kebab — habit returns to active list
  - Stats row shows days logged, hit rate, streak, best streak

- [ ] **Step 4: Commit Layout, App, and HabitTracker together**

  ```bash
  git add src/components/Layout.tsx src/App.tsx src/components/HabitTracker.tsx
  git commit -m "feat: add Habits tab with custom habits, daily logging, heatmap, and streak stats"
  ```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `calories?` on workoutLogs | Task 1 ✓ |
| Post-finish calorie modal (save/skip) | Task 2 ✓ |
| Calorie edit in Analytics | Task 3 ✓ |
| Bar chart with empty outlines for no-data days | Task 3 ✓ |
| Summary row (total / avg / best) | Task 3 ✓ |
| Date-range toggle (week/30days/alltime) | Task 3 + Task 5 ✓ |
| Habits tab in nav | Task 4 ✓ |
| Lazy-mount for Habits tab | Task 4 ✓ |
| Habit CRUD (create/edit/archive/unarchive) | Task 5 ✓ |
| Daily log with upsert | Task 5 ✓ |
| "Log today" / "Edit today" toggle | Task 5 ✓ |
| Heatmap (week/30days/all-time views) | Task 5 ✓ |
| Cell coloring (green/amber/red/empty) | Task 5 ✓ |
| Tooltip on hover/tap | Task 5 (SVG `<title>`) ✓ |
| Summary stats (days, hit rate, streak, best) | Task 5 ✓ |
| Show archived toggle | Task 5 ✓ |
| `handleFirestoreError` on all writes | Tasks 2, 3, 5 ✓ |
| `Habit` + `HabitLog` TypeScript types | Task 1 ✓ |

**No placeholders found.** All code is complete.

**Type consistency:** `Habit`, `HabitLog` defined in Task 1, used correctly in Task 5. `calories` optional on `WorkoutLog` defined in Task 1, used in Tasks 2 and 3. `updateDoc`/`doc` imports added in Tasks 2 and 3 separately (each file imports independently — correct).

**One note for executor:** The `ArchiveRestore` icon requires Lucide React ≥ 0.263. Run `npx lucide-react --version` to verify. If not available, replace with a plain undo SVG inline.

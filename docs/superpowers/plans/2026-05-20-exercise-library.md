# Exercise Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal exercise library that auto-populates from saved routines, deduplicates by normalized name, provides an Exercises tab for managing body part mappings, integrates autocomplete into the routine builder, and supports merging duplicate exercises with full history retagging.

**Architecture:** A new Firestore collection `exerciseLibrary` stores per-user exercise entries. A shared React hook `useExerciseLibrary` fetches the library and exposes mutation helpers used by the new `ExerciseLibrary` tab component, `CustomRoutineBuilder` (autocomplete + sync on save), and `RoutineGenerator` (sync on save). The merge operation uses a Firestore batch write to atomically retag all `workoutLogs` and `routines` before deleting the secondary entry.

**Tech Stack:** React 19, TypeScript, Firebase Firestore (v12), Tailwind CSS v4, Lucide React icons, Barlow Condensed font (existing pattern)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types.ts` | Add `ExerciseEntry` interface + `normalizeExerciseName` util |
| Create | `src/hooks/useExerciseLibrary.ts` | Fetch library, `addToLibrary`, `updateBodyPart`, `mergeExercises` |
| Modify | `src/components/Layout.tsx` | Add Exercises nav item between Generate and Analytics |
| Modify | `src/App.tsx` | Mount `ExerciseLibrary` tab with lazy-mount CSS display pattern |
| Create | `src/components/ExerciseLibrary.tsx` | Full tab: grouped list, inline edit, add modal, merge modal |
| Modify | `src/components/CustomRoutineBuilder.tsx` | Autocomplete suggestions + sync library on save |
| Modify | `src/components/RoutineGenerator.tsx` | Sync library on save |

---

## Task 1: Add ExerciseEntry type and normalize util

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add ExerciseEntry interface and normalizeExerciseName to src/types.ts**

Append to the end of the file:

```ts
export interface ExerciseEntry {
  id: string;
  userId: string;
  name: string;
  nameKey: string;
  bodyPart: BodyPart;
  type: 'strength' | 'cardio';
  createdAt: number;
}

export const normalizeExerciseName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, '');
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "gym-workout-tracker" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add ExerciseEntry type and normalizeExerciseName util"
```

---

## Task 2: Create useExerciseLibrary hook

**Files:**
- Create: `src/hooks/useExerciseLibrary.ts`

- [ ] **Step 1: Create the hooks directory and hook file**

```bash
mkdir -p src/hooks
```

Create `src/hooks/useExerciseLibrary.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { ExerciseEntry, BodyPart, normalizeExerciseName } from '../types';
import { handleFirestoreError, OperationType } from '../firestoreUtils';

export function useExerciseLibrary() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'exerciseLibrary'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const fetched: ExerciseEntry[] = [];
      snap.forEach(d => fetched.push({ id: d.id, ...d.data() } as ExerciseEntry));
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setEntries(fetched);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'exerciseLibrary');
      setError('Failed to load exercise library');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const addToLibrary = useCallback(async (
    name: string,
    bodyPart: BodyPart,
    type: 'strength' | 'cardio'
  ): Promise<void> => {
    if (!user || !name.trim()) return;
    const nameKey = normalizeExerciseName(name);
    if (entries.some(e => e.nameKey === nameKey)) return;
    try {
      const docRef = await addDoc(collection(db, 'exerciseLibrary'), {
        userId: user.uid,
        name: name.trim(),
        nameKey,
        bodyPart,
        type,
        createdAt: Date.now(),
      });
      const newEntry: ExerciseEntry = {
        id: docRef.id,
        userId: user.uid,
        name: name.trim(),
        nameKey,
        bodyPart,
        type,
        createdAt: Date.now(),
      };
      setEntries(prev =>
        prev.some(e => e.nameKey === nameKey)
          ? prev
          : [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'exerciseLibrary');
    }
  }, [user, entries]);

  const updateBodyPart = useCallback(async (id: string, newBodyPart: BodyPart): Promise<void> => {
    // Optimistic update
    setEntries(prev => prev.map(e => e.id === id ? { ...e, bodyPart: newBodyPart } : e));
    try {
      await updateDoc(doc(db, 'exerciseLibrary', id), { bodyPart: newBodyPart });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `exerciseLibrary/${id}`);
      // Revert on failure
      await fetchEntries();
      throw e;
    }
  }, [fetchEntries]);

  const mergeExercises = useCallback(async (
    primary: ExerciseEntry,
    secondary: ExerciseEntry
  ): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const batch = writeBatch(db);

    // Retag workoutLogs
    const logsSnap = await getDocs(
      query(collection(db, 'workoutLogs'), where('userId', '==', user.uid))
    );
    logsSnap.forEach(logDoc => {
      const exs = (logDoc.data().exercises ?? []) as Array<Record<string, unknown>>;
      if (exs.some(ex => normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey)) {
        batch.update(logDoc.ref, {
          exercises: exs.map(ex =>
            normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey
              ? { ...ex, name: primary.name, bodyPart: primary.bodyPart }
              : ex
          ),
        });
      }
    });

    // Retag routines
    const routinesSnap = await getDocs(
      query(collection(db, 'routines'), where('userId', '==', user.uid))
    );
    routinesSnap.forEach(routineDoc => {
      const exs = (routineDoc.data().exercises ?? []) as Array<Record<string, unknown>>;
      if (exs.some(ex => normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey)) {
        batch.update(routineDoc.ref, {
          exercises: exs.map(ex =>
            normalizeExerciseName(String(ex.name ?? '')) === secondary.nameKey
              ? { ...ex, name: primary.name, bodyPart: primary.bodyPart }
              : ex
          ),
        });
      }
    });

    // Delete secondary from library
    batch.delete(doc(db, 'exerciseLibrary', secondary.id));

    await batch.commit(); // throws on failure — caller catches
    setEntries(prev => prev.filter(e => e.id !== secondary.id));
  }, [user]);

  return { entries, loading, error, addToLibrary, updateBodyPart, mergeExercises };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useExerciseLibrary.ts
git commit -m "feat: add useExerciseLibrary hook with add, updateBodyPart, merge"
```

---

## Task 3: Wire Exercises tab into nav and App

**Files:**
- Modify: `src/components/Layout.tsx:11-40` (navTabs array)
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Exercises nav item to Layout.tsx**

In `src/components/Layout.tsx`, find the `navTabs` array. Insert the Exercises entry **after** the `generate` entry and **before** the `progress` entry:

```ts
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
```

- [ ] **Step 2: Mount ExerciseLibrary in App.tsx**

In `src/App.tsx`:

1. Add import at the top with the other component imports:
```ts
import { ExerciseLibrary } from './components/ExerciseLibrary';
```

2. Add the exercises tab mount block after the `generate` block (before the `custom` block):
```tsx
{mountedTabs.has('exercises') && (
  <div style={{ display: tab === 'exercises' ? 'contents' : 'none' }} aria-hidden={tab !== 'exercises'} inert={tab !== 'exercises' ? ('' as unknown as boolean) : undefined}>
    <ExerciseLibrary />
  </div>
)}
```

> Note: `ExerciseLibrary` doesn't exist yet — TypeScript will error until Task 4 is complete. That's expected.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx src/App.tsx
git commit -m "feat: add Exercises tab to nav and App layout"
```

---

## Task 4: Create ExerciseLibrary component

**Files:**
- Create: `src/components/ExerciseLibrary.tsx`

- [ ] **Step 1: Create src/components/ExerciseLibrary.tsx**

```tsx
import React, { useState, useMemo } from 'react';
import { BODY_PARTS, BodyPart, ExerciseEntry } from '../types';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

export const ExerciseLibrary: React.FC = () => {
  const { entries, loading, error, addToLibrary, updateBodyPart, mergeExercises } = useExerciseLibrary();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addBodyPart, setAddBodyPart] = useState<BodyPart | ''>('');
  const [addType, setAddType] = useState<'strength' | 'cardio'>('strength');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Merge modal
  const [mergeSource, setMergeSource] = useState<ExerciseEntry | null>(null);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeTarget, setMergeTarget] = useState<ExerciseEntry | null>(null);
  const [mergeConfirming, setMergeConfirming] = useState(false);
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const closeMergeModal = () => {
    setMergeSource(null);
    setMergeTarget(null);
    setMergeConfirming(false);
    setMergeSearch('');
    setMergeError(null);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(e => e.name.toLowerCase().includes(q));
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map: Record<string, ExerciseEntry[]> = {};
    for (const entry of filtered) {
      if (!map[entry.bodyPart]) map[entry.bodyPart] = [];
      map[entry.bodyPart].push(entry);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleAddSave = async () => {
    if (!addName.trim()) { setAddError('Enter an exercise name.'); return; }
    if (!addBodyPart) { setAddError('Select a body part.'); return; }
    setAddSaving(true);
    setAddError('');
    await addToLibrary(addName, addBodyPart as BodyPart, addType);
    setAddSaving(false);
    setShowAddModal(false);
    setAddName('');
    setAddBodyPart('');
    setAddType('strength');
  };

  const handleMergeConfirm = async () => {
    if (!mergeSource || !mergeTarget) return;
    setMergeSaving(true);
    setMergeError(null);
    try {
      await mergeExercises(mergeTarget, mergeSource); // primary=target (keep), secondary=source (remove)
      showToast(`"${mergeSource.name}" merged into "${mergeTarget.name}"`);
      closeMergeModal();
    } catch {
      setMergeError('Merge failed. No changes were made. Try again.');
    } finally {
      setMergeSaving(false);
    }
  };

  const selectClass = "bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)]";

  if (loading) {
    return (
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--stone)] text-center py-10" style={condensed}>
        Loading…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--ink)] text-[var(--canvas)] px-4 py-2 rounded-full text-[12px] font-semibold shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-[var(--hairline)] gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--stone)] mb-1" style={condensed}>
            {entries.length} exercise{entries.length !== 1 ? 's' : ''} saved
          </p>
          <h1
            className="text-[36px] sm:text-[52px] font-black uppercase text-[var(--ink)] leading-none"
            style={{ ...condensed, letterSpacing: '-0.02em' }}
          >
            My Exercises
          </h1>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setAddName(''); setAddBodyPart(''); setAddType('strength'); setAddError(''); }}
          className="flex items-center gap-2 px-5 py-[10px] rounded-full bg-[var(--action)] text-white border-none text-[13px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:opacity-90 transition-opacity"
          style={condensed}
        >
          + Add Exercise
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-[var(--action)] text-center py-4 mb-4">{error}</p>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search exercises…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-4 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)] placeholder:text-[var(--stone)]"
        />
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="border border-dashed border-[var(--hairline-2)] rounded-lg py-10 text-center">
          <p className="text-[12px] uppercase tracking-[0.1em] text-[var(--stone)]" style={condensed}>
            No exercises yet — save a routine to populate your library.
          </p>
        </div>
      )}

      {/* Grouped list */}
      {grouped.map(([bodyPart, exs]) => (
        <div key={bodyPart} className="mb-6">
          <div
            className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--stone)] mb-2 pb-2 border-b border-[var(--hairline)] flex justify-between"
            style={condensed}
          >
            <span>{bodyPart}</span>
            <span>{exs.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            {exs.map(ex => (
              <div key={ex.id} className="flex justify-between items-center px-3 py-2.5 bg-[var(--surface)] rounded-lg">
                <span className="text-[13px] font-semibold text-[var(--ink)]">{ex.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-full px-2 py-0.5 text-[var(--stone)] uppercase tracking-[.06em]">
                    {ex.type}
                  </span>
                  {/* Inline body part edit */}
                  {editingId === ex.id ? (
                    <select
                      autoFocus
                      value={ex.bodyPart}
                      onChange={async e => {
                        await updateBodyPart(ex.id, e.target.value as BodyPart);
                        setEditingId(null);
                      }}
                      onBlur={() => setEditingId(null)}
                      className={selectClass}
                    >
                      {BODY_PARTS.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingId(ex.id)}
                      title="Edit body part"
                      className="text-[11px] text-[var(--stone)] hover:text-[var(--ink)] border-none bg-transparent cursor-pointer transition-colors px-1"
                    >
                      ✎
                    </button>
                  )}
                  <button
                    onClick={() => { setMergeSource(ex); setMergeSearch(''); setMergeTarget(null); setMergeConfirming(false); setMergeError(null); }}
                    className="text-[10px] font-bold text-[var(--action)] hover:opacity-75 border-none bg-transparent cursor-pointer transition-opacity uppercase tracking-[.04em]"
                  >
                    merge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── ADD MODAL ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-[var(--radius)] p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-[20px] font-black uppercase text-[var(--ink)] mb-5" style={condensed}>
              Add Exercise
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
                  Name
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Bench Press"
                  autoFocus
                  className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ash)] placeholder:text-[var(--stone)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
                  Body Part *
                </label>
                <select
                  value={addBodyPart}
                  onChange={e => setAddBodyPart(e.target.value as BodyPart)}
                  className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ash)]"
                >
                  <option value="" disabled>Select body part…</option>
                  {BODY_PARTS.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
                  Type
                </label>
                <div className="flex rounded-lg overflow-hidden border border-[var(--hairline-2)]">
                  <button
                    onClick={() => setAddType('strength')}
                    className={`flex-1 py-2 text-[12px] font-bold uppercase tracking-[.06em] border-none cursor-pointer transition-colors ${addType === 'strength' ? 'bg-[var(--ink)] text-[var(--canvas)]' : 'bg-[var(--surface)] text-[var(--stone)]'}`}
                  >
                    Strength
                  </button>
                  <button
                    onClick={() => setAddType('cardio')}
                    className={`flex-1 py-2 text-[12px] font-bold uppercase tracking-[.06em] border-none cursor-pointer transition-colors ${addType === 'cardio' ? 'bg-[var(--ink)] text-[var(--canvas)]' : 'bg-[var(--surface)] text-[var(--stone)]'}`}
                  >
                    Cardio
                  </button>
                </div>
              </div>
              {addError && <p className="text-[11px] text-[var(--action)]">{addError}</p>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-full border border-[var(--hairline-2)] text-[var(--stone)] text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer bg-transparent hover:border-[var(--ash)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSave}
                  disabled={addSaving || !addName.trim() || !addBodyPart}
                  className="flex-1 py-2.5 rounded-full bg-[var(--action)] text-white border-none text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {addSaving ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MERGE MODAL ── */}
      {mergeSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeMergeModal}
        >
          <div
            className="bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-[var(--radius)] p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {!mergeConfirming ? (
              /* Step 1: pick primary */
              <>
                <h2 className="text-[20px] font-black uppercase text-[var(--ink)] mb-1" style={condensed}>
                  Merge Exercise
                </h2>
                <p className="text-[12px] text-[var(--stone)] mb-4">
                  Pick the exercise to keep.{' '}
                  <strong className="text-[var(--action)]">{mergeSource.name}</strong> will be removed and all its history retagged.
                </p>
                <input
                  type="text"
                  placeholder="Search for primary exercise…"
                  value={mergeSearch}
                  onChange={e => { setMergeSearch(e.target.value); setMergeTarget(null); }}
                  autoFocus
                  className="w-full bg-[var(--surface)] border border-[var(--hairline-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ash)] placeholder:text-[var(--stone)] mb-3"
                />
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto mb-4">
                  {entries
                    .filter(e =>
                      e.id !== mergeSource.id &&
                      e.name.toLowerCase().includes(mergeSearch.toLowerCase())
                    )
                    .map(e => (
                      <button
                        key={e.id}
                        onClick={() => setMergeTarget(e)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium border-none cursor-pointer transition-colors flex justify-between items-center ${
                          mergeTarget?.id === e.id
                            ? 'bg-[var(--action)] text-white'
                            : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--hairline)]'
                        }`}
                      >
                        <span>{e.name}</span>
                        <span className="text-[10px] opacity-60 ml-2">{e.bodyPart}</span>
                      </button>
                    ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeMergeModal}
                    className="flex-1 py-2.5 rounded-full border border-[var(--hairline-2)] text-[var(--stone)] text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer bg-transparent hover:border-[var(--ash)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!mergeTarget}
                    onClick={() => setMergeConfirming(true)}
                    className="flex-1 py-2.5 rounded-full bg-[var(--action)] text-white border-none text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: confirm */
              <>
                <h2 className="text-[20px] font-black uppercase text-[var(--ink)] mb-4" style={condensed}>
                  Confirm Merge
                </h2>
                <div className="bg-[var(--surface)] border border-[var(--action)] rounded-lg p-3 mb-3">
                  <div className="text-[9px] text-[var(--action)] uppercase tracking-[.1em] mb-1 font-bold">
                    Will be removed
                  </div>
                  <div className="font-bold text-[13px]">{mergeSource.name}</div>
                </div>
                <div className="text-center text-[16px] text-[var(--stone)] mb-3">↓</div>
                <div className="bg-[var(--surface)] border border-green-600 rounded-lg p-3 mb-4">
                  <div className="text-[9px] text-green-500 uppercase tracking-[.1em] mb-1 font-bold">
                    Keep as primary
                  </div>
                  <div className="font-bold text-[13px]">{mergeTarget!.name}</div>
                </div>
                <p className="text-[11px] text-[var(--stone)] mb-4">
                  All past workouts and routines using{' '}
                  <strong className="text-[var(--ink)]">{mergeSource.name}</strong> will be updated to{' '}
                  <strong className="text-[var(--ink)]">{mergeTarget!.name}</strong>. This cannot be undone.
                </p>
                {mergeError && (
                  <p className="text-[11px] text-[var(--action)] mb-3">{mergeError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setMergeConfirming(false)}
                    disabled={mergeSaving}
                    className="flex-1 py-2.5 rounded-full border border-[var(--hairline-2)] text-[var(--stone)] text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer bg-transparent hover:border-[var(--ash)] transition-colors disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleMergeConfirm}
                    disabled={mergeSaving}
                    className="flex-1 py-2.5 rounded-full bg-[var(--action)] text-white border-none text-[12px] font-bold uppercase tracking-[.06em] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {mergeSaving ? 'Merging…' : 'Confirm Merge'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Open http://localhost:3000, click the **Exercises** tab in the nav:
- Should render "My Exercises" header with "No exercises yet" empty state
- Click **+ Add Exercise** — modal opens with Name, Body Part, Type fields
- Type a name, pick a body part, click Add — exercise appears in the list under the correct body part group
- Click the ✎ icon next to an exercise — body part dropdown appears inline; change it and it updates
- Click **merge** on any exercise — merge modal opens; pick a target, click Next, review confirm screen, click Back to go back

- [ ] **Step 4: Commit**

```bash
git add src/components/ExerciseLibrary.tsx
git commit -m "feat: add ExerciseLibrary tab with grouped list, inline edit, add modal, merge flow"
```

---

## Task 5: Update CustomRoutineBuilder — autocomplete + library sync

**Files:**
- Modify: `src/components/CustomRoutineBuilder.tsx`

- [ ] **Step 1: Add imports and hook call**

In `src/components/CustomRoutineBuilder.tsx`, update the imports and add hook usage:

```ts
// Replace existing imports line:
import { Exercise, BODY_PARTS, BodyPart, normalizeExerciseName } from '../types';

// Add after existing imports:
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
```

Inside the component function, after the existing `useState` declarations, add:

```ts
const { entries: libraryEntries, addToLibrary } = useExerciseLibrary();
const [activeSuggestionRow, setActiveSuggestionRow] = useState<number | null>(null);
```

- [ ] **Step 2: Add library sync to saveRoutine**

Replace the existing `saveRoutine` function:

```ts
const saveRoutine = async () => {
  if (!user || !name.trim() || exercises.length === 0) return;
  const validExercises = exercises.filter(e => e.name.trim() !== '');
  if (!validExercises.every(e => e.bodyPart)) return;
  setSaving(true);
  try {
    await addDoc(collection(db, 'routines'), {
      userId: user.uid,
      name: name.trim(),
      exercises: validExercises,
      createdAt: Date.now(),
    });
    for (const ex of validExercises) {
      await addToLibrary(ex.name, ex.bodyPart as BodyPart, (ex.type ?? 'strength') as 'strength' | 'cardio');
    }
    onSave();
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'routines');
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 3: Replace the exercise name input with autocomplete version**

Find the exercise name input `<div>` (the one with `className="flex-1 min-w-[160px]"`). Replace the entire div with:

```tsx
<div className="flex-1 min-w-[160px] relative">
  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>
    {ex.type === 'cardio' ? 'Activity' : 'Exercise'}
  </label>
  <input
    type="text"
    value={ex.name}
    onChange={e => {
      updateExercise(idx, 'name', e.target.value);
      setActiveSuggestionRow(idx);
    }}
    onFocus={() => setActiveSuggestionRow(idx)}
    onBlur={() => setTimeout(() => setActiveSuggestionRow(null), 150)}
    placeholder={ex.type === 'cardio' ? 'Treadmill Run' : 'Bench Press'}
    className={inputClass}
  />
  {activeSuggestionRow === idx && ex.name.trim().length > 0 && (() => {
    const key = normalizeExerciseName(ex.name);
    const suggestions = libraryEntries
      .filter(e => e.type === ex.type && e.nameKey.includes(key) && e.nameKey !== key)
      .slice(0, 5);
    if (suggestions.length === 0) return null;
    return (
      <div className="absolute top-full left-0 right-0 z-20 bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg mt-1 shadow-lg overflow-hidden">
        {suggestions.map(s => (
          <button
            key={s.id}
            onMouseDown={() => {
              updateExercise(idx, 'name', s.name);
              updateExercise(idx, 'bodyPart', s.bodyPart);
              setActiveSuggestionRow(null);
            }}
            className="w-full text-left px-3 py-2 text-[12px] flex justify-between items-center border-none bg-transparent cursor-pointer hover:bg-[var(--surface)] text-[var(--ink)] transition-colors"
          >
            <span>{s.name}</span>
            <span className="text-[10px] text-[var(--stone)] ml-2">{s.bodyPart}</span>
          </button>
        ))}
      </div>
    );
  })()}
</div>
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

1. Open http://localhost:3000, go to **Build Routine**
2. Click **+ Strength**, type part of an exercise already in your library (e.g. "ben") — a suggestion dropdown should appear showing matching exercises
3. Click a suggestion — the name fills in and the Body Part dropdown auto-selects
4. Fill in the routine name, click **Save Routine**
5. Go to **Exercises** tab — all exercises from the saved routine should now appear in the library (deduped)

- [ ] **Step 6: Commit**

```bash
git add src/components/CustomRoutineBuilder.tsx
git commit -m "feat: add exercise autocomplete and library sync to CustomRoutineBuilder"
```

---

## Task 6: Update RoutineGenerator — library sync on save

**Files:**
- Modify: `src/components/RoutineGenerator.tsx`

- [ ] **Step 1: Add imports and hook call**

In `src/components/RoutineGenerator.tsx`, add to the imports:

```ts
import { BodyPart } from '../types';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
```

Inside the component function, after the existing `useState` declarations, add:

```ts
const { addToLibrary } = useExerciseLibrary();
```

- [ ] **Step 2: Add library sync to saveRoutine**

Replace the existing `saveRoutine` function:

```ts
const saveRoutine = async () => {
  if (!generatedRoutine || !user) return;
  setSaving(true);
  try {
    await addDoc(collection(db, 'routines'), {
      userId: user.uid,
      name: generatedRoutine.name,
      bodyPart,
      exercises: generatedRoutine.exercises,
      isGenerated: true,
      createdAt: Date.now(),
    });
    for (const ex of generatedRoutine.exercises) {
      if (ex.name && ex.bodyPart) {
        await addToLibrary(ex.name, ex.bodyPart as BodyPart, ex.type ?? 'strength');
      }
    }
    onRoutineSaved();
    setGeneratedRoutine(null);
    setBodyPart('');
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'routines');
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

1. Go to **Generate** tab, generate and save a routine
2. Go to **Exercises** tab — all exercises from the AI-generated routine should appear in the library

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineGenerator.tsx
git commit -m "feat: sync exercise library when saving AI-generated routine"
```

---

## Post-Implementation Note: Firestore Security Rules

The `exerciseLibrary` collection needs to be added to your Firestore security rules. Add a rule that allows read/write only for the authenticated owner:

```
match /exerciseLibrary/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
}
```

Deploy rules with:
```bash
firebase deploy --only firestore:rules
```

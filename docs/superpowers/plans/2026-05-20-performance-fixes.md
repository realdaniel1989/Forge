# Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate per-tab-switch network round-trips, remove production debug logging, debounce localStorage writes, and enable Firestore offline caching so the app feels instant after first load.

**Architecture:** Fix the 6 issues from the performance investigation in ascending-risk order: remove dead/debug code first, then patch hot paths, then enable Firestore persistence, and finally restructure tab rendering so components stay mounted.

**Tech Stack:** React 18, TypeScript, Firebase 10 Firestore (Web SDK), Vite, Tailwind CSS. No test framework — verification is via `npm run lint` (tsc --noEmit) and manual smoke-testing.

---

## File Map

| File | What changes |
|---|---|
| `src/AuthContext.tsx` | Remove `testConnection()` function and its call; remove unused import |
| `src/components/ProgressView.tsx` | Remove debug `console.log` block (lines 31–50); fix index keys |
| `src/components/LiveWorkout.tsx` | Debounce localStorage effect; fix index keys |
| `src/firebase.ts` | Switch to `initializeFirestore` with `persistentLocalCache()` |
| `src/App.tsx` | Lazy-mount tabs, keep mounted with CSS `display:none` |

---

## Task 1: Remove AuthContext test connection query

**Files:**
- Modify: `src/AuthContext.tsx`

This removes an unnecessary Firestore network read (`getDocFromServer`) that fires on every app load. Firebase SDK handles connectivity errors natively — this probe adds latency with no benefit.

- [ ] **Step 1: Open the file and confirm the target**

  Read `src/AuthContext.tsx`. You will see:
  ```ts
  import { doc, getDocFromServer } from 'firebase/firestore';

  async function testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  }
  ```
  And in the `useEffect`:
  ```ts
  useEffect(() => {
    testConnection();    // ← this line
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
  ```

- [ ] **Step 2: Remove the import, function, and call**

  Replace the top of `src/AuthContext.tsx` so the firestore import is gone and the function is deleted. The final file should look like:

  ```ts
  import React, { createContext, useContext, useEffect, useState } from 'react';
  import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
  import { auth } from './firebase';

  interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: () => Promise<void>;
    logOut: () => Promise<void>;
  }

  const AuthContext = createContext<AuthContextType>({} as AuthContextType);

  export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    }, []);

    const signIn = async () => {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error('Sign in failed:', error);
        alert('Sign in failed: ' + (error instanceof Error ? error.message : String(error)));
      }
    };

    const logOut = async () => {
      await signOut(auth);
    };

    return (
      <AuthContext.Provider value={{ user, loading, signIn, logOut }}>
        {!loading && children}
      </AuthContext.Provider>
    );
  };

  export const useAuth = () => useContext(AuthContext);
  ```

- [ ] **Step 3: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/AuthContext.tsx
  git commit -m "perf: remove unnecessary Firestore connectivity probe on app load"
  ```

---

## Task 2: Remove ProgressView debug logging

**Files:**
- Modify: `src/components/ProgressView.tsx`

The 600+ `console.log` calls on every Analytics tab visit block the main thread on mobile. These are development artifacts.

- [ ] **Step 1: Locate the debug block**

  In `src/components/ProgressView.tsx`, find lines 31–50 inside `fetchLogs`:
  ```ts
  // DEBUG: Log fetched workout data
  console.log('[Analytics] Fetched logs:', fetched.length);
  fetched.forEach((log, i) => {
    console.log(`[Analytics] Log ${i}:`, {
      name: log.name,
      date: log.date,
      dateStr: new Date(log.date).toISOString(),
      bodyPart: log.bodyPart,
      exerciseCount: log.exercises?.length,
      exercises: log.exercises?.map(ex => ({
        name: ex.name,
        type: ex.type,
        trackedSets: ex.trackedSets?.length,
        completedSets: ex.trackedSets?.filter(s => s.completed).length,
        actualSets: ex.actualSets,
        sets: ex.sets,
        reps: ex.reps,
        trackedSetDetails: ex.trackedSets,
      }))
    });
  });
  ```

- [ ] **Step 2: Delete the debug block**

  Remove the entire comment + `console.log` + `fetched.forEach` block. The `fetchLogs` function's try block should now read:
  ```ts
  try {
    const q = query(collection(db, 'workoutLogs'), where('userId', '==', user.uid), limit(100));
    const snap = await getDocs(q);
    const fetched: WorkoutLog[] = [];
    snap.forEach(d => fetched.push({ id: d.id, ...d.data() } as WorkoutLog));
    fetched.sort((a, b) => a.date - b.date);
    setLogs(fetched);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'workoutLogs');
  } finally {
    setLoading(false);
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/ProgressView.tsx
  git commit -m "perf: remove verbose debug logging from ProgressView (600+ console writes per visit)"
  ```

---

## Task 3: Debounce LiveWorkout localStorage sync

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

Every keystroke in a weight or reps input triggers `JSON.stringify` of the full workout state to localStorage. A 500ms debounce means rapid input only saves once per burst.

- [ ] **Step 1: Find the current effect**

  In `src/components/LiveWorkout.tsx`, lines 60–64:
  ```ts
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ exercises, unit, baseUnit: baseUnitRef.current }));
    } catch {}
  }, [exercises, unit]);
  ```

- [ ] **Step 2: Replace with debounced version**

  ```ts
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ exercises, unit, baseUnit: baseUnitRef.current }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [exercises, unit]);
  ```

- [ ] **Step 3: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 4: Smoke test**

  Run `npm run dev`, open a workout, type rapidly into a weight input. The localStorage write should now only fire 500ms after you stop typing (open DevTools → Application → Local Storage to observe).

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/LiveWorkout.tsx
  git commit -m "perf: debounce localStorage workout draft sync (500ms) to prevent per-keystroke writes"
  ```

---

## Task 4: Fix array-index React keys

**Files:**
- Modify: `src/components/ProgressView.tsx`
- Modify: `src/components/LiveWorkout.tsx`

Using array index as `key` causes React to re-render more DOM than necessary when list items are added, removed, or reordered.

- [ ] **Step 1: Fix ProgressView calendar day keys**

  In `ProgressView.tsx`, there are two `.map((day, i) => ... key={i} ...)` — one for the desktop grid and one for the mobile list (around lines 149 and 211). Replace both `key={i}` with a date-based key:
  ```tsx
  // Desktop grid (around line 152)
  {daysInWeek.map((day) => {   // remove the unused `i`
    ...
    return (
      <div
        key={format(day, 'yyyy-MM-dd')}   // ← stable date string
  
  // Mobile list (around line 211)
  {daysInWeek.map((day) => {   // remove the unused `i`
    ...
    return (
      <div
        key={format(day, 'yyyy-MM-dd')}   // ← stable date string
  ```
  `format` is already imported from `date-fns`.

- [ ] **Step 2: Fix ProgressView weekly summary row keys**

  Around line 268 in `ProgressView.tsx`:
  ```tsx
  // Before:
  .map(([part, val], i) => (
    <tr key={i} ...>

  // After:
  .map(([part, val]) => (
    <tr key={part} ...>   // `part` is always unique in weeklySummary
  ```

- [ ] **Step 3: Fix ProgressView modal exercise keys**

  Around line 306 in `ProgressView.tsx` (the workout detail modal):
  ```tsx
  // Before:
  {selectedWorkout.exercises.map((ex, idx) => {
    ...
    return (
      <div key={idx} ...>

  // After:
  {selectedWorkout.exercises.map((ex, idx) => {
    ...
    return (
      <div key={`${ex.name}-${idx}`} ...>
  ```

- [ ] **Step 4: Fix LiveWorkout exercise card keys**

  In `LiveWorkout.tsx`, around line 396:
  ```tsx
  // Before:
  {exercises.map((ex, idx) => {
    ...
    return (
      <div key={idx} ...>

  // After:
  {exercises.map((ex, idx) => {
    ...
    return (
      <div key={`${ex.name}-${idx}`} ...>
  ```

- [ ] **Step 5: Fix LiveWorkout add-exercise-modal history list keys**

  In `LiveWorkout.tsx`, around line 659:
  ```tsx
  // Before:
  .map((hist, i) => (
    <button
      key={i}

  // After:
  .map((hist) => (
    <button
      key={hist.name}
  ```

- [ ] **Step 6: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/ProgressView.tsx src/components/LiveWorkout.tsx
  git commit -m "perf: replace array-index React keys with stable identifiers"
  ```

---

## Task 5: Enable Firestore offline persistence

**Files:**
- Modify: `src/firebase.ts`

Firestore's IndexedDB-backed offline cache means subsequent page loads and tab revisits can serve data from cache instantly while network updates come in the background. This requires switching from `getFirestore` to `initializeFirestore` with `persistentLocalCache`.

- [ ] **Step 1: Update the import**

  In `src/firebase.ts`, change the firestore import from:
  ```ts
  import { getFirestore } from 'firebase/firestore';
  ```
  To:
  ```ts
  import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
  ```

- [ ] **Step 2: Update the initialization call**

  In the try block, replace:
  ```ts
  db = getFirestore(app, firestoreDatabaseId);
  ```
  With:
  ```ts
  db = initializeFirestore(app, { localCache: persistentLocalCache() }, firestoreDatabaseId);
  ```

  The full `src/firebase.ts` should now look like:
  ```ts
  import { initializeApp } from 'firebase/app';
  import { getAuth } from 'firebase/auth';
  import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

  const firebaseConfig = {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };

  const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;

  let app;
  let db: ReturnType<typeof initializeFirestore>;
  let auth: ReturnType<typeof getAuth>;
  let initError: string | null = null;

  try {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, { localCache: persistentLocalCache() }, firestoreDatabaseId);
    auth = getAuth(app);
  } catch (e) {
    initError = e instanceof Error ? e.message : String(e);
    console.error('Firebase initialization failed:', initError);
  }

  export { db, auth, initError };
  ```

- [ ] **Step 3: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 4: Smoke test**

  Run `npm run dev`. Log in, browse to each tab to let it fetch. Then open DevTools → Network → set to "Offline". Refresh the page. Data should still appear from the IndexedDB cache.

- [ ] **Step 5: Commit**

  ```bash
  git add src/firebase.ts
  git commit -m "perf: enable Firestore IndexedDB offline persistence for instant cache reads"
  ```

---

## Task 6: Keep tab components mounted with CSS display toggle

**Files:**
- Modify: `src/App.tsx`

**This is the highest-impact fix.** Currently `{tab === 'x' && <Component />}` unmounts the component when the tab changes, discarding its state and forcing a fresh network fetch on every tab switch. The fix: track which tabs have been visited (`mountedTabs`), mount each component only once, then hide non-active ones with `display: none`.

The lazy-mount strategy avoids making all 4 tab fetches simultaneously on first load — each component only mounts when the user first visits its tab.

- [ ] **Step 1: Understand the current render**

  `src/App.tsx` lines 29–36:
  ```tsx
  return (
    <Layout currentTab={tab} setTab={setTab}>
      {tab === 'routines' && <RoutinesList onStartWorkout={setActiveWorkout} onCreateCustom={() => setTab('custom')} onGenerateAI={() => setTab('generate')} />}
      {tab === 'generate' && <RoutineGenerator onRoutineSaved={() => setTab('routines')} />}
      {tab === 'custom'   && <CustomRoutineBuilder onCancel={() => setTab('routines')} onSave={() => setTab('routines')} />}
      {tab === 'progress' && <ProgressView />}
    </Layout>
  );
  ```

- [ ] **Step 2: Add `mountedTabs` state and a `changeTab` handler**

  At the top of `MainView`, add:
  ```tsx
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([tab]));

  const changeTab = (newTab: string) => {
    setTab(newTab);
    setMountedTabs(prev => prev.has(newTab) ? prev : new Set([...prev, newTab]));
  };
  ```

- [ ] **Step 3: Replace the Layout render with CSS-hidden tabs**

  Replace the `return` block with:
  ```tsx
  return (
    <Layout currentTab={tab} setTab={changeTab}>
      {mountedTabs.has('routines') && (
        <div style={{ display: tab === 'routines' ? 'contents' : 'none' }}>
          <RoutinesList
            onStartWorkout={setActiveWorkout}
            onCreateCustom={() => changeTab('custom')}
            onGenerateAI={() => changeTab('generate')}
          />
        </div>
      )}
      {mountedTabs.has('generate') && (
        <div style={{ display: tab === 'generate' ? 'contents' : 'none' }}>
          <RoutineGenerator onRoutineSaved={() => changeTab('routines')} />
        </div>
      )}
      {mountedTabs.has('custom') && (
        <div style={{ display: tab === 'custom' ? 'contents' : 'none' }}>
          <CustomRoutineBuilder
            onCancel={() => changeTab('routines')}
            onSave={() => changeTab('routines')}
          />
        </div>
      )}
      {mountedTabs.has('progress') && (
        <div style={{ display: tab === 'progress' ? 'contents' : 'none' }}>
          <ProgressView />
        </div>
      )}
    </Layout>
  );
  ```

  > **Why `display: 'contents'`?** The existing tab components render `<div className="flex flex-col gap-0">` or similar as their root. Using `display: contents` on the wrapper div makes it invisible in the layout — the tab component's own root element participates in the Layout's flex/grid directly, exactly as before. Using `display: 'block'` would add a block wrapper that could affect the Layout's spacing.

- [ ] **Step 4: Verify the complete MainView function looks correct**

  The full `MainView` in `src/App.tsx` should now be:
  ```tsx
  const MainView = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState('routines');
    const [activeWorkout, setActiveWorkout] = useState<Routine | null>(null);
    const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([tab]));

    const changeTab = (newTab: string) => {
      setTab(newTab);
      setMountedTabs(prev => prev.has(newTab) ? prev : new Set([...prev, newTab]));
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
          <div style={{ display: tab === 'routines' ? 'contents' : 'none' }}>
            <RoutinesList
              onStartWorkout={setActiveWorkout}
              onCreateCustom={() => changeTab('custom')}
              onGenerateAI={() => changeTab('generate')}
            />
          </div>
        )}
        {mountedTabs.has('generate') && (
          <div style={{ display: tab === 'generate' ? 'contents' : 'none' }}>
            <RoutineGenerator onRoutineSaved={() => changeTab('routines')} />
          </div>
        )}
        {mountedTabs.has('custom') && (
          <div style={{ display: tab === 'custom' ? 'contents' : 'none' }}>
            <CustomRoutineBuilder
              onCancel={() => changeTab('routines')}
              onSave={() => changeTab('routines')}
            />
          </div>
        )}
        {mountedTabs.has('progress') && (
          <div style={{ display: tab === 'progress' ? 'contents' : 'none' }}>
            <ProgressView />
          </div>
        )}
      </Layout>
    );
  };
  ```

- [ ] **Step 5: Verify TypeScript**

  Run: `npm run lint`
  Expected: zero errors

- [ ] **Step 6: Smoke test tab switching**

  Run `npm run dev`. Open DevTools → Network. Steps:
  1. Load app → Routines tab fetches once
  2. Click Analytics → one fetch fires, data appears
  3. Click Routines → **zero new network requests**, data is instant
  4. Click Analytics again → **zero new network requests**, data is instant
  5. Click Generate → one fetch fires on first visit only
  6. Click Routines, then Generate again → zero new requests

- [ ] **Step 7: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "perf: lazy-mount tabs and persist with CSS display to eliminate per-tab-switch network fetches"
  ```

---

## Self-Review

### Spec Coverage

| Issue | Severity | Task |
|---|---|---|
| Components fully remount on every tab switch | Critical | Task 6 ✓ |
| No Firestore data caching or real-time listeners | Critical | Task 5 (offline persistence) ✓ |
| ProgressView verbose debug logging | High | Task 2 ✓ |
| LiveWorkout localStorage sync on every keystroke | High | Task 3 ✓ |
| AuthContext test connection query | Medium | Task 1 ✓ |
| Array index as React key | Low | Task 4 ✓ |

All 6 issues are covered.

### Notes

- **`onSnapshot` real-time listeners** (mentioned in the investigation as a follow-up to Issue 2) are not included in this plan. Switching from `getDocs` to `onSnapshot` requires managing listener teardown and is a larger refactor. The `persistentLocalCache()` fix in Task 5 gives significant offline benefit without that complexity. Real-time listeners can be a separate phase.
- **Task 6 uses `display: contents`** on wrapper divs to avoid layout side effects. If any tab component has `position: fixed` or `z-index` children that break under a `contents` wrapper, fall back to `display: 'block'` and verify the layout still looks correct.
- **CustomRoutineBuilder form state** will now be preserved when navigating away mid-edit (the form stays mounted). This is a UX improvement — the user's draft is kept if they accidentally switch tabs.

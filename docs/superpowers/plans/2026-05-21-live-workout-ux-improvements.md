# Live Workout UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver 5 targeted UX improvements: default weight unit to KGs across the full stack, make per-set delete always visible on mobile, add a sound+vibration alarm when the rest timer completes, make the timer survive app-switching via timestamp-based countdown, and add a minimizable floating pill so users can see their workout list while the timer runs.

**Architecture:** All changes are in three files (`src/components/LiveWorkout.tsx`, `server.ts`, `src/components/RoutineGenerator.tsx`) plus a new `src/timerAlarm.ts` utility. No new routes, no schema changes, no external dependencies added.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Web Audio API, Vibration API, Page Visibility API

---

## File Map

| File | What changes |
|---|---|
| `src/timerAlarm.ts` | **New.** `playAlarm()` — Web Audio beep + vibration |
| `src/components/LiveWorkout.tsx` | Default unit kgs; set-delete CSS; import+call playAlarm; timestamp timer + visibilitychange; minimizable timer state + pill UI |
| `server.ts` | Gemini schema + prompt: kgs instead of lbs |
| `src/components/RoutineGenerator.tsx` | Weight label: lbs → kgs |

---

## Task 1: Default KGs in AI Generator (server + preview label)

**Files:**
- Modify: `server.ts:21`
- Modify: `server.ts:36`
- Modify: `src/components/RoutineGenerator.tsx:179`

- [ ] **Step 1: Update Gemini schema weight description**

In `server.ts`, find the `weight` property in `responseSchema` (line ~21) and change its description:

```typescript
weight: { type: "number", description: "Suggest starting weight in kgs" },
```

- [ ] **Step 2: Update Gemini prompt to request kgs**

In `server.ts`, find `callGemini`'s `prompt` string (line ~32) and append the unit instruction. The full prompt becomes:

```typescript
const prompt = `Generate a workout routine for the body part: ${bodyPart}.
Provide the response as JSON matching the schema format.
Include up to 6 exercises maximum.
Make sure to specify sets, reps, and a brief tip for each exercise.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part that the exercise primarily targets.
Use kilograms (kg) for all suggested weights.`;
```

- [ ] **Step 3: Update the weight preview label in RoutineGenerator**

In `src/components/RoutineGenerator.tsx` at line ~179, change the label from `lbs` to `kgs`:

```tsx
{ex.weight > 0 && (
  <p className="text-[11px] text-[var(--stone)] mt-1 uppercase tracking-[0.06em]" style={condensed}>
    Suggested: {ex.weight} kgs
  </p>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server.ts src/components/RoutineGenerator.tsx
git commit -m "feat: AI generator uses kgs for suggested weights"
```

---

## Task 2: Default KGs in LiveWorkout

**Files:**
- Modify: `src/components/LiveWorkout.tsx:19,21`

- [ ] **Step 1: Change initial unit state to kgs**

In `src/components/LiveWorkout.tsx`, find line 19:

```typescript
const [unit, setUnit] = useState<'lbs' | 'kgs'>(savedDraft?.unit || 'lbs');
```

Change to:

```typescript
const [unit, setUnit] = useState<'lbs' | 'kgs'>(savedDraft?.unit || 'kgs');
```

- [ ] **Step 2: Change base unit ref default to kgs**

On line 21:

```typescript
const baseUnitRef = useRef<'lbs' | 'kgs'>(savedDraft?.baseUnit || (savedDraft?.unit || 'lbs'));
```

Change to:

```typescript
const baseUnitRef = useRef<'lbs' | 'kgs'>(savedDraft?.baseUnit || (savedDraft?.unit || 'kgs'));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server (`npm run dev`), open a routine in Live Workout. Confirm the unit toggle shows **kgs** selected by default (not lbs). Switch to a different routine to confirm it isn't affected by a stale draft.

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "feat: default weight unit to kgs in live workout"
```

---

## Task 3: Per-Set Delete Always Visible on Mobile

**Files:**
- Modify: `src/components/LiveWorkout.tsx` (the X button in the set table row, around line 578–585)

- [ ] **Step 1: Find the delete-set button**

In `src/components/LiveWorkout.tsx`, locate the `<td>` containing the per-row X button (last column of the set table). It looks like:

```tsx
<td className="py-2.5 px-2 text-right align-top">
  <button
    onClick={() => deleteSet(idx, setIdx)}
    className="text-[var(--muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
  >
    <X className="w-3.5 h-3.5" />
  </button>
</td>
```

- [ ] **Step 2: Change opacity classes to be mobile-always-visible**

Replace `opacity-0 group-hover:opacity-100` with `sm:opacity-0 sm:group-hover:opacity-100`:

```tsx
<td className="py-2.5 px-2 text-right align-top">
  <button
    onClick={() => deleteSet(idx, setIdx)}
    className="text-[var(--muted)] hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
  >
    <X className="w-3.5 h-3.5" />
  </button>
</td>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Open Live Workout on a mobile viewport (DevTools → mobile emulation or actual phone). Each set row should show the X button without needing to hover. On desktop, X should only appear on row hover.

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "fix: show per-set delete button always on mobile"
```

---

## Task 4: Timer Alarm Utility (Sound + Vibration)

**Files:**
- Create: `src/timerAlarm.ts`

This task creates the alarm utility in isolation before wiring it into LiveWorkout.

- [ ] **Step 1: Create `src/timerAlarm.ts`**

```typescript
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function beep(frequency: number, startTime: number, duration: number, ctx: AudioContext): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.4, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function playAlarm(): void {
  try {
    const ctx = getAudioContext();
    // Resume context in case it was suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    beep(440, now, 0.18, ctx);
    beep(880, now + 0.22, 0.18, ctx);
  } catch {
    // Audio not supported — fail silently
  }

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Vibration not supported — fail silently
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test in browser console**

Start dev server (`npm run dev`), open browser console on any page, and run:

```javascript
import('/src/timerAlarm.ts').then(m => m.playAlarm())
```

Expected: two-tone beep plays, and on mobile/device with vibration support the phone vibrates with a double pulse.

- [ ] **Step 4: Commit**

```bash
git add src/timerAlarm.ts
git commit -m "feat: add playAlarm utility (Web Audio beep + vibration)"
```

---

## Task 5: Wire Alarm into LiveWorkout Timer

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

- [ ] **Step 1: Import playAlarm**

At the top of `src/components/LiveWorkout.tsx`, add the import after the existing imports:

```typescript
import { playAlarm } from '../timerAlarm';
```

- [ ] **Step 2: Call playAlarm when the timer naturally hits zero**

Find the `setInterval` callback inside the timer `useEffect` (around line 78–88). The callback currently does:

```typescript
setRestTimeRemaining(prev => {
  if (prev <= 1) {
    setIsTimerActive(false);
    return 0;
  }
  return prev - 1;
});
```

Change it to fire the alarm on natural completion:

```typescript
setRestTimeRemaining(prev => {
  if (prev <= 1) {
    setIsTimerActive(false);
    playAlarm();
    return 0;
  }
  return prev - 1;
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Open Live Workout, set the rest timer to 3 seconds (type `3` in the timer input in the header), complete a set to start the timer, wait for it to hit zero. Expected: a two-tone beep plays and device vibrates. Confirm "Skip Rest" does NOT trigger the alarm (it bypasses the countdown).

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "feat: play alarm (sound + vibration) when rest timer completes"
```

---

## Task 6: Timestamp-Based Timer (Survives App-Switching)

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

The current timer decrements by 1 per second via `setInterval`. Mobile browsers throttle or pause intervals in backgrounded tabs. Fix: record the absolute end timestamp when the timer starts, then compute remaining time from `endTime - Date.now()` on every tick and on returning to the tab.

- [ ] **Step 1: Add timerEndTimeRef**

After the existing `useRef` declarations near the top of the component, add:

```typescript
const timerEndTimeRef = useRef<number>(0);
```

- [ ] **Step 2: Set timerEndTimeRef when timer starts (on set completion)**

In `updateSet`, find where `setIsTimerActive(true)` is called (around line 143–145):

```typescript
if (field === 'completed' && value === true && !wasCompleted) {
   setRestTimeRemaining(configuredRestTime);
   setIsTimerActive(true);
}
```

Change to:

```typescript
if (field === 'completed' && value === true && !wasCompleted) {
   timerEndTimeRef.current = Date.now() + configuredRestTime * 1000;
   setRestTimeRemaining(configuredRestTime);
   setIsTimerActive(true);
}
```

- [ ] **Step 3: Set timerEndTimeRef when +30s is tapped**

Find the "+30s" button's `onClick` handler (around line 422):

```typescript
onClick={() => setRestTimeRemaining(prev => prev + 30)}
```

Change to:

```typescript
onClick={() => {
  timerEndTimeRef.current = timerEndTimeRef.current + 30_000;
  setRestTimeRemaining(prev => prev + 30);
}}
```

- [ ] **Step 4: Replace interval decrement with timestamp-based computation**

Find the timer `useEffect` (around line 75–89):

```typescript
useEffect(() => {
  let interval: NodeJS.Timeout;
  if (isTimerActive && restTimeRemaining > 0) {
    interval = setInterval(() => {
      setRestTimeRemaining(prev => {
        if (prev <= 1) {
          setIsTimerActive(false);
          playAlarm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }
  return () => clearInterval(interval);
}, [isTimerActive, restTimeRemaining]);
```

Replace the entire `useEffect` with:

```typescript
useEffect(() => {
  if (!isTimerActive) return;

  const tick = () => {
    const remaining = Math.max(0, Math.ceil((timerEndTimeRef.current - Date.now()) / 1000));
    if (remaining === 0) {
      setIsTimerActive(false);
      setRestTimeRemaining(0);
      playAlarm();
    } else {
      setRestTimeRemaining(remaining);
    }
  };

  const interval = setInterval(tick, 500);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [isTimerActive]);
```

Note: interval is now 500ms (fires twice per second) so the display never lags more than half a second. The dependency array drops `restTimeRemaining` — the effect only needs to restart when `isTimerActive` changes.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Start a rest timer (complete a set), switch to another app or browser tab for 20 seconds, return. Expected: the displayed time jumped forward by ~20 seconds correctly, not stuck at what it was when you left.

- [ ] **Step 7: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "feat: timestamp-based rest timer survives app-switching"
```

---

## Task 7: Minimizable Rest Timer

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

This adds a minimize button to the full-screen timer takeover and a floating pill that shows the countdown while the workout list is visible behind it.

- [ ] **Step 1: Add isTimerMinimized state**

Near the other `useState` declarations at the top of the component, add:

```typescript
const [isTimerMinimized, setIsTimerMinimized] = useState(false);
```

- [ ] **Step 2: Reset isTimerMinimized when timer stops**

In the timestamp `useEffect` (Task 6, Step 4), update the zero-reached branch to also reset minimized state:

```typescript
const tick = () => {
  const remaining = Math.max(0, Math.ceil((timerEndTimeRef.current - Date.now()) / 1000));
  if (remaining === 0) {
    setIsTimerActive(false);
    setRestTimeRemaining(0);
    setIsTimerMinimized(false);
    playAlarm();
  } else {
    setRestTimeRemaining(remaining);
  }
};
```

- [ ] **Step 3: Reset isTimerMinimized when Skip Rest is tapped**

Find the "Skip Rest" button's `onClick` (around line 427):

```typescript
onClick={() => { setRestTimeRemaining(0); setIsTimerActive(false); }}
```

Change to:

```typescript
onClick={() => { setRestTimeRemaining(0); setIsTimerActive(false); setIsTimerMinimized(false); }}
```

- [ ] **Step 4: Add minimize button to the full-screen timer**

Find the full-screen timer takeover block (the `isTimerTakeover` branch, starting around line 396). It currently starts with:

```tsx
<div className="flex flex-col items-center justify-center py-10 px-8 text-center min-h-full">
  <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-4">Resting</p>
```

Wrap the content in a relative container and add a minimize button in the top-right:

```tsx
<div className="flex flex-col items-center justify-center py-10 px-8 text-center min-h-full relative">
  {/* Minimize button */}
  <button
    onClick={() => setIsTimerMinimized(true)}
    className="absolute top-0 right-0 p-2 text-[var(--muted)] hover:text-[var(--text-2)] transition-colors bg-transparent border-none cursor-pointer"
    title="Minimise timer"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </button>

  <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-4">Resting</p>
  {/* ... rest of timer content unchanged ... */}
```

- [ ] **Step 5: Render the floating pill when minimized**

The condition `isTimerTakeover` currently controls what renders in the main content area. Update it to factor in `isTimerMinimized`:

```typescript
const isTimerTakeover = restTimeRemaining > 0 && isTimerActive && !isTimerMinimized;
```

Then, inside the `return`, after the closing `</footer>` tag (and before the modals), add the floating pill:

```tsx
{/* Floating minimized timer pill */}
{restTimeRemaining > 0 && isTimerActive && isTimerMinimized && (
  <button
    onClick={() => setIsTimerMinimized(false)}
    className="fixed left-1/2 -translate-x-1/2 bottom-[54px] z-40 flex items-center gap-3 bg-[var(--bg-1)] border border-[var(--border-2)] rounded-full px-5 py-2.5 cursor-pointer hover:border-[var(--muted)] transition-colors shadow-lg"
  >
    <span
      className={`font-mono text-[15px] font-bold leading-none ${isLowTime ? 'text-[var(--red)]' : 'text-[var(--white)]'}`}
      style={isLowTime ? { animation: 'pulse-red 1s ease-in-out infinite' } : {}}
    >
      {Math.floor(restTimeRemaining / 60)}:{(restTimeRemaining % 60).toString().padStart(2, '0')}
    </span>
    <span className="text-[10px] text-[var(--muted)] uppercase tracking-[0.08em] font-sans font-semibold">
      Tap to expand
    </span>
  </button>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Manual smoke test**

1. Start a workout, complete a set to trigger the rest timer.
2. Confirm full-screen timer appears with a "—" minimize button in top-right.
3. Tap "—" — timer shrinks to a floating pill at the bottom of the screen, workout list is visible.
4. Pill shows the correct countdown, updating every second.
5. Tap the pill — full-screen timer returns.
6. Let the timer naturally expire while minimized — pill disappears, alarm fires, workout list is visible.
7. Start another timer, tap Skip Rest — pill disappears correctly.

- [ ] **Step 8: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "feat: minimizable rest timer with floating pill"
```

---

## Self-Review Checklist

- [x] **Task 1** covers Gemini schema + prompt (kgs) + RoutineGenerator label
- [x] **Task 2** covers LiveWorkout default unit state (both `unit` and `baseUnitRef`)
- [x] **Task 3** covers set-delete mobile visibility (CSS only, `sm:` prefix)
- [x] **Task 4** creates `timerAlarm.ts` with both Web Audio and vibration paths
- [x] **Task 5** wires alarm into the timer countdown (natural completion only, not Skip Rest)
- [x] **Task 6** replaces decrement-by-1 with timestamp diff + `visibilitychange` listener; sets `timerEndTimeRef` in both `updateSet` and `+30s` handler
- [x] **Task 7** adds `isTimerMinimized` state; updates `isTimerTakeover` condition; adds minimize button; adds floating pill; resets minimized state on timer end and Skip Rest
- [x] No placeholders or TBDs
- [x] `playAlarm` is imported before use in Task 5
- [x] `timerEndTimeRef` is defined in Task 6 Step 1 before being referenced in Steps 2–4
- [x] `isTimerMinimized` and `isLowTime` are both in scope when the pill JSX references them

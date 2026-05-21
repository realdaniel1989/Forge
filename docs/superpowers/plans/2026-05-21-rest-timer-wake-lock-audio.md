# Rest Timer: Wake Lock + Audio Pre-Warm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the phone screen on during rest timers and ensure the alarm sound plays reliably on iOS PWA (Safari, added to home screen).

**Architecture:** Two independent additions — a `useWakeLock` hook that acquires/releases a `WakeLockSentinel` tied to `isTimerActive` state, and a `prewarmAudio()` function that silently unlocks the Web AudioContext on the user's tap gesture so the alarm is allowed to play later. Both degrade silently on unsupported browsers.

**Tech Stack:** React (hooks), Web Lock API (`navigator.wakeLock`), Web Audio API (`AudioContext`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/timerAlarm.ts` | Modify | Add `prewarmAudio()` export — silent oscillator to unlock AudioContext |
| `src/hooks/useWakeLock.ts` | Create | Hook that acquires/releases screen wake lock, re-acquires on visibility restore |
| `src/components/LiveWorkout.tsx` | Modify | Call `prewarmAudio()` on timer start; wire `useWakeLock` to `isTimerActive` |

---

## Task 1: Add `prewarmAudio()` to `timerAlarm.ts`

**Files:**
- Modify: `src/timerAlarm.ts`

- [ ] **Step 1: Add the `prewarmAudio` function**

Open `src/timerAlarm.ts`. Append this function after `playAlarm()`:

```ts
export function prewarmAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.01);
  } catch {
    // Audio not supported — fail silently
  }
}
```

The full file should now look like:

```ts
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
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    beep(440, now, 0.5, ctx);
    beep(660, now + 0.8, 0.5, ctx);
    beep(880, now + 1.6, 1.0, ctx);
  } catch {
    // Audio not supported — fail silently
  }

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 300, 500, 300, 800]);
    }
  } catch {
    // Vibration not supported — fail silently
  }
}

export function prewarmAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.01);
  } catch {
    // Audio not supported — fail silently
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/djedidiahw007/Desktop/Project/Workout App/gym-workout-tracker"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/timerAlarm.ts
git commit -m "feat: add prewarmAudio() to unlock AudioContext on iOS"
```

---

## Task 2: Create `useWakeLock` hook

**Files:**
- Create: `src/hooks/useWakeLock.ts`

- [ ] **Step 1: Create the hook file**

Create `src/hooks/useWakeLock.ts` with this content:

```ts
import { useRef, useCallback } from 'react';

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    if (sentinelRef.current) return; // already held
    try {
      sentinelRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      sentinelRef.current.addEventListener('release', () => {
        sentinelRef.current = null;
      });
    } catch {
      // Device refused wake lock (e.g. battery saver) — fail silently
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await sentinelRef.current?.release();
    } catch {
      // Already released — fail silently
    } finally {
      sentinelRef.current = null;
    }
  }, []);

  return { acquireWakeLock, releaseWakeLock };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/djedidiahw007/Desktop/Project/Workout App/gym-workout-tracker"
npx tsc --noEmit
```

Expected: no errors.

> Note: If TypeScript complains about `WakeLockSentinel` not being found, it means the project's `tsconfig.json` targets an older DOM lib. Fix by replacing `WakeLockSentinel` with `any` in the ref type: `const sentinelRef = useRef<any>(null)`. The runtime behaviour is identical.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWakeLock.ts
git commit -m "feat: add useWakeLock hook for screen wake lock"
```

---

## Task 3: Wire both into `LiveWorkout.tsx`

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

### 3a — Update imports

- [ ] **Step 1: Update the `timerAlarm` import to include `prewarmAudio`**

Find line 8:
```ts
import { playAlarm } from '../timerAlarm';
```

Replace with:
```ts
import { playAlarm, prewarmAudio } from '../timerAlarm';
```

- [ ] **Step 2: Add the `useWakeLock` import**

After the `timerAlarm` import line, add:
```ts
import { useWakeLock } from '../hooks/useWakeLock';
```

### 3b — Add hook usage inside the component

- [ ] **Step 3: Destructure the hook**

Find the line inside the component body that reads:
```ts
  const [isTimerMinimized, setIsTimerMinimized] = useState(false);
```

Add this line immediately after it:
```ts
  const { acquireWakeLock, releaseWakeLock } = useWakeLock();
```

### 3c — Tie wake lock lifecycle to `isTimerActive`

- [ ] **Step 4: Add a `useEffect` to acquire/release wake lock when `isTimerActive` changes**

Find the existing timer `useEffect` that starts with:
```ts
  useEffect(() => {
    if (!isTimerActive) return;
```

Add a new `useEffect` directly **before** it:

```ts
  useEffect(() => {
    if (isTimerActive) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isTimerActive]);
```

### 3d — Re-acquire on visibility restore

- [ ] **Step 5: Update the `visibilitychange` handler inside the existing timer `useEffect`**

Find this block inside the timer `useEffect`:
```ts
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
```

Replace with:
```ts
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
        acquireWakeLock();
      }
    };
```

### 3e — Pre-warm audio on timer start

- [ ] **Step 6: Call `prewarmAudio()` in `updateSet` when a set is completed**

Find this block inside `updateSet` (around line 157):
```ts
    if (field === 'completed' && value === true && !wasCompleted) {
       timerEndTimeRef.current = Date.now() + configuredRestTime * 1000;
       setRestTimeRemaining(configuredRestTime);
       setIsTimerActive(true);
       setIsTimerMinimized(false);
    }
```

Replace with:
```ts
    if (field === 'completed' && value === true && !wasCompleted) {
       prewarmAudio();
       timerEndTimeRef.current = Date.now() + configuredRestTime * 1000;
       setRestTimeRemaining(configuredRestTime);
       setIsTimerActive(true);
       setIsTimerMinimized(false);
    }
```

### 3f — Verify and commit

- [ ] **Step 7: Verify TypeScript compiles with no errors**

```bash
cd "/Users/djedidiahw007/Desktop/Project/Workout App/gym-workout-tracker"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "feat: wire wake lock and audio pre-warm into rest timer"
```

---

## Manual Verification on iPhone

After all tasks are done, test on the iOS PWA:

1. Open the app from your home screen icon.
2. Start a workout. Complete a set — the rest timer should start.
3. Put your phone face-up on a table and do nothing. **The screen should stay on** for the full rest duration.
4. When the timer hits 0, **the alarm (three ascending beeps + vibration) should play**.
5. Cancel a timer mid-rest using "Skip Rest" — confirm the screen lock is released (screen will now sleep normally after your device's auto-lock time).
6. Start another set and minimize the timer pill. Confirm screen still stays on.

**Known limitation:** If you manually press the side button to lock your phone, iOS overrides the wake lock. The screen will turn off and the alarm will not play. This is an OS-level restriction that cannot be worked around in a web app.

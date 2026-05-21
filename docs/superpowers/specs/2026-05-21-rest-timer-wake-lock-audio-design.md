# Rest Timer: Screen Wake Lock + Audio Pre-Warm

**Date:** 2026-05-21
**Status:** Approved

## Problem

When using the rest timer on an iOS PWA (Safari, added to home screen):

1. **No alarm sound** — iOS suspends the Web Audio `AudioContext` when no user gesture has been made recently. The timer fires the alarm after a countdown but iOS won't allow audio unless the context was pre-unlocked by a touch event.
2. **Screen turns off** — if the rest timer is longer than the device's auto-lock timeout, the screen sleeps mid-timer, forcing the user to wake their phone manually.

## Solution: Option B — Wake Lock + Audio Pre-Warm

Two small, independent additions that together solve both problems.

---

## Section 1: Screen Wake Lock

### What

Acquire a `WakeLockSentinel` via `navigator.wakeLock.request('screen')` when the timer starts. Release it when the timer ends, is cancelled, or is skipped.

### Where

A new hook: `src/hooks/useWakeLock.ts`

### Interface

```ts
function useWakeLock(): {
  acquireWakeLock: () => Promise<void>;
  releaseWakeLock: () => Promise<void>;
}
```

### Behaviour

- `acquireWakeLock()` is called from `LiveWorkout.tsx` when `setIsTimerActive(true)` is called.
- `releaseWakeLock()` is called when the timer hits zero, is cancelled via the X button, or is skipped.
- The sentinel listens for its own `release` event (iOS can revoke the lock, e.g. battery saver). If released while the timer is still active, we re-acquire automatically.
- The existing `visibilitychange` listener in `LiveWorkout.tsx` also triggers a re-acquire attempt when the page becomes visible again and the timer is still running.
- No UI indicator needed — the effect is invisible to the user.

### Compatibility

Wrapped in try/catch. If `navigator.wakeLock` is absent or the request throws, it logs silently and the timer continues normally without screen lock. No user-facing error.

---

## Section 2: Audio Pre-Warm

### What

Play a silent (volume 0, duration 0.01s) oscillator the instant the user taps Start Timer. This touch-gesture-triggered call unlocks the `AudioContext` singleton on iOS so it is ready when the alarm fires later.

### Where

A new exported function in `src/timerAlarm.ts`: `prewarmAudio()`.

### Interface

```ts
export function prewarmAudio(): void
```

### Behaviour

- Called synchronously in the same event handler that starts the timer in `LiveWorkout.tsx`.
- Creates an oscillator with gain set to 0, starts and stops it immediately (0.01s).
- Reuses the existing `getAudioContext()` singleton — no new state.
- Already covered by the existing try/catch in `timerAlarm.ts`.

### Why this works

iOS requires audio to originate from a user-gesture call stack. The tap on "Start Timer" is that gesture. Pre-warming during the tap means the `AudioContext` is unlocked and stays unlocked for the duration of the rest period, so the alarm plays when the countdown hits zero.

---

## Section 3: Error Handling & Compatibility

| Scenario | Behaviour |
|---|---|
| `navigator.wakeLock` not supported (iOS < 16.4) | Silent fail, timer works normally |
| Wake lock revoked by OS (battery saver, phone locked manually) | Re-acquire attempted if timer still active |
| App regains visibility while timer running | Re-acquire attempted via existing `visibilitychange` handler |
| Audio pre-warm throws | Silent fail via existing try/catch |
| User locks phone manually mid-timer | Screen turns off (OS override — cannot prevent). Alarm will not play since screen is locked. |

The last row is a known limitation: if the user deliberately locks their phone, iOS suspends the PWA and no audio or wake lock can override that. This is acceptable behaviour.

---

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useWakeLock.ts` | New file — wake lock hook |
| `src/timerAlarm.ts` | Add `prewarmAudio()` export |
| `src/components/LiveWorkout.tsx` | Call `prewarmAudio()` + `acquireWakeLock()` on timer start; `releaseWakeLock()` on timer end/cancel; re-acquire on visibility change |

## Out of Scope

- Web Push Notifications (Option C) — marginal gain for iOS PWA, more complexity.
- Any UI indicator for wake lock state.
- Any changes to the alarm sound itself.

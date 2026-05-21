# Design: Live Workout UX Improvements

**Date:** 2026-05-21  
**Scope:** 5 targeted UX improvements to the LiveWorkout component and AI routine generator

---

## 1. Default Unit: Kilograms

### Problem
`LiveWorkout.tsx` defaults to `'lbs'` for both the active unit and the base unit ref. The AI routine generator also asks Gemini for weights in lbs and labels them as lbs in the preview.

### Changes
- `src/components/LiveWorkout.tsx:19` — change `useState` initial value from `'lbs'` to `'kgs'`
- `src/components/LiveWorkout.tsx:21` — change `baseUnitRef` initial value from `'lbs'` to `'kgs'`
- `server.ts:21` — schema weight description: `"Suggest starting weight in kgs"`
- `server.ts:36` — add to Gemini prompt: `"Use kilograms (kg) for all suggested weights."`
- `src/components/RoutineGenerator.tsx:179` — change hardcoded `lbs` label to `kgs`

### Constraints
- Existing draft sessions (saved in localStorage) restore correctly because the draft-restore logic already takes priority over the default value.
- No data migration needed — WorkoutLogs store the unit alongside the data.

---

## 2. Remove Individual Set — Mobile Visibility Fix

### Problem
`deleteSet()` and the per-row X button already exist (`LiveWorkout.tsx:179`, `LiveWorkout.tsx:578–585`). The button is hidden by `opacity-0 group-hover:opacity-100`, which is invisible on touch screens where hover does not exist.

### Change
- `src/components/LiveWorkout.tsx` — change the X button's CSS from `opacity-0 group-hover:opacity-100` to `sm:opacity-0 sm:group-hover:opacity-100`

This makes the delete-set button always visible on mobile (screens below `sm` breakpoint) and hover-reveal only on desktop. No logic changes.

---

## 3. Timer Alarm: Sound + Vibration

### Trigger
When `restTimeRemaining` reaches 0 (timer completes naturally — not when the user taps "Skip Rest").

### Sound
Use the Web Audio API to synthesize a short two-tone beep:
- Tone 1: 440 Hz for 150ms, then ramp to silence
- Tone 2: 880 Hz for 150ms, then ramp to silence
- Total duration: ~400ms
- No audio file required; no network request; works offline

Create an `AudioContext` lazily on the first user interaction (required by browser autoplay policy). Reuse the same context for the session lifetime.

### Vibration
Call `navigator.vibrate([200, 100, 200])` — a double-pulse pattern (200ms on, 100ms off, 200ms on). Silently no-ops on desktop or devices where the Vibration API is unsupported.

### Implementation location
Extract a `playAlarm()` utility function called inside the `setRestTimeRemaining` updater when `prev <= 1`. Only fires on natural completion, not on "Skip Rest" (which sets remaining directly to 0 without going through the countdown path).

---

## 4. Timer Survives App-Switching

### Problem
`setInterval` is throttled or paused by mobile browsers (especially iOS Safari) when the tab goes to the background. The current countdown decrements by 1 each second, so a paused interval produces incorrect remaining time on return.

### Fix: Timestamp-based countdown
- When the timer starts (or is extended with +30s), record `timerEndTimeRef = Date.now() + remaining * 1000` in a `useRef`.
- Each interval tick computes: `remaining = Math.max(0, Math.ceil((timerEndTimeRef.current - Date.now()) / 1000))`
- Add a `visibilitychange` event listener: when `document.visibilityState === 'visible'`, immediately recalculate remaining from the end timestamp and update state. This snaps the display to the correct value the moment the user returns to the app.

### Scope
- `isTimerActive` and `restTimeRemaining` state remain unchanged (UI reads `restTimeRemaining` as before)
- Only the update mechanism changes — from decrement-by-1 to timestamp-diff
- The alarm fires correctly because the timestamp diff will hit 0 regardless of interval throttling

---

## 5. Minimizable Rest Timer

### Current behavior
When `isTimerActive && restTimeRemaining > 0`, the full workout list is replaced by a full-screen timer takeover (`isTimerTakeover` block, `LiveWorkout.tsx:394`).

### New behavior
Add `isTimerMinimized` state (default: `false`).

**Full timer (default):** Unchanged appearance. Add a minimize button (line icon "—") in the top-right of the timer takeover panel. Tapping it sets `isTimerMinimized = true`.

**Minimized state:**
- The exercise list renders normally (full workout view is visible)
- A floating pill is rendered via `position: fixed`, centered horizontally, `bottom: 54px` (above the 46px sticky footer with safe-area buffer)
- Pill content: `[ ▶ 1:23  ·  Tap to expand ]` — countdown in red monospace, tap anywhere on pill to restore full timer
- Pill uses the same red color scheme as the timer for visual consistency
- When the timer hits 0 in minimized state: alarm fires, pill auto-dismisses (same as full timer dismissing)

**State transitions:**
- Timer starts → `isTimerMinimized = false` (always opens full)
- User taps minimize → `isTimerMinimized = true`
- User taps pill → `isTimerMinimized = false`
- Timer hits 0 → `isTimerActive = false`, `isTimerMinimized = false` (reset both)
- User taps "Skip Rest" → `isTimerActive = false`, `isTimerMinimized = false`

### Z-index
Pill uses `z-40` (below modals at `z-50`, above content).

---

## Files Changed

| File | Change |
|---|---|
| `src/components/LiveWorkout.tsx` | Default unit kgs, set-delete visibility, alarm logic, timestamp timer, minimizable timer |
| `server.ts` | Gemini prompt + schema updated to kgs |
| `src/components/RoutineGenerator.tsx` | Weight label changed to kgs |

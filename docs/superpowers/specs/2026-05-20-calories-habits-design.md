# Calories Tracking & Habit Tracker — Design Spec

**Date:** 2026-05-20
**Project:** Forge.AI Gym Workout Tracker
**Status:** Approved

---

## Overview

Two new features: (1) calorie tracking per workout session with analytics display, and (2) a standalone Habit Tracker tab with custom habits, daily actual logging, GitHub-style heatmaps, and streak stats. Both use the full-dashboard approach with date-range selectors, per-habit heatmaps, and bar chart calorie visualization.

---

## Section 1: Architecture & Data Model

### Calorie Data

No new Firestore collection. The existing `workoutLogs/{logId}` document gains one optional field:

```
workoutLogs/{logId}
  ...existing fields...
  calories?: number     // optional — not set if user skips
```

Editing calories in Analytics calls `updateDoc` on the existing document.

### Habit Data

Two new Firestore collections:

```
habits/{habitId}
  userId: string
  name: string          // e.g. "Intermittent Fasting"
  target: number        // e.g. 16
  unit: string          // e.g. "hours"
  createdAt: number     // epoch ms
  archived: boolean     // soft delete — false by default

habitLogs/{logId}
  userId: string
  habitId: string
  date: string          // "YYYY-MM-DD" — one entry per habit per day
  actual: number        // user-entered actual value
  createdAt: number     // epoch ms
```

**Upsert rule:** One `habitLog` per habit per day. If a user logs the same habit twice on the same day, the second write overwrites the first (query by `userId + habitId + date`, then update or create). This prevents duplicate rows and keeps queries simple.

**Firestore indexes required:**
- `habitLogs`: composite index on `userId` + `habitId` + `date`
- `habits`: index on `userId` + `archived`

**Date-range filtering** is performed client-side from a pre-fetched window — no complex server-side range queries needed beyond `userId`.

---

## Section 2: Calorie Tracking

### 2.1 Post-Finish Modal

**Location:** `src/components/LiveWorkout.tsx`

When the user taps "Finish Workout," the existing save logic runs first (writes the workout log to Firestore). Immediately after a successful save, a modal appears before navigating back to the Routines tab. The modal contains:

- Workout name and duration (read-only summary)
- A numeric input: "Calories burnt" with placeholder "e.g. 450" and unit label "kcal"
- Two buttons: **Save** (calls `updateDoc` to add `calories` to the log) and **Skip** (navigates away without setting `calories`)

The modal is non-blocking. Skip has zero friction — no confirmation required.

**State:** A `showCalorieModal` boolean + `savedLogId` string are added to `LiveWorkout` local state. The modal renders conditionally after the save completes.

### 2.2 Editing Calories in Analytics

**Location:** `src/components/ProgressView.tsx`

Each workout entry in the history list gains a small pencil icon (Lucide `Pencil`, 14px). Clicking it:
1. Replaces the calorie display with an inline `<input type="number">` pre-filled with the current value (or empty if not set)
2. Saves on blur or Enter key via `updateDoc`
3. Reverts to display mode on Escape or successful save

On save failure, the input shows a red border and an inline error message. Uses `handleFirestoreError` from `firestoreUtils.ts`.

### 2.3 Analytics Calorie Display

**Location:** `src/components/ProgressView.tsx` — new "Calories" section

**Date-range selector:** A 3-button toggle at the top of the Analytics tab — **This Week / Last 30 Days / All Time** — controls both the existing workout calendar and the new calorie chart. State lives at the top of `ProgressView`.

**Bar chart:**
- Pure SVG — no charting library
- One bar per day in the selected date range
- Bar height proportional to calories (auto-scaled to the max value in range)
- Days with no calorie data show an empty bar outline (dashed stroke)
- X-axis: date labels (Mon/Tue/... for week view, date numbers for 30-day/all-time)
- Y-axis: calorie scale with 3–4 tick marks
- Hovering a bar (desktop) or tapping (mobile) shows a tooltip: date + calorie value

**Summary row** below the chart:
- Total calories (selected range)
- Average calories per workout (only counts workouts with calories logged)
- Highest single session

---

## Section 3: Habit Tracker Tab

### 3.1 Navigation

A new **"Habits"** tab added to `Layout.tsx`. Uses Lucide `Target` icon. Positioned after Analytics in the tab order. The `App.tsx` lazy-mount system (added in the performance fixes) naturally extends to the new tab — no architectural change needed.

### 3.2 Habit Management

**Page header:** Title "Habits" + a "+ New Habit" button (top right).

**Creation modal** (also used for editing):
- Name: text input (required)
- Target: number input (required, positive)
- Unit: text input (required, e.g. "hours", "liters", "steps")
- Save / Cancel buttons

**Habit card layout:**
- Habit name (large) + target display ("Target: 16 hours")
- Today's logged actual inline (if logged: "Today: 12 hours" in accent color; if not logged: "Not logged today" in muted text)
- "Log today" button → opens log modal (see 3.3)
- Kebab menu (⋮) with: Edit, Archive
- Heatmap below the card header (see 3.4)
- Summary stats below the heatmap (see 3.5)

**Archived habits:**
- Hidden by default
- "Show archived" toggle at bottom of page reveals them with a visual indicator (muted/strikethrough name)
- Archived habits can be unarchived via the kebab menu

### 3.3 Daily Logging

"Log today" button opens a modal:
- Date field: defaults to today (read-only display, not editable — one entry per day)
- Actual value: number input pre-filled with yesterday's logged value as a hint (shown as placeholder text, not as the input value)
- Unit label next to input (e.g. "hours")
- Save / Cancel

**Upsert behavior:** On save, query `habitLogs` for `userId + habitId + date`. If exists, `updateDoc`. If not, `addDoc`. The UI updates optimistically — if the Firestore write fails, revert and show an inline error.

If today's log already exists, the "Log today" button label changes to **"Edit today"** and shows the current value inline on the card.

### 3.4 Heatmap

Each habit card includes a GitHub-style contribution heatmap.

**Full grid (All Time):** 52 columns × 7 rows = 364 cells, representing the past year. Columns are weeks (left = oldest, right = most recent). Rows are days of the week (Mon–Sun).

**Reduced views:**
- "This Week" — collapses to a single 7-cell horizontal row
- "Last 30 Days" — 30-cell horizontal strip

**Cell coloring:**
| Condition | Color |
|---|---|
| actual ≥ target | Green (`#22c55e`) |
| actual ≥ 50% of target | Amber (`#f59e0b`) |
| actual > 0 but < 50% of target | Red/muted (`#ef4444` at low opacity) |
| No data for that day | Empty / dark background |

**Interaction:**
- Desktop: hover tooltip showing date + actual + target (e.g. "May 20 — 12 / 16 hours")
- Mobile: tap tooltip, dismisses on tap-away
- Heatmap scrolls horizontally on mobile with current week snapped to right edge

**Date-range selector** (same 3-button toggle as Analytics, scoped to the Habits tab independently).

### 3.5 Summary Stats Per Habit

Below each heatmap, a 4-stat row:
- **Days logged** — total entries across all time
- **Hit rate** — (days where actual ≥ target) / (days logged) as a percentage
- **Current streak** — consecutive days ending today where actual ≥ target
- **Longest streak** — all-time record of consecutive days hitting target

Stats are computed client-side from the fetched `habitLogs` array.

---

## Section 4: Error Handling & Testing

### Error Handling

- All Firestore reads/writes use `handleFirestoreError` from `firestoreUtils.ts`
- Calorie modal: failed save shows an inline error message; the modal stays open so the user can retry or skip
- Habit log upsert: optimistic UI update — on failure, revert to previous value and show inline error on the card
- Offline writes: `persistentLocalCache()` queues writes for sync on reconnect — no special handling needed

### TypeScript

All new data shapes are added to `src/types.ts`:

```ts
// Addition to WorkoutLog
calories?: number;

// New types
interface Habit {
  id: string;
  userId: string;
  name: string;
  target: number;
  unit: string;
  createdAt: number;
  archived: boolean;
}

interface HabitLog {
  id: string;
  userId: string;
  habitId: string;
  date: string;        // "YYYY-MM-DD"
  actual: number;
  createdAt: number;
}
```

### Smoke Tests

| Test | Pass criteria |
|---|---|
| Finish workout → calorie modal appears | Modal shows after save, before nav |
| Skip calorie modal | Navigates back, no `calories` field on log |
| Save calorie modal | Log document updated, Analytics reflects new value |
| Edit calorie in Analytics | Inline edit saves, reverts on Escape |
| Bar chart — no data | Empty bar outlines render, no crash |
| Bar chart — multiple entries | Bars scale correctly, tooltips show |
| Date-range toggle | Both calendar and chart update consistently |
| Create habit | Appears in Habits tab immediately |
| Log today | Card shows "Edit today" + actual value |
| Log same day twice | Second entry overwrites first |
| Heatmap cell colors | Green/amber/red/empty per hit rate |
| Mobile heatmap scroll | Current week at right edge, no overflow |
| Archive habit | Hidden from default view |
| Show archived toggle | Reveals archived habits |
| Streak calculation | Consecutive days computed correctly |

---

## Out of Scope

- `onSnapshot` real-time listeners (reads use `getDocs` — same pattern as existing app)
- Push notifications or reminders for habits
- Calorie goal targets or calorie budget tracking
- Import/export of habit data
- Sharing or social features

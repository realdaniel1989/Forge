# Exercise Library — Design Spec
Date: 2026-05-20

## Overview

A personal exercise library that tracks which body part each exercise belongs to. The library auto-populates from saved routines (custom and AI-generated), deduplicates by normalized name, and integrates with the routine builder via autocomplete. A merge tool lets the user consolidate duplicate exercise names and retag all historical data.

---

## Data Model

New Firestore collection: `exerciseLibrary`

```
exerciseLibrary/{docId}
  userId:    string            — owner (matches auth UID)
  name:      string            — display name e.g. "Bench Press"
  nameKey:   string            — dedup key: name.trim().toLowerCase().replace(/\s+/g, '')
  bodyPart:  BodyPart          — e.g. "Chest"
  type:      'strength' | 'cardio'
  createdAt: number            — unix ms
```

**Deduplication rule:** Before inserting, check for an existing doc where `userId == currentUser.uid && nameKey == normalize(newName)`. If found, skip the insert. "Bench Press", "bench press", and "BenchPress" all normalize to `"benchpress"` and are treated as the same exercise.

**Normalization function:**
```ts
const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '');
```

---

## New Type

Add to `src/types.ts`:

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
```

---

## Components & Files

### New: `src/hooks/useExerciseLibrary.ts`

Shared hook used by `ExerciseLibrary`, `CustomRoutineBuilder`, and `RoutineGenerator`. Responsibilities:
- Fetch all `exerciseLibrary` docs for the current user once on mount, expose as `entries: ExerciseEntry[]`
- `addToLibrary(name, bodyPart, type)` — normalizes name, checks for existing `nameKey`, inserts if new
- `mergeExercises(primary: ExerciseEntry, secondary: ExerciseEntry)` — see Merge Operation below
- `updateBodyPart(id, newBodyPart)` — updates a single entry's `bodyPart` in Firestore

### New: `src/components/ExerciseLibrary.tsx`

New top-level tab. Renders:
- Page header ("My Exercises") with total count and "+ Add" button
- Search input — filters list client-side by name
- Exercises grouped by body part, sorted alphabetically within each group
- Per-row actions: inline body part edit (clicking the body part label reveals a `<select>` in place; saving updates Firestore), "merge" button, no delete (use merge to consolidate instead)
- Add modal: name input + body part select + type toggle — calls `addToLibrary`
- Merge flow: triggered from a row's "merge" button, user picks the primary exercise from a searchable list, confirm dialog with warning, calls `mergeExercises`

### Updated: `src/components/CustomRoutineBuilder.tsx`

- Import and call `useExerciseLibrary` on mount
- For the exercise name input field: as the user types, show a suggestion dropdown filtered from library entries (`nameKey` contains the typed value normalized)
- Selecting a suggestion fills `name` and `bodyPart` automatically; the body part dropdown becomes pre-filled but remains editable
- On `saveRoutine`: after the Firestore write, call `addToLibrary` for each valid exercise (skips existing ones silently)

### Updated: `src/components/RoutineGenerator.tsx`

- Import `useExerciseLibrary`
- In `onRoutineSaved` callback: call `addToLibrary` for each exercise in the saved routine

### Updated: `src/App.tsx`

- Add `routinesRefreshKey` pattern (already exists) — no changes needed there
- Mount `ExerciseLibrary` tab with the same lazy-mount + CSS display pattern as other tabs
- Add `exercises` to the tab set

### Updated: `src/components/Layout.tsx`

- Add "Exercises" nav item after "Generate" and before "Progress" in the tab order

---

## Data Flow

```
User saves custom routine
  → CustomRoutineBuilder.saveRoutine()
    → addDoc('routines', ...)
    → addToLibrary(name, bodyPart, type) per exercise  [skips duplicates]

AI routine saved
  → RoutineGenerator.onRoutineSaved()
    → addToLibrary(name, bodyPart, type) per exercise  [skips duplicates]

User types in builder exercise field
  → filter useExerciseLibrary.entries by normalize(input)
  → show dropdown suggestions
  → on select: fill name + bodyPart

User edits body part on library entry
  → updateBodyPart(id, newBodyPart)
    → updateDoc('exerciseLibrary/{id}', { bodyPart })

User adds exercise manually in library tab
  → addToLibrary(name, bodyPart, type)
```

---

## Merge Operation

Triggered from the Exercise Library tab. Steps:

1. User clicks "merge" on an exercise row (the **secondary** — will be removed)
2. User picks the **primary** exercise from a searchable dropdown (the one to keep)
3. Confirm dialog shows: "All past workouts and routines that used [secondary] will be updated to [primary]. This cannot be undone."
4. On confirm, `mergeExercises(primary, secondary)` runs:
   - Query all `workoutLogs` where `userId == uid`
   - For each log: scan `exercises` array, replace any entry where `nameKey` matches `secondary.nameKey` → set `name = primary.name`, `bodyPart = primary.bodyPart`
   - Query all `routines` where `userId == uid`
   - Same scan and replace on each routine's `exercises` array
   - Delete `secondary` doc from `exerciseLibrary`
   - Commit all writes as a single Firestore batch
5. On success: remove secondary from local state, show a brief success toast

**Error handling:** If the batch fails, show an error toast. No partial state is written (Firestore batch is atomic).

---

## Autocomplete Behavior in Builder

- Library is fetched once when `CustomRoutineBuilder` mounts
- Suggestions appear after the user types 1+ characters
- Matching is done on `nameKey`: `entry.nameKey.includes(normalize(input))`
- Suggestions show exercise name + body part tag
- Selecting a suggestion: fills name field + pre-selects body part dropdown
- If the user ignores suggestions and types a custom name, that name gets added to the library on routine save with whatever body part they selected

---

## Error Handling

- Library fetch failure: show inline error, builder still works (suggestions just won't appear)
- `addToLibrary` failure: silent — routine is already saved, library sync is best-effort
- `mergeExercises` failure: show error toast, no data is changed (batch atomicity)
- `updateBodyPart` failure: revert the UI optimistic update, show error toast

---

## Out of Scope

- Sharing exercises across users (global library)
- Exercise deletion (use merge to consolidate instead)
- Ordering/ranking exercises within the library
- Exercise notes or descriptions

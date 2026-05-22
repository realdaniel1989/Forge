# Tempo Feature — Design

**Date:** 2026-05-22
**Status:** Approved (pending user review of spec)

## Purpose

Let users attach a per-set tempo (eccentric · bottom-hold · concentric · top-hold) to each exercise in a routine, so they know how much time to spend on each phase of a rep. Display only — no active rep coach, no beeping, no animation. The tempo is reference text that the user paces against themselves.

The feature also enables per-set variation in planned reps and weight, so a single exercise can express schemes like ramp-ups, drop sets, or "slow last set" finishers.

## Scope

**In scope**
- New `Tempo` and `PlannedSet` types in `src/types.ts`.
- Optional `plannedSets` field on `Exercise` with a `getPlannedSets()` helper that derives from legacy `sets/reps/weight` when missing.
- Builder UI: per-set table with reps, weight, and four tempo inputs (Down / Hold / Up / Hold).
- LiveWorkout UI: read-only tempo chip on each planned-set row.
- RoutinesList preview: one headline tempo chip per exercise (set 1's tempo).
- AI generator: response schema updated to return `plannedSets` with per-set tempo; prompt updated to encourage purposeful variation.

**Out of scope**
- Active rep coach (metronome / beeping / animation).
- Per-set rest-time field.
- Tempo on cardio exercises.
- Firestore migration of existing routines — they keep working via lazy fallback.

## Data model

Add to `src/types.ts`:

```ts
export interface Tempo {
  down: number;        // eccentric, seconds (0–10)
  holdBottom: number;  // pause at bottom, seconds (0–10)
  up: number | 'X';    // concentric, seconds (0–10) — 'X' = explosive
  holdTop: number;     // pause at top, seconds (0–10)
}

export interface PlannedSet {
  reps: number;
  weight: number;
  tempo?: Tempo;       // optional — old data won't have it
}
```

Extend `Exercise`:

```ts
export interface Exercise {
  // existing fields stay: sets, reps, weight, trackedSets, ...
  plannedSets?: PlannedSet[];
}
```

### Lazy-fallback helper

```ts
export function getPlannedSets(exercise: Exercise): PlannedSet[] {
  if (exercise.plannedSets?.length) return exercise.plannedSets;
  const count = exercise.sets ?? 0;
  const reps = exercise.reps ?? 0;
  const weight = exercise.weight ?? 0;
  return Array.from({ length: count }, () => ({ reps, weight }));
}
```

Every UI consumer reads sets through `getPlannedSets()` — nothing checks `plannedSets` directly. This is what makes the lazy fallback invisible to the rest of the code.

Once a routine is saved with `plannedSets`, that becomes the source of truth on that routine. The legacy `sets/reps/weight` fields are not updated by new flows but are not removed either (back-compat for any read paths we haven't migrated).

## UI: CustomRoutineBuilder

Each exercise card grows a per-set table:

```
┌─ Bench Press ──────────────────────────────────────────┐
│ Chest                                              [✕] │
│                                                        │
│ Set  Reps  Weight  Tempo (Down·Hold·Up·Hold)           │
│  1   [10]  [60]    [3] [1] [2] [0]                     │
│  2   [10]  [60]    [3] [1] [2] [0]                     │
│  3   [ 8]  [65]    [3] [1] [X] [0]                     │
│       [+ Add set]      [Apply tempo to all sets ↕]     │
└────────────────────────────────────────────────────────┘
```

Behavior:
- The legacy single "sets" number input is removed from the builder. Number of sets = `plannedSets.length`, edited directly by adding/removing rows.
- Adding a set appends a row defaulted to the previous row's values — fast for "uniform sets" cases.
- Removing a set deletes the row and shifts trailing rows up.
- The four tempo inputs reuse `NumericInput`. The "Up" field also accepts `"X"` (case-insensitive, displayed as uppercase).
- "Apply tempo to all sets" copies row 1's tempo into every row.
- Tempo is optional. A row with no tempo entered stores `plannedSets[i]` without a `tempo` field; the four inputs show dimmed placeholders.
- The existing builder file is already large. Extract the per-exercise card into a new `<ExerciseSetTable />` subcomponent rather than growing `CustomRoutineBuilder.tsx` further.

## UI: LiveWorkout

Each planned set row gains a read-only tempo chip:

```
Set 1   10 × 60kg   3·1·2·0          [Done]
Set 2   10 × 60kg   3·1·2·0          [Done]
Set 3    8 × 65kg   3·1·X·0          [Done]
```

- Planned reps/weight come from `getPlannedSets(exercise)` so old routines still work.
- Actuals continue to live in the existing `trackedSets` array — unchanged.
- If a set has no tempo, the chip is omitted (no empty placeholder, no layout shift).
- Unplanned extra sets a user adds mid-workout appear in `trackedSets` only and have no chip.

## UI: RoutinesList preview

Each routine card stays dense — one row per exercise, with one headline tempo:

```
Push Day                                  6 exercises
─────────────────────────────────────────────────────
Bench Press         3×10  ·  3·1·2·0
Incline DB Press    3×10  ·  3·1·2·0
Chest Dips          3×12
Cable Flyes         3×15  ·  3·0·2·1
```

Rules:
- Show `N × R` where `N = plannedSets.length` and `R = plannedSets[0].reps` (set 1 is the headline).
- If any other set's reps differ from set 1, append a `+` indicator: `3×10+` signals "scheme varies".
- Show the chip for set 1's tempo only. If no tempo on set 1, omit the chip entirely.
- Full per-set detail is one tap away inside the builder/live view.

## AI Generator integration

`server.ts` response schema becomes:

```jsonc
{
  "name": "string",
  "exercises": [
    {
      "name": "string",
      "bodyPart": "Chest | Back | Shoulders | Biceps | Triceps | Legs | Core | Glutes | Forearms | Calves | Cardio",
      "tip": "string",
      "plannedSets": [
        {
          "reps": 10,
          "weight": 60,
          "tempo": { "down": 3, "holdBottom": 1, "up": 2, "holdTop": 0 }
        }
      ]
    }
  ]
}
```

Top-level `sets/reps/weight` are dropped from the AI response — new generated routines are pure `plannedSets`.

Prompt addition:

> For each exercise, return 3–5 planned sets. Vary `reps`, `weight`, and `tempo` across sets when it serves the goal (e.g. heavier/lower-rep on the last set, slower eccentric on a finisher set). When uniform sets are appropriate, repeat the same values — variation should serve the training intent, not be added for its own sake.

Server-side validation: if a returned exercise is missing `plannedSets`, or any set lacks `reps`/`weight`, the existing 3-attempt retry loop retries. If all attempts fail, the error surfaces to the UI as today.

## Edge cases & decisions

| Case | Decision |
|------|----------|
| `'X'` rendering | Stored as `'X'`, displayed as `X`. Treated as 0 if anything ever does math on duration (nothing does today). |
| Tempo input range | Each numeric value clamped `0–10`. Negative/NaN reverts on blur. |
| Unplanned set added in LiveWorkout | Lives in `trackedSets` only. No tempo chip on that row. |
| Set deleted in builder | Removes `plannedSets[i]`. Past `WorkoutLog` records unchanged — only the template is mutated. |
| Firestore schema | `plannedSets` is a nested array inside the existing `Exercise` object. No new collection, no new indexes, no security rule change. |
| Cardio exercises | No tempo UI rendered when `exercise.type === 'cardio'`. |

## Testing

- Unit test `getPlannedSets()`:
  - New-shape exercise returns `plannedSets` verbatim.
  - Legacy exercise returns N derived sets, no tempo.
  - Legacy exercise with `sets = 0` or missing fields returns `[]` safely.
- Manual UI smoke: build a routine with mixed-tempo sets, start a live workout against it, confirm chips render and actuals track independently of the plan.
- Manual AI smoke: generate a routine for one body part, confirm response parses, persists, and renders end-to-end.

## File touch list

- `src/types.ts` — new `Tempo`, `PlannedSet`, `getPlannedSets()`; extend `Exercise`.
- `src/components/CustomRoutineBuilder.tsx` — per-set table; extract `ExerciseSetTable` subcomponent.
- `src/components/LiveWorkout.tsx` — tempo chip per set row.
- `src/components/RoutinesList.tsx` — headline tempo chip + `N×R[+]` rendering.
- `src/components/RoutineGenerator.tsx` — consume new shape from the API response.
- `server.ts` — updated response shape description in the prompt + parsing.
- `src/types.test.ts` (new) — `getPlannedSets()` unit tests.

# Per-Exercise Body Part Tagging

**Date:** 2026-05-20
**Status:** Approved

## Problem

Analytics currently group workout volume by a single `bodyPart` label on the Routine/WorkoutLog. For total body workouts or any routine that hits multiple muscle groups, this produces inaccurate counts — all exercises get lumped under one body part. The weekly output needs to reflect what was actually trained at the exercise level.

## Solution

Add a `bodyPart` field to each individual exercise, sourced from a predefined list. Analytics aggregates by per-exercise body part instead of the workout-level label. Old data falls back to the workout-level `bodyPart`.

## Body Parts List

```typescript
export const BODY_PARTS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Core', 'Glutes', 'Forearms', 'Calves', 'Cardio'
] as const;

export type BodyPart = typeof BODY_PARTS[number];
```

This list is hardcoded. Users select from a dropdown — no free-text input.

## Data Model Changes

**`src/types.ts`:**

- Add `BODY_PARTS` constant and `BodyPart` union type
- Add `bodyPart?: BodyPart` to the `Exercise` interface

**Existing fields unchanged:**
- `Routine.bodyPart` and `WorkoutLog.bodyPart` remain as the workout-level label
- No migration needed — the new `Exercise.bodyPart` coexists with the workout-level field

## Backfill Strategy

When computing analytics, body part resolution for each exercise follows this priority:

1. `exercise.bodyPart` (new field, per-exercise)
2. `log.bodyPart` (workout-level fallback for old data)
3. Excluded from weekly output if neither exists

## AI Generation Changes

**`server.ts`:**

The Gemini prompt is updated to include the body parts list and instruct the model to assign one per exercise:

```
Generate a workout routine for the body part: ${bodyPart}.
For each exercise, assign a bodyPart from this exact list:
["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]
Choose the most appropriate body part that the exercise primarily targets.
```

The response schema adds `bodyPart` as a required string field on each exercise object.

No client-side changes needed in `RoutineGenerator.tsx` — the existing save flow passes the full exercise array through.

## Custom Routine Builder Changes

**`src/components/CustomRoutineBuilder.tsx`:**

- Each exercise row gets a required body part dropdown populated from `BODY_PARTS`
- The "Save Routine" button validates that every exercise has a `bodyPart` selected before writing to Firestore
- For AI-generated exercises that already have a `bodyPart`, the dropdown is pre-selected with that value but remains editable

## Live Workout Changes

**`src/components/LiveWorkout.tsx`:**

- When starting from a routine, exercises already carry their `bodyPart` and are saved into the `WorkoutLog` as-is
- The "Add Exercise" modal gets a required body part dropdown — user must select before adding
- Previous history filtering by body part continues to work with the new granular labels

## Analytics (Weekly Output) Changes

**`src/components/ProgressView.tsx`:**

The weekly output table is rewritten to aggregate by per-exercise body part:

1. For each day in the current week, find matching workout logs
2. For each exercise in those logs:
   - Resolve body part: `exercise.bodyPart` → fall back to `log.bodyPart` → skip if neither
   - Strength: count completed sets (`trackedSets` or `actualSets`)
   - Cardio: count minutes (`duration`)
3. Accumulate totals per body part across the entire week
4. Display sorted table: `Body Part` → `Volume` (total sets or cardio minutes)

**Example:** One Total Body Workout with 2 leg exercises (3 sets each), 1 chest exercise (4 sets), 1 back exercise (4 sets):

| Body Part | Volume |
|-----------|--------|
| Legs      | 6 sets |
| Chest     | 4 sets |
| Back      | 4 sets |

**Calendar unchanged:** Calendar cells continue showing workout names as they do today.

**Removed:** Old grouping by `log.bodyPart?.toUpperCase()` / `"MIXED"` is replaced entirely.

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `BODY_PARTS`, `BodyPart`, `bodyPart` on `Exercise` |
| `server.ts` | Update prompt + schema for per-exercise `bodyPart` |
| `src/components/CustomRoutineBuilder.tsx` | Required body part dropdown per exercise |
| `src/components/ProgressView.tsx` | Per-exercise body part aggregation for weekly output |
| `src/components/LiveWorkout.tsx` | Required body part dropdown in "Add Exercise" modal |

## Not Changed

- Calendar display (still shows workout names)
- Routine list
- Login / auth
- Theme system
- Habit tracker
- Firestore security rules (no new collections or fields requiring validation)

# Tempo Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users define per-set workout schemes (planned reps + weight + optional tempo) and see the tempo as a visible reference in the routine builder, the live workout view, and routine summaries. Old routines keep working through a lazy fallback.

**Architecture:** Add an optional `plannedSets: PlannedSet[]` field to `Exercise`. A single helper, `getPlannedSets()`, returns `plannedSets` when present and otherwise derives an equivalent array from the legacy `sets/reps/weight` fields. All UI consumers read sets through this helper, so the migration is invisible. The AI generator returns the new shape directly; the builder UI is rebuilt around a per-set table extracted into its own subcomponent.

**Tech Stack:** TypeScript, React 19, Vite, Express, Firebase Firestore. Tests use Vitest (added in Task 1).

**Spec reference:** `docs/superpowers/specs/2026-05-22-tempo-feature-design.md`

---

## File Structure

**Create:**
- `vitest.config.ts` — test runner config
- `src/tempoUtils.ts` — `getPlannedSets()`, `formatTempo()`, `emptyTempo()`
- `src/tempoUtils.test.ts` — unit tests
- `src/components/ExerciseSetTable.tsx` — per-set editing table extracted from the builder

**Modify:**
- `package.json` — add Vitest devDep + `test` script
- `src/types.ts` — add `Tempo`, `PlannedSet`; extend `Exercise`
- `server.ts` — new response schema and prompt
- `src/components/CustomRoutineBuilder.tsx` — replace inline set inputs with `<ExerciseSetTable />`
- `src/components/LiveWorkout.tsx` — derive `trackedSets` from `getPlannedSets`; render tempo chip per row
- `src/components/RoutinesList.tsx` — headline tempo chip + `N×R[+]` summary
- `src/components/RoutineGenerator.tsx` — render new shape in the preview

---

## Task 1: Add types, helper, and test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `src/types.ts`
- Create: `src/tempoUtils.ts`
- Create: `src/tempoUtils.test.ts`

- [ ] **Step 1.1: Install Vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 1.2: Add a `test` script to `package.json`**

Modify the `"scripts"` block — add `"test"`:

```jsonc
"scripts": {
  "dev": "tsx server.ts",
  "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
  "start": "node dist/server.cjs",
  "clean": "rm -rf dist server.js",
  "lint": "tsc --noEmit",
  "test": "vitest run"
}
```

- [ ] **Step 1.3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 1.4: Add types to `src/types.ts`**

Append to `src/types.ts` (after the existing `Exercise` interface):

```ts
export interface Tempo {
  down: number;        // eccentric, 0–10s
  holdBottom: number;  // pause at bottom, 0–10s
  up: number | 'X';    // concentric, 0–10s — 'X' = explosive
  holdTop: number;     // pause at top, 0–10s
}

export interface PlannedSet {
  reps: number;
  weight: number;
  tempo?: Tempo;
}
```

Then extend the `Exercise` interface — add one line inside it:

```ts
export interface Exercise {
  // ... existing fields stay unchanged ...
  plannedSets?: PlannedSet[];
}
```

- [ ] **Step 1.5: Write the failing test at `src/tempoUtils.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getPlannedSets, formatTempo, emptyTempo } from './tempoUtils';
import type { Exercise, PlannedSet } from './types';

describe('getPlannedSets', () => {
  it('returns plannedSets when present', () => {
    const planned: PlannedSet[] = [
      { reps: 10, weight: 60, tempo: { down: 3, holdBottom: 1, up: 2, holdTop: 0 } },
      { reps: 8, weight: 65 },
    ];
    const ex: Exercise = { name: 'Bench', plannedSets: planned };
    expect(getPlannedSets(ex)).toBe(planned);
  });

  it('derives plannedSets from legacy sets/reps/weight when missing', () => {
    const ex: Exercise = { name: 'Squat', sets: 3, reps: 5, weight: 100 };
    expect(getPlannedSets(ex)).toEqual([
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
    ]);
  });

  it('returns empty array when legacy fields are missing', () => {
    const ex: Exercise = { name: 'Mystery' };
    expect(getPlannedSets(ex)).toEqual([]);
  });

  it('treats sets=0 as empty', () => {
    const ex: Exercise = { name: 'Zero', sets: 0, reps: 10, weight: 50 };
    expect(getPlannedSets(ex)).toEqual([]);
  });

  it('treats an empty plannedSets array as legacy fallback', () => {
    const ex: Exercise = { name: 'Bench', plannedSets: [], sets: 2, reps: 5, weight: 50 };
    expect(getPlannedSets(ex)).toEqual([
      { reps: 5, weight: 50 },
      { reps: 5, weight: 50 },
    ]);
  });
});

describe('formatTempo', () => {
  it('formats numeric tempo with middle dots', () => {
    expect(formatTempo({ down: 3, holdBottom: 1, up: 2, holdTop: 0 })).toBe('3·1·2·0');
  });

  it('formats X concentric', () => {
    expect(formatTempo({ down: 3, holdBottom: 1, up: 'X', holdTop: 0 })).toBe('3·1·X·0');
  });

  it('returns null for undefined tempo', () => {
    expect(formatTempo(undefined)).toBeNull();
  });
});

describe('emptyTempo', () => {
  it('returns all-zero tempo', () => {
    expect(emptyTempo()).toEqual({ down: 0, holdBottom: 0, up: 0, holdTop: 0 });
  });
});
```

- [ ] **Step 1.6: Run the test to confirm it fails**

```bash
npm test
```

Expected: FAIL with `Cannot find module './tempoUtils'` or similar resolution error.

- [ ] **Step 1.7: Create `src/tempoUtils.ts`**

```ts
import type { Exercise, PlannedSet, Tempo } from './types';

export function getPlannedSets(exercise: Exercise): PlannedSet[] {
  if (exercise.plannedSets && exercise.plannedSets.length > 0) {
    return exercise.plannedSets;
  }
  const count = exercise.sets ?? 0;
  if (count <= 0) return [];
  const reps = exercise.reps ?? 0;
  const weight = exercise.weight ?? 0;
  return Array.from({ length: count }, () => ({ reps, weight }));
}

export function formatTempo(tempo: Tempo | undefined): string | null {
  if (!tempo) return null;
  return `${tempo.down}·${tempo.holdBottom}·${tempo.up}·${tempo.holdTop}`;
}

export function emptyTempo(): Tempo {
  return { down: 0, holdBottom: 0, up: 0, holdTop: 0 };
}
```

- [ ] **Step 1.8: Run the test to confirm it passes**

```bash
npm test
```

Expected: PASS — 9 tests, 3 describe blocks.

- [ ] **Step 1.9: Type check**

```bash
npm run lint
```

Expected: no output (success).

- [ ] **Step 1.10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/types.ts src/tempoUtils.ts src/tempoUtils.test.ts
git commit -m "feat(tempo): add Tempo/PlannedSet types and getPlannedSets helper"
```

---

## Task 2: Update the AI generator to return the new shape

**Files:**
- Modify: `server.ts:5-67`

- [ ] **Step 2.1: Replace the schema description and prompt in `server.ts`**

Find this block:

```ts
const schemaDescription = `{
  "name": "string (engaging name for the routine)",
  "exercises": [
    {
      "name": "string",
      "bodyPart": "one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio",
      "sets": number,
      "reps": number,
      "weight": number (starting weight in kg),
      "tip": "string (brief form tip)"
    }
  ]
}`;
```

Replace it with:

```ts
const schemaDescription = `{
  "name": "string (engaging name for the routine)",
  "exercises": [
    {
      "name": "string",
      "bodyPart": "one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio",
      "tip": "string (brief form tip)",
      "plannedSets": [
        {
          "reps": number,
          "weight": number (starting weight in kg),
          "tempo": { "down": number, "holdBottom": number, "up": number | "X", "holdTop": number }
        }
      ]
    }
  ]
}`;
```

Then find the prompt body inside `callModel`:

```ts
const prompt = `Generate a workout routine for the body part: ${bodyPart}.
Respond with ONLY a JSON object matching this exact shape (no markdown, no commentary):
${schemaDescription}
Include up to 6 exercises maximum.
Specify sets, reps, weight (kg), and a brief tip for each exercise.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part the exercise primarily targets.`;
```

Replace with:

```ts
const prompt = `Generate a workout routine for the body part: ${bodyPart}.
Respond with ONLY a JSON object matching this exact shape (no markdown, no commentary):
${schemaDescription}
Include up to 6 exercises maximum.
For each exercise, return 3–5 entries in plannedSets. Each entry has reps, weight (kg), and a tempo object.
Tempo numbers are seconds (0–10) for each phase: down (eccentric), holdBottom, up (concentric), holdTop. Use "X" for the up phase to mean explosive.
Vary reps, weight, and tempo across sets when it serves the training goal — for example a heavier/lower-rep top set, or a slower eccentric finisher. When uniform sets are appropriate, repeat the same values. Variation should serve intent, not be added for its own sake.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part the exercise primarily targets.`;
```

- [ ] **Step 2.2: Restart the dev server**

```bash
lsof -ti :3000 | xargs -r kill
npm run dev &
sleep 3
```

- [ ] **Step 2.3: Smoke-test the endpoint**

```bash
curl -s -X POST http://localhost:3000/api/generate-workout \
  -H "Content-Type: application/json" \
  -d '{"bodyPart":"Chest"}' | python3 -m json.tool
```

Expected: JSON with `name` and `exercises`. Each exercise has `name`, `bodyPart`, `tip`, and a `plannedSets` array. Each planned set has `reps`, `weight`, and a `tempo` object with `down/holdBottom/up/holdTop`. If the model omits `plannedSets` on any exercise, rerun once — the model is non-deterministic. If it fails twice in a row, fix the prompt before continuing.

- [ ] **Step 2.4: Type check**

```bash
npm run lint
```

Expected: no output.

- [ ] **Step 2.5: Commit**

```bash
git add server.ts
git commit -m "feat(tempo): AI generator returns plannedSets with per-set tempo"
```

---

## Task 3: Build the `ExerciseSetTable` subcomponent

This is a pure presentational component. It owns rendering the per-set table for a single strength exercise. Cardio exercises don't use it — they keep their existing duration/distance inputs.

**Files:**
- Create: `src/components/ExerciseSetTable.tsx`

- [ ] **Step 3.1: Create `src/components/ExerciseSetTable.tsx`**

```tsx
import React from 'react';
import { Trash2 } from 'lucide-react';
import type { PlannedSet, Tempo } from '../types';
import { emptyTempo } from '../tempoUtils';
import { NumericInput } from './NumericInput';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

interface Props {
  sets: PlannedSet[];
  onChange: (next: PlannedSet[]) => void;
}

const numInputClass =
  "w-full bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-2 py-2 text-[13px] text-[var(--ink)] outline-none text-center transition-colors focus:border-[var(--ash)]";
const tempoInputClass =
  "w-10 bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-md px-1 py-1.5 text-[12px] text-[var(--ink)] outline-none text-center transition-colors focus:border-[var(--ash)]";
const labelClass = "block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1";

const clampTempoNum = (n: number) => Math.min(10, Math.max(0, Math.round(n)));

export const ExerciseSetTable: React.FC<Props> = ({ sets, onChange }) => {
  const updateSet = (idx: number, patch: Partial<PlannedSet>) => {
    const next = sets.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const updateTempo = (idx: number, patch: Partial<Tempo>) => {
    const current = sets[idx].tempo ?? emptyTempo();
    const tempo: Tempo = { ...current, ...patch };
    updateSet(idx, { tempo });
  };

  const addRow = () => {
    const prev = sets[sets.length - 1];
    const newRow: PlannedSet = prev
      ? { reps: prev.reps, weight: prev.weight, tempo: prev.tempo ? { ...prev.tempo } : undefined }
      : { reps: 10, weight: 0 };
    onChange([...sets, newRow]);
  };

  const removeRow = (idx: number) => {
    onChange(sets.filter((_, i) => i !== idx));
  };

  const applyTempoToAll = () => {
    const first = sets[0]?.tempo;
    if (!first) return;
    onChange(sets.map(s => ({ ...s, tempo: { ...first } })));
  };

  const renderUpInput = (idx: number, tempo: Tempo) => {
    const value = tempo.up;
    const display = value === 'X' ? 'X' : String(value);
    return (
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={e => {
          const raw = e.target.value.trim().toUpperCase();
          if (raw === 'X') {
            updateTempo(idx, { up: 'X' });
            return;
          }
          const n = parseInt(raw, 10);
          if (Number.isNaN(n)) {
            updateTempo(idx, { up: 0 });
            return;
          }
          updateTempo(idx, { up: clampTempoNum(n) });
        }}
        className={tempoInputClass}
        aria-label={`Set ${idx + 1} concentric (up) seconds or X for explosive`}
      />
    );
  };

  if (sets.length === 0) {
    return (
      <div className="border border-dashed border-[var(--hairline-2)] rounded-lg py-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--stone)] mb-2" style={condensed}>
          No sets yet
        </p>
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
          style={condensed}
        >
          + Add set
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[28px_64px_72px_1fr_36px] gap-2 items-end pb-1.5 border-b border-[var(--hairline)]">
        <span className={labelClass} style={condensed}>Set</span>
        <span className={labelClass} style={condensed}>Reps</span>
        <span className={labelClass} style={condensed}>Wt</span>
        <span className={labelClass} style={condensed}>Tempo (Down · Hold · Up · Hold)</span>
        <span />
      </div>

      {sets.map((s, idx) => {
        const tempo = s.tempo ?? emptyTempo();
        return (
          <div
            key={idx}
            className="grid grid-cols-[28px_64px_72px_1fr_36px] gap-2 items-center py-1.5 border-b border-[var(--hairline)]"
          >
            <span className="text-[12px] text-[var(--stone)] font-mono">{idx + 1}</span>
            <NumericInput
              integer
              min={1}
              value={s.reps}
              onChange={n => updateSet(idx, { reps: n })}
              className={numInputClass}
            />
            <NumericInput
              min={0}
              value={s.weight}
              onChange={n => updateSet(idx, { weight: n })}
              className={numInputClass}
            />
            <div className="flex items-center gap-1">
              <NumericInput
                integer
                min={0}
                value={typeof tempo.down === 'number' ? tempo.down : 0}
                onChange={n => updateTempo(idx, { down: clampTempoNum(n) })}
                className={tempoInputClass}
              />
              <NumericInput
                integer
                min={0}
                value={tempo.holdBottom}
                onChange={n => updateTempo(idx, { holdBottom: clampTempoNum(n) })}
                className={tempoInputClass}
              />
              {renderUpInput(idx, tempo)}
              <NumericInput
                integer
                min={0}
                value={tempo.holdTop}
                onChange={n => updateTempo(idx, { holdTop: clampTempoNum(n) })}
                className={tempoInputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="p-1.5 text-[var(--stone)] hover:text-[var(--action)] transition-colors border-none bg-none cursor-pointer"
              aria-label={`Remove set ${idx + 1}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2.5">
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
          style={condensed}
        >
          + Add set
        </button>
        <button
          type="button"
          onClick={applyTempoToAll}
          disabled={!sets[0]?.tempo}
          className="px-3 py-1.5 rounded-full bg-transparent border border-[var(--hairline-2)] text-[var(--stone)] text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] hover:text-[var(--ash)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={condensed}
        >
          Apply tempo to all sets ↕
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3.2: Type check**

```bash
npm run lint
```

Expected: no output. If `NumericInput` props don't match (e.g. it doesn't accept `integer`), open `src/components/NumericInput.tsx` and confirm the existing prop names — adjust the new code to match. (The existing builder uses `<NumericInput integer min={1} value={...} onChange={...} className={...} />`, so these props exist.)

- [ ] **Step 3.3: Commit**

```bash
git add src/components/ExerciseSetTable.tsx
git commit -m "feat(tempo): add ExerciseSetTable per-set editing component"
```

---

## Task 4: Wire `ExerciseSetTable` into `CustomRoutineBuilder`

The current builder shows two inputs per strength exercise: "Sets" and "Reps". Replace them with the new per-set table. Initialize new strength exercises with a single planned set instead of `sets: 3, reps: 10`.

**Files:**
- Modify: `src/components/CustomRoutineBuilder.tsx:22-23` (initial state for strength)
- Modify: `src/components/CustomRoutineBuilder.tsx:217-228` (the strength Sets/Reps block)

- [ ] **Step 4.1: Import the new component and helper**

In `src/components/CustomRoutineBuilder.tsx`, add to the imports near the top:

```ts
import { ExerciseSetTable } from './ExerciseSetTable';
import { getPlannedSets } from '../tempoUtils';
import type { PlannedSet } from '../types';
```

- [ ] **Step 4.2: Update `addExercise` for strength**

Find:

```ts
if (type === 'strength') {
  setExercises([...exercises, { name: '', sets: 3, reps: 10, weight: 0, type: 'strength', bodyPart: undefined }]);
}
```

Replace with:

```ts
if (type === 'strength') {
  setExercises([...exercises, {
    name: '',
    type: 'strength',
    bodyPart: undefined,
    plannedSets: [
      { reps: 10, weight: 0 },
      { reps: 10, weight: 0 },
      { reps: 10, weight: 0 },
    ],
  }]);
}
```

- [ ] **Step 4.3: Replace the strength "Sets/Reps" inputs with the table**

In the JSX, find this block (inside the `exercises.map` loop, the `ex.type !== 'cardio'` branch):

```tsx
<>
  <div className="w-16">
    <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Sets</label>
    <NumericInput integer min={1} value={ex.sets || 1} onChange={n => updateExercise(idx, 'sets', n)} className={numInputClass} />
  </div>
  <div className="w-16">
    <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Reps</label>
    <NumericInput integer min={1} value={ex.reps || 1} onChange={n => updateExercise(idx, 'reps', n)} className={numInputClass} />
  </div>
</>
```

Replace it with: **nothing inline** — the inputs move below the row. Delete that whole `<>...</>` block.

Then, immediately after the trash-button `</button>` that closes the row, add a full-width set table on its own line. Locate the closing `</div>` of the row wrapper that opens with `<div key={idx} className="py-4 border-b border-[var(--hairline)] flex gap-3 items-end flex-wrap">`. Just *inside* that closing `</div>` (before it), insert:

```tsx
{ex.type !== 'cardio' && (
  <div className="basis-full mt-2">
    <ExerciseSetTable
      sets={getPlannedSets(ex)}
      onChange={(next: PlannedSet[]) => updateExercise(idx, 'plannedSets', next)}
    />
  </div>
)}
```

The `basis-full` makes it wrap onto a new line under the row even though the parent uses `flex-wrap`.

- [ ] **Step 4.4: Type check**

```bash
npm run lint
```

Expected: no output.

- [ ] **Step 4.5: Manual UI smoke**

```bash
lsof -ti :3000 | xargs -r kill
npm run dev &
sleep 3
```

Open http://localhost:3000, navigate to "Build Routine", add a strength exercise. Confirm:
- The per-set table appears under the exercise row.
- Three rows are present by default (reps 10, weight 0, blank tempo).
- Adding a row inherits the previous row's values.
- Removing a row works.
- Typing `X` into the "Up" tempo field shows `X`.
- Saving the routine succeeds (Firestore call shouldn't 4xx).

- [ ] **Step 4.6: Commit**

```bash
git add src/components/CustomRoutineBuilder.tsx
git commit -m "feat(tempo): per-set table in CustomRoutineBuilder"
```

---

## Task 5: Render tempo chip in `LiveWorkout`

LiveWorkout already maps `exercise.trackedSets` to render set rows for actual reps/weight. The plan side is currently inferred from `ex.sets/ex.reps`. We need two things: (a) init `trackedSets` from `getPlannedSets()` so old routines still work and new routines pick up per-set planned values, and (b) render a small read-only tempo chip from the corresponding `plannedSets[i]`.

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

- [ ] **Step 5.1: Add the helper import**

Near the existing imports in `src/components/LiveWorkout.tsx`, add:

```ts
import { getPlannedSets, formatTempo } from '../tempoUtils';
```

- [ ] **Step 5.2: Initialize `trackedSets` from `plannedSets`**

Find this block (around line 263–267):

```ts
trackedSets: Array.from({ length: ex.sets }).map(() => ({
  reps: ex.reps,
  weight: ex.weight || 0,
  completed: false,
})),
```

Replace with:

```ts
trackedSets: getPlannedSets(ex).map(p => ({
  reps: p.reps,
  weight: p.weight,
  completed: false,
})),
```

If there are other call-sites that build `trackedSets` from `ex.sets/ex.reps/ex.weight` (search for `length: ex.sets` and `Array.from`), leave them alone *unless* they're initializing a planned shape — `addExercise` (around line 467) creates an ad-hoc exercise during a live workout and should keep its single default row.

- [ ] **Step 5.3: Update the headline `${ex.sets}×${ex.reps}` rendering**

Find the line that renders the small header chip (around line 97):

```tsx
<span className="font-mono text-[10px] text-[var(--muted)] shrink-0">{ex.sets}×{ex.reps}</span>
```

Replace with:

```tsx
{(() => {
  const planned = getPlannedSets(ex);
  if (planned.length === 0) return null;
  const headlineReps = planned[0].reps;
  const repsVary = planned.some(p => p.reps !== headlineReps);
  return (
    <span className="font-mono text-[10px] text-[var(--muted)] shrink-0">
      {planned.length}×{headlineReps}{repsVary ? '+' : ''}
    </span>
  );
})()}
```

- [ ] **Step 5.4: Render a tempo chip per set row**

Find the set-row render block (around line 156–195). Each row is rendered inside `ex.trackedSets?.map((set, setIdx) => { ... })`. The row already contains a "Set N / total" label and inputs for weight + reps.

We need access to the corresponding planned set's tempo. Locate the line `const prevSet = history?.sets[setIdx];` (around line 158) — it's the first line inside the `.map` body. Insert two new lines immediately above it, so the start of the map body becomes:

```tsx
{ex.trackedSets?.map((set, setIdx) => {
  const planned = getPlannedSets(ex);
  const tempoStr = formatTempo(planned[setIdx]?.tempo);
  const prevSet = history?.sets[setIdx];
  // ...rest of existing body stays as-is...
```

(Recomputing `getPlannedSets(ex)` on each row is fine — the helper is O(N) and N is single digits. Avoids restructuring the outer JSX.)

Inside the row JSX, look for the existing per-set header (the element that shows `{String(setIdx + 1).padStart(2, '0')} / {ex.sets}` around line 171). Right after the closing tag of that element, insert the chip:

```tsx
{tempoStr && (
  <div className="font-mono text-[10px] text-[var(--muted)] mt-0.5">{tempoStr}</div>
)}
```

If the layout makes a stacked chip awkward, place it inline with the set label using flex. The chip should appear once per set row, dim, read-only.

Also update the `{ex.sets}` reference in the set label itself — change `{String(setIdx + 1).padStart(2, '0')} / {ex.sets}` to `{String(setIdx + 1).padStart(2, '0')} / {ex.trackedSets?.length ?? 0}` so the "X / Y" total reflects the actual tracked count rather than the legacy `sets` number.

- [ ] **Step 5.5: Update the `addExercise` ad-hoc init (line ~485-496) so library/history-driven exercises still work**

That block creates `trackedSets` for an exercise added mid-workout. It already uses `sets: 1` and `reps: 10` for a blank insert and `fromHistory.sets.length` for a history-driven insert. Leave it alone — there's no planned tempo for these ad-hoc adds, and `formatTempo(undefined)` returns `null` so the chip simply doesn't render. No change needed.

- [ ] **Step 5.6: Type check**

```bash
npm run lint
```

Expected: no output.

- [ ] **Step 5.7: Manual UI smoke**

Make sure the dev server is running. Open http://localhost:3000, start a Live Workout against the routine you built in Task 4.

Confirm:
- The header for each exercise shows `3×10` (no `+` when reps are uniform).
- If you go back to the builder, edit set 3's reps to `8`, save, and restart the workout, the header now shows `3×10+`.
- Each set row shows a small tempo chip when you've entered a tempo in the builder.
- Completing sets and saving the workout still works.

- [ ] **Step 5.8: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "feat(tempo): render per-set tempo chip in LiveWorkout"
```

---

## Task 6: Update `RoutinesList` summary

**Files:**
- Modify: `src/components/RoutinesList.tsx`

- [ ] **Step 6.1: Add the helper import**

```ts
import { getPlannedSets, formatTempo } from '../tempoUtils';
```

- [ ] **Step 6.2: Update `totalSets` calculation**

Find (around line 135):

```tsx
const totalSets = routine.exercises.reduce((acc, ex) => acc + (ex.sets || 0), 0);
```

Replace with:

```tsx
const totalSets = routine.exercises.reduce(
  (acc, ex) => acc + (ex.type === 'cardio' ? 0 : getPlannedSets(ex).length),
  0,
);
```

- [ ] **Step 6.3: Update the compact exercise list (around line 172)**

Find:

```tsx
: (ex.sets && ex.reps) ? <span className="text-[11px] text-[var(--stone)] ml-1" style={condensed}>{ex.sets}×{ex.reps}</span> : null
```

Replace with a self-contained inline IIFE that renders `N×R[+]` plus a tempo chip:

```tsx
: (() => {
    const planned = getPlannedSets(ex);
    if (planned.length === 0) return null;
    const headlineReps = planned[0].reps;
    const repsVary = planned.some(p => p.reps !== headlineReps);
    const tempoStr = formatTempo(planned[0].tempo);
    return (
      <span className="text-[11px] text-[var(--stone)] ml-1" style={condensed}>
        {planned.length}×{headlineReps}{repsVary ? '+' : ''}
        {tempoStr && <span className="ml-2 font-mono text-[var(--muted)]">· {tempoStr}</span>}
      </span>
    );
  })()
```

- [ ] **Step 6.4: Update the expanded exercise list (around line 225)**

Find:

```tsx
<span>{ex.name}{ex.type === 'cardio' ? ex.duration ? <span className="text-[11px] text-[var(--stone)] ml-1.5" style={condensed}>{ex.duration} min</span> : null : (ex.sets && ex.reps) ? <span className="text-[11px] text-[var(--stone)] ml-1.5" style={condensed}>{ex.sets}×{ex.reps}</span> : null}</span>
```

Replace the strength branch with the same IIFE pattern (margin `ml-1.5` to match the surrounding style):

```tsx
<span>
  {ex.name}
  {ex.type === 'cardio' ? (
    ex.duration ? <span className="text-[11px] text-[var(--stone)] ml-1.5" style={condensed}>{ex.duration} min</span> : null
  ) : (() => {
    const planned = getPlannedSets(ex);
    if (planned.length === 0) return null;
    const headlineReps = planned[0].reps;
    const repsVary = planned.some(p => p.reps !== headlineReps);
    const tempoStr = formatTempo(planned[0].tempo);
    return (
      <span className="text-[11px] text-[var(--stone)] ml-1.5" style={condensed}>
        {planned.length}×{headlineReps}{repsVary ? '+' : ''}
        {tempoStr && <span className="ml-2 font-mono text-[var(--muted)]">· {tempoStr}</span>}
      </span>
    );
  })()}
</span>
```

- [ ] **Step 6.5: Type check**

```bash
npm run lint
```

Expected: no output.

- [ ] **Step 6.6: Manual UI smoke**

Open http://localhost:3000 and look at the routines list. Confirm:
- Routines saved before the change still show `N×R` (no tempo chip — they fall back to legacy fields).
- Routines saved in Task 4 show `N×R` and a tempo chip when tempo was entered.
- A routine with varied reps across sets shows `+` after `R`.
- The summary count ("`N` sets") still matches the visible number of planned sets.

- [ ] **Step 6.7: Commit**

```bash
git add src/components/RoutinesList.tsx
git commit -m "feat(tempo): headline tempo chip in RoutinesList preview"
```

---

## Task 7: Update `RoutineGenerator` preview

The generator's response now includes `plannedSets`. Its in-page preview needs to render the new shape; the existing save path passes the exercises through verbatim to Firestore, so no save change is needed.

**Files:**
- Modify: `src/components/RoutineGenerator.tsx`

- [ ] **Step 7.1: Add the helper import**

```ts
import { getPlannedSets, formatTempo } from '../tempoUtils';
```

- [ ] **Step 7.2: Update the per-exercise summary**

Find (around line 171):

```tsx
<span className="text-[13px] font-semibold text-[var(--stone)] shrink-0" style={condensed}>
  {ex.type === 'cardio' ? `${ex.duration} min` : `${ex.sets} × ${ex.reps}`}
</span>
```

Replace with:

```tsx
<span className="text-[13px] font-semibold text-[var(--stone)] shrink-0" style={condensed}>
  {ex.type === 'cardio' ? `${ex.duration} min` : (() => {
    const planned = getPlannedSets(ex);
    if (planned.length === 0) return '—';
    const headlineReps = planned[0].reps;
    const repsVary = planned.some(p => p.reps !== headlineReps);
    return `${planned.length} × ${headlineReps}${repsVary ? '+' : ''}`;
  })()}
</span>
```

- [ ] **Step 7.3: Update the "Suggested weight" line (around line 177)**

Find:

```tsx
{ex.weight > 0 && (
  <p className="text-[11px] text-[var(--stone)] mt-1 uppercase tracking-[0.06em]" style={condensed}>
    Suggested: {ex.weight} kgs
  </p>
)}
```

Replace with:

```tsx
{(() => {
  const planned = getPlannedSets(ex);
  if (planned.length === 0) return null;
  const w = planned[0].weight;
  const tempoStr = formatTempo(planned[0].tempo);
  return (
    <p className="text-[11px] text-[var(--stone)] mt-1 uppercase tracking-[0.06em]" style={condensed}>
      {w > 0 && <>Suggested: {w} kgs</>}
      {w > 0 && tempoStr && <span className="mx-1.5">·</span>}
      {tempoStr && <span className="font-mono normal-case tracking-normal">Tempo {tempoStr}</span>}
    </p>
  );
})()}
```

- [ ] **Step 7.4: Type check**

```bash
npm run lint
```

Expected: no output.

- [ ] **Step 7.5: Manual end-to-end smoke**

Open http://localhost:3000 → AI Generator. Enter a body part, generate. Confirm:
- The preview shows each exercise with `N × R` (and `+` if varied).
- Tempo strings appear under exercises that include tempo.
- Saving the generated routine completes. Then open Routines list → the new routine renders correctly with tempo chips.
- Starting a Live Workout against that routine renders the per-set tempo chips.

- [ ] **Step 7.6: Commit**

```bash
git add src/components/RoutineGenerator.tsx
git commit -m "feat(tempo): render plannedSets and tempo in AI generator preview"
```

---

## Task 8: Final cross-cutting verification

No code changes — only a verification pass against the full spec.

- [ ] **Step 8.1: Run all checks**

```bash
npm test
npm run lint
```

Expected: tests pass, no type errors.

- [ ] **Step 8.2: Verify spec coverage matrix**

For each spec section, point to the file/task that satisfies it:

| Spec section | Where implemented |
|---|---|
| Data model: `Tempo`, `PlannedSet`, optional `plannedSets` | Task 1 (`src/types.ts`) |
| Lazy-fallback helper `getPlannedSets()` | Task 1 (`src/tempoUtils.ts`) |
| Builder per-set table with `[+ Add set]` and "Apply tempo to all sets" | Tasks 3 + 4 |
| Legacy "sets" input removed from builder | Task 4.3 |
| `X` accepted in Up field, displayed as `X` | Task 3 (`renderUpInput`) |
| Tempo clamped 0–10 | Task 3 (`clampTempoNum`) |
| LiveWorkout: planned sets derived from helper; per-set tempo chip | Task 5 |
| RoutinesList: `N×R[+]` and headline tempo chip | Task 6 |
| AI generator: new schema + varied-set prompt | Task 2 |
| AI generator preview reflects new shape | Task 7 |
| `getPlannedSets()` unit test (4 cases + extras) | Task 1.5 |
| No tempo on cardio | Task 4 (`{ex.type !== 'cardio' && ...}`) |
| Existing routines keep working | Lazy fallback in `getPlannedSets()` |

- [ ] **Step 8.3: Push**

```bash
git push
```

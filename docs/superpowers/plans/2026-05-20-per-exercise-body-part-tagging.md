# Per-Exercise Body Part Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-exercise body part tagging so weekly analytics accurately reflect which muscle groups were trained, using a predefined list of body parts.

**Architecture:** A hardcoded `BODY_PARTS` constant and `BodyPart` union type are added to `types.ts`. The Exercise interface gains an optional `bodyPart` field. The AI prompt on the server includes the body parts list so Gemini assigns one per exercise. The custom routine builder and live workout "Add Exercise" modal each get a required dropdown. Analytics in ProgressView aggregates by per-exercise `bodyPart` with fallback to workout-level `bodyPart` for old data.

**Tech Stack:** React 19, TypeScript, Firebase Firestore, Express + Gemini AI, Tailwind CSS 4

---

### Task 1: Add Body Parts Constant and Exercise.bodyPart to Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add BODY_PARTS constant and BodyPart type**

Add after the `TrackedSet` interface (before the `Exercise` interface):

```typescript
export const BODY_PARTS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Core', 'Glutes', 'Forearms', 'Calves', 'Cardio'
] as const;

export type BodyPart = typeof BODY_PARTS[number];
```

- [ ] **Step 2: Add bodyPart field to Exercise interface**

Add `bodyPart?: BodyPart;` as the second field in the `Exercise` interface, right after `_id?`:

```typescript
export interface Exercise {
  _id?: string;
  bodyPart?: BodyPart;   // per-exercise body part label
  name: string;
  // ... rest unchanged
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/djedidiahw007/Desktop/Project/Workout\ App/gym-workout-tracker && npx tsc --noEmit 2>&1 | head -30`

Expected: No new errors introduced (the field is optional so existing code is unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add BODY_PARTS constant and Exercise.bodyPart field"
```

---

### Task 2: Update AI Prompt and Schema to Include Per-Exercise Body Part

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Update the Gemini prompt**

Replace the current prompt string in `server.ts`:

```typescript
`Generate a workout routine for the body part: ${bodyPart}. 
Provide the response as JSON matching the schema format.
Include up to 6 exercises maximum.
Make sure to specify sets, reps, and a brief tip for each exercise.`
```

With:

```typescript
`Generate a workout routine for the body part: ${bodyPart}. 
Provide the response as JSON matching the schema format.
Include up to 6 exercises maximum.
Make sure to specify sets, reps, and a brief tip for each exercise.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part that the exercise primarily targets.`
```

- [ ] **Step 2: Add bodyPart to the response schema**

In the `responseSchema` > `properties` > `exercises` > `items` > `properties`, add a new `bodyPart` property before `sets`:

```typescript
properties: {
  name: { type: Type.STRING },
  bodyPart: { type: Type.STRING, description: 'Must be exactly one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio' },
  sets: { type: Type.NUMBER },
  reps: { type: Type.NUMBER },
  weight: { type: Type.NUMBER, description: "Suggest starting weight in lbs" },
  tip: { type: Type.STRING, description: "A quick form tip" }
},
required: ["name", "bodyPart", "sets", "reps", "weight"]
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/djedidiahw007/Desktop/Project/Workout\ App/gym-workout-tracker && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server.ts
git commit -m "feat: update AI prompt and schema to return per-exercise bodyPart"
```

---

### Task 3: Add Body Part Dropdown to Custom Routine Builder

**Files:**
- Modify: `src/components/CustomRoutineBuilder.tsx`

- [ ] **Step 1: Import BODY_PARTS**

Add `BODY_PARTS` to the import from `../types`:

```typescript
import { Exercise, BODY_PARTS } from '../types';
```

- [ ] **Step 2: Pre-select body part when adding exercises**

Update `addExercise` to include a `bodyPart` field when creating new exercises. Replace:

```typescript
const addExercise = (type: 'strength' | 'cardio') => {
    if (type === 'strength') {
      setExercises([...exercises, { name: '', sets: 3, reps: 10, weight: 0, type: 'strength' }]);
    } else {
      setExercises([...exercises, { name: '', type: 'cardio', duration: 30, distance: 0 }]);
    }
  };
```

With:

```typescript
const addExercise = (type: 'strength' | 'cardio') => {
    if (type === 'strength') {
      setExercises([...exercises, { name: '', sets: 3, reps: 10, weight: 0, type: 'strength', bodyPart: undefined }]);
    } else {
      setExercises([...exercises, { name: '', type: 'cardio', duration: 30, distance: 0, bodyPart: 'Cardio' }]);
    }
  };
```

- [ ] **Step 3: Add validation to saveRoutine**

Update the `saveRoutine` function to require `bodyPart` on every exercise. Replace:

```typescript
const saveRoutine = async () => {
    if (!user || !name.trim() || exercises.length === 0) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'routines'), {
        userId: user.uid,
        name: name.trim(),
        exercises: exercises.filter(e => e.name.trim() !== ''),
        createdAt: Date.now(),
      });
      onSave();
```

With:

```typescript
const saveRoutine = async () => {
    if (!user || !name.trim() || exercises.length === 0) return;
    const validExercises = exercises.filter(e => e.name.trim() !== '');
    if (!validExercises.every(e => e.bodyPart)) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'routines'), {
        userId: user.uid,
        name: name.trim(),
        exercises: validExercises,
        createdAt: Date.now(),
      });
      onSave();
```

- [ ] **Step 4: Update disabled condition on Save button**

Replace:

```typescript
disabled={saving || !name.trim() || exercises.length === 0}
```

With:

```typescript
disabled={saving || !name.trim() || exercises.length === 0 || !exercises.filter(e => e.name.trim() !== '').every(e => e.bodyPart)}
```

- [ ] **Step 5: Add body part dropdown to each exercise row**

Inside the exercise row JSX, add a body part dropdown. Insert it right after the exercise name input `<div className="flex-1 min-w-[160px]">...</div>` and before the `{ex.type === 'cardio' ? (...) : (...)}` block. The dropdown:

```tsx
<div className="w-28">
  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1.5" style={condensed}>Body Part</label>
  <select
    value={ex.bodyPart || ''}
    onChange={e => updateExercise(idx, 'bodyPart', e.target.value || undefined)}
    className="w-full bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-2 py-2.5 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--ash)]"
  >
    <option value="" disabled>Select</option>
    {BODY_PARTS.map(bp => (
      <option key={bp} value={bp}>{bp}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/djedidiahw007/Desktop/Project/Workout\ App/gym-workout-tracker && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/CustomRoutineBuilder.tsx
git commit -m "feat: add required body part dropdown to custom routine builder"
```

---

### Task 4: Add Body Part Dropdown to Live Workout "Add Exercise" Modal

**Files:**
- Modify: `src/components/LiveWorkout.tsx`

- [ ] **Step 1: Import BODY_PARTS**

Add `BODY_PARTS` to the import from `../types`:

```typescript
import { Routine, Exercise, TrackedSet, WorkoutLog, BODY_PARTS } from '../types';
```

- [ ] **Step 2: Add state for selected body part in add modal**

Add a new state variable after the existing `searchQuery` state:

```typescript
const [addModalBodyPart, setAddModalBodyPart] = useState<string>('');
```

- [ ] **Step 3: Update addExercise to accept and store bodyPart**

Change the `addExercise` function signature to accept a `bodyPart` parameter. Replace:

```typescript
const addExercise = (name: string, fromHistory?: {sets: TrackedSet[], type?: 'strength' | 'cardio', duration?: number, distance?: number, unit?: string}, explicitType?: 'strength' | 'cardio') => {
    const isCardio = explicitType === 'cardio' || fromHistory?.type === 'cardio';
    
    if (isCardio) {
      setExercises([...exercises, {
        name: name,
        type: 'cardio',
        duration: fromHistory?.duration || 30,
        distance: fromHistory?.distance || 0,
        completed: false
      }]);
    } else {
      const historyWeight = fromHistory ? (fromHistory.sets[0]?.weight || 0) : 0;
      const convertedWeight = fromHistory && fromHistory.unit && fromHistory.unit !== baseUnitRef.current
        ? (fromHistory.unit === 'kgs' ? historyWeight * CONVERSION_FACTOR : historyWeight / CONVERSION_FACTOR)
        : historyWeight;
      setExercises([...exercises, {
        name: name,
        type: 'strength',
        sets: fromHistory ? fromHistory.sets.length : 1,
        reps: fromHistory ? (fromHistory.sets[0]?.reps || 10) : 10,
        weight: convertedWeight,
        trackedSets: fromHistory && fromHistory.sets.length > 0 ? fromHistory.sets.map(s => ({...s, weight: 0, completed: false})) : [{ reps: 10, weight: 0, completed: false }]
      }]);
    }
    setShowAddModal(false);
    setSearchQuery('');
  };
```

With:

```typescript
const addExercise = (name: string, fromHistory?: {sets: TrackedSet[], type?: 'strength' | 'cardio', duration?: number, distance?: number, unit?: string, bodyPart?: string}, explicitType?: 'strength' | 'cardio', bodyPart?: string) => {
    const isCardio = explicitType === 'cardio' || fromHistory?.type === 'cardio';
    const resolvedBodyPart = bodyPart || fromHistory?.bodyPart || (isCardio ? 'Cardio' : undefined);
    
    if (isCardio) {
      setExercises([...exercises, {
        name: name,
        type: 'cardio',
        duration: fromHistory?.duration || 30,
        distance: fromHistory?.distance || 0,
        completed: false,
        bodyPart: resolvedBodyPart
      }]);
    } else {
      const historyWeight = fromHistory ? (fromHistory.sets[0]?.weight || 0) : 0;
      const convertedWeight = fromHistory && fromHistory.unit && fromHistory.unit !== baseUnitRef.current
        ? (fromHistory.unit === 'kgs' ? historyWeight * CONVERSION_FACTOR : historyWeight / CONVERSION_FACTOR)
        : historyWeight;
      setExercises([...exercises, {
        name: name,
        type: 'strength',
        sets: fromHistory ? fromHistory.sets.length : 1,
        reps: fromHistory ? (fromHistory.sets[0]?.reps || 10) : 10,
        weight: convertedWeight,
        trackedSets: fromHistory && fromHistory.sets.length > 0 ? fromHistory.sets.map(s => ({...s, weight: 0, completed: false})) : [{ reps: 10, weight: 0, completed: false }],
        bodyPart: resolvedBodyPart
      }]);
    }
    setShowAddModal(false);
    setSearchQuery('');
    setAddModalBodyPart('');
  };
```

- [ ] **Step 4: Reset addModalBodyPart when modal opens and closes**

In the "Add Exercise" button's onClick, add reset:

```typescript
onClick={() => { setShowAddModal(true); setAddModalBodyPart(''); }}
```

Also reset in the close button and X button handlers inside the modal:

```typescript
onClick={() => { setShowAddModal(false); setAddModalBodyPart(''); }}
```

- [ ] **Step 5: Add body part dropdown and validation to Add Exercise Modal**

Inside the Add Exercise Modal, after the search input section (after the `{routine.bodyPart && (...)}` checkbox label) and before the Results `<div className="flex-1 overflow-y-auto p-2">`, add a body part dropdown:

```tsx
<div className="px-[18px] py-2.5 border-b border-[var(--border)] shrink-0">
  <select
    value={addModalBodyPart}
    onChange={(e) => setAddModalBodyPart(e.target.value)}
    className="w-full bg-[var(--bg-2)] border border-[var(--border-2)] rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px] text-[var(--white)] outline-none focus:border-[var(--red)]"
  >
    <option value="">Select body part…</option>
    {BODY_PARTS.map(bp => (
      <option key={bp} value={bp}>{bp}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 6: Guard "Create as Strength" and "Create as Cardio" buttons with bodyPart validation**

Update the two "Create as" buttons to only fire when `addModalBodyPart` is selected. Replace:

```tsx
<button
    onClick={() => addExercise(searchQuery, undefined, 'strength')}
    className="w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[11px] font-semibold text-[var(--red)] bg-transparent border-none cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-2)]"
  >
    <Plus className="w-3 h-3" /> "{searchQuery}" — Create as Strength
  </button>
  <button
    onClick={() => addExercise(searchQuery, undefined, 'cardio')}
    className="w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[11px] font-semibold text-[var(--red)] bg-transparent border-none cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-2)]"
  >
    <Plus className="w-3 h-3" /> "{searchQuery}" — Create as Cardio
  </button>
```

With:

```tsx
<button
    onClick={() => addModalBodyPart && addExercise(searchQuery, undefined, 'strength', addModalBodyPart)}
    disabled={!addModalBodyPart}
    className="w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[11px] font-semibold text-[var(--red)] bg-transparent border-none cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-2)] disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <Plus className="w-3 h-3" /> "{searchQuery}" — Create as Strength
  </button>
  <button
    onClick={() => addModalBodyPart && addExercise(searchQuery, undefined, 'cardio', addModalBodyPart)}
    disabled={!addModalBodyPart}
    className="w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[11px] font-semibold text-[var(--red)] bg-transparent border-none cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-2)] disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <Plus className="w-3 h-3" /> "{searchQuery}" — Create as Cardio
  </button>
```

- [ ] **Step 7: Pass bodyPart when adding from history**

Update the history result button's onClick to pass the selected body part. Replace:

```typescript
onClick={() => addExercise(hist.name, hist)}
```

With:

```typescript
onClick={() => addModalBodyPart && addExercise(hist.name, hist, undefined, addModalBodyPart)}
```

Also add the disabled guard to the history button:

```typescript
disabled={!addModalBodyPart}
```

And add `disabled:opacity-40 disabled:cursor-not-allowed` to its className.

- [ ] **Step 8: Verify build**

Run: `cd /Users/djedidiahw007/Desktop/Project/Workout\ App/gym-workout-tracker && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/LiveWorkout.tsx
git commit -m "feat: add required body part dropdown to live workout add exercise modal"
```

---

### Task 5: Rewrite Weekly Output Analytics to Use Per-Exercise Body Part

**Files:**
- Modify: `src/components/ProgressView.tsx`

- [ ] **Step 1: Import BODY_PARTS**

Add `BODY_PARTS` to the import from `../types`:

```typescript
import { WorkoutLog, BODY_PARTS } from '../types';
```

- [ ] **Step 2: Rewrite weeklySummary computation**

Replace the entire `weeklySummary` computation block:

```typescript
const weeklySummary: Record<string, number> = {};
  daysInWeek.forEach(day => {
    const dayLogs = logs.filter(log => isSameDay(new Date(log.date), day));
    dayLogs.forEach(log => {
      let sets = 0, cardioMins = 0;
      log.exercises.forEach(ex => {
        if (ex.type === 'cardio') {
          if (ex.completed || (!Object.prototype.hasOwnProperty.call(ex, 'completed') && ex.duration)) {
            cardioMins += ex.duration || 0;
          }
        } else {
          if (ex.trackedSets?.length) {
            sets += ex.trackedSets.filter(s => s.completed).length;
          } else {
            sets += ex.actualSets || 0;
          }
        }
      });
      const part = log.bodyPart ? log.bodyPart.toUpperCase() : 'MIXED';
      if (sets > 0) { weeklySummary[part] = (weeklySummary[part] || 0) + sets; }
      if (cardioMins > 0) { weeklySummary['CARDIO (MIN)'] = (weeklySummary['CARDIO (MIN)'] || 0) + cardioMins; }
    });
  });
```

With per-exercise body part aggregation:

```typescript
const weeklySummary: Record<string, number> = {};
  daysInWeek.forEach(day => {
    const dayLogs = logs.filter(log => isSameDay(new Date(log.date), day));
    dayLogs.forEach(log => {
      log.exercises.forEach(ex => {
        // Resolve body part: exercise-level > workout-level fallback > skip
        const bp = ex.bodyPart || log.bodyPart;
        if (!bp) return;

        if (ex.type === 'cardio') {
          const isDone = ex.completed || (!Object.prototype.hasOwnProperty.call(ex, 'completed') && ex.duration);
          if (isDone && ex.duration) {
            weeklySummary[bp] = (weeklySummary[bp] || 0) + ex.duration;
          }
        } else {
          let sets = 0;
          if (ex.trackedSets?.length) {
            sets = ex.trackedSets.filter(s => s.completed).length;
          } else {
            sets = ex.actualSets || 0;
          }
          if (sets > 0) {
            weeklySummary[bp] = (weeklySummary[bp] || 0) + sets;
          }
        }
      });
    });
  });
```

- [ ] **Step 3: Update weekly output table formatting**

The weekly output table currently shows raw numbers. Update the display to differentiate between sets and minutes. Replace the table body rendering:

```tsx
{Object.entries(weeklySummary)
                .sort((a, b) => b[1] - a[1])
                .map(([part, val]) => (
                  <tr key={part} className="border-b border-[var(--hairline)] hover:bg-[var(--surface)] transition-colors">
                    <td className="py-3 px-5 font-semibold uppercase text-[var(--ink)]" style={condensed}>{part}</td>
                    <td className="py-3 px-5 font-bold text-[var(--action)] text-right" style={condensed}>{val}</td>
                  </tr>
                ))}
```

With:

```tsx
{Object.entries(weeklySummary)
                .sort((a, b) => b[1] - a[1])
                .map(([part, val]) => {
                  const lowerPart = part.toLowerCase();
                  const isCardioEntry = lowerPart === 'cardio';
                  return (
                    <tr key={part} className="border-b border-[var(--hairline)] hover:bg-[var(--surface)] transition-colors">
                      <td className="py-3 px-5 font-semibold uppercase text-[var(--ink)]" style={condensed}>{part}</td>
                      <td className="py-3 px-5 font-bold text-[var(--action)] text-right" style={condensed}>{val} {isCardioEntry ? 'min' : 'sets'}</td>
                    </tr>
                  );
                })}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/djedidiahw007/Desktop/Project/Workout\ App/gym-workout-tracker && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressView.tsx
git commit -m "feat: rewrite weekly output to aggregate by per-exercise body part"
```

---

### Task 6: Visual Check and Build Verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/djedidiahw007/Desktop/Project/Workout\ App/gym-workout-tracker && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual smoke test checklist**

Start the dev server and verify:
1. **AI Generation:** Generate a workout → confirm each exercise in the response has a `bodyPart` field → save routine → check it persists
2. **Custom Routine Builder:** Add exercises → confirm body part dropdown appears for each → confirm Save is disabled until all body parts selected → save and verify in Firestore
3. **Live Workout Add Exercise:** Start a workout → tap "Add Exercise" → confirm body part dropdown is required → add an exercise → confirm it appears in the workout
4. **Weekly Output:** Complete a workout with mixed body parts → go to Analytics → confirm weekly output shows per-body-part totals (not workout-level grouping)
5. **Backfill:** View a week with old workouts (no per-exercise body part) → confirm they fall back to workout-level body part

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```

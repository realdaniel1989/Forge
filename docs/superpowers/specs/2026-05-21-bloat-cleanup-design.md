# Bloat Cleanup — Design

**Date:** 2026-05-21
**Source audit:** `issues/BLOAT_AUDIT.html`
**Scope:** Audit items #1, #2, #4, #5, #7. Defers #3 (Supabase migration) and #6 (LiveWorkout/ProgressView refactor).

## Goal

Cut initial JS bundle from ~855 KB to ~300–350 KB and trim `node_modules` from ~421 MB to ~320 MB, without changing any user-visible behavior and without migrating the database.

## Success criteria

- `dist/assets/index-*.js` (main chunk) ≤ 400 KB; Firebase split into its own chunk.
- `node_modules` size reduced by ≥ 50 MB.
- `package.json` has no unused dependencies, no duplicates, and build-time tools live under `devDependencies`.
- `npm run build`, `npm run lint`, and `/api/generate-workout` all work post-change.
- Every tab in the app loads and renders correctly in a dev smoke test.

## Out of scope

- Firebase → Supabase migration (audit #3). Revisit after P6 measurement.
- Splitting `LiveWorkout.tsx` / `ProgressView.tsx` into smaller files (audit #6). Do when next editing those files.
- Dockerfile or Railway deploy changes.

## Phases

Each phase ends with a single atomic commit. Phases are ordered so failures in later phases don't undo earlier wins.

### P1 — Baseline measurement

Capture current numbers so we can prove the win. Create `issues/BLOAT_BASELINE.md` containing:

- `dist/assets/index-*.js` size after `npm run build`
- `du -sh node_modules` output
- Top 10 packages by size (`du -sh node_modules/* | sort -hr | head -10`)
- Date and git SHA of measurement

No code changes. Commit the baseline file.

### P2 — Ghost deps + package.json hygiene

**Removes:** `recharts` (zero imports), `motion` (zero imports).

**Reorganizes `package.json`:**

- Move `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` from `dependencies` → `devDependencies`.
- Remove the duplicate `vite` entry in `dependencies` (already in `devDependencies`).

**Deletes orphan files** (verify no imports first via grep):

- `firebase-applet-config.json`
- `firebase-blueprint.json`
- `metadata.json`

**Repo hygiene:**

- Add `**/.DS_Store` to `.gitignore`.
- `git rm --cached src/.DS_Store` (and any other committed `.DS_Store`).

**Verify:** `npm install`, `npm run build`, `npm run lint` all succeed.

### P3 — Hand-rolled date utils

Create `src/dateUtils.ts` exporting the exact functions used in `ProgressView.tsx` and `HabitTracker.tsx`:

- `format(date, pattern)` — supports only the tokens used today; will enumerate by greppping the two files first.
- `subDays(date, n)`
- `eachDayOfInterval({ start, end })`
- `startOfWeek(date)`, `endOfWeek(date)` — week boundary preserved from current date-fns default (Sunday) unless code passes `weekStartsOn`; verify before implementing.
- `subWeeks(date, n)`, `addWeeks(date, n)`
- `isSameDay(a, b)`

All pure functions, no external deps. Signatures match date-fns where used, so call sites only need the import line changed.

**Replace imports** in `ProgressView.tsx` and `HabitTracker.tsx`. Then `npm uninstall date-fns`.

**Verify:** build passes; dev server check that ProgressView weekly chart and HabitTracker calendar render correctly with the same dates as before.

**Risk:** subtle behavior differences (week start, locale formatting). Mitigation: enumerate every call site, hand-verify output for at least one date per function.

### P4 — Code splitting

**App.tsx:** convert these to `React.lazy`:

- `LiveWorkout`, `ProgressView`, `ExerciseLibrary`, `HabitTracker`, `CustomRoutineBuilder`, `RoutineGenerator`

Keep eager: `Login`, `Layout`, `RoutinesList` (initial route).

Wrap the rendered children of `Layout` in `<Suspense fallback={...}>` so lazy components show a fallback while loading.

Components currently use **named exports**. `React.lazy` requires a `default` export, so use the inline rewrap pattern:

```ts
const LiveWorkout = lazy(() => import('./components/LiveWorkout').then(m => ({ default: m.LiveWorkout })));
```

This avoids changing the components themselves.

**vite.config.ts:** add `build.rollupOptions.output.manualChunks`:

```ts
manualChunks: {
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
  react: ['react', 'react-dom'],
}
```

**Verify:**

- `npm run build` produces multiple chunks; main chunk < 400 KB.
- In dev, click through every tab — each one loads and renders correctly.
- Network tab shows lazy chunks loading on first tab switch.

**Risk:** named-vs-default export mismatches fail at runtime, not build. Mitigation: smoke-test each tab.

### P5 — Inline Gemini REST call

Replace `@google/genai` SDK usage in `server.ts` with a direct `fetch` call.

**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

**Request body shape:**

```json
{
  "contents": [{ "parts": [{ "text": "..." }] }],
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": { /* translated from SDK Type.OBJECT etc. */ }
  }
}
```

**Schema translation:** SDK `Type.OBJECT` → REST `"type": "object"` (lowercase string). `Type.STRING` → `"string"`, `Type.NUMBER` → `"number"`, `Type.ARRAY` → `"array"`.

**Preserve:**

- Retry-3-times loop with 2s delay (existing behavior).
- `response.text` extraction → `response.candidates[0].content.parts[0].text` in REST form.
- Error handling and status codes.

After the rewrite: `npm uninstall @google/genai`.

**Verify:** start dev server, `curl -X POST localhost:3000/api/generate-workout -H 'Content-Type: application/json' -d '{"bodyPart":"Chest"}'`. Confirm valid JSON matching the schema returns.

**Risk:** schema format mismatch. Mitigation: test the live endpoint before committing.

### P6 — Final measurement

- Re-run `npm run build`; capture same metrics as P1.
- Append a before/after comparison table to `issues/BLOAT_BASELINE.md`.
- Run Lighthouse against the production build (`npm run start`, then Chrome DevTools → Lighthouse mobile). Record TTI and Total Blocking Time.
- Commit the updated baseline file.

## Order of operations

1. P1 baseline → commit
2. P2 ghost deps → commit
3. P3 date utils → commit
4. P4 code splitting → commit
5. P5 Gemini REST → commit
6. P6 measurement → commit

Each phase is independently revertible. If any phase fails verification, stop and decide whether to fix or roll back before continuing.

## Expected outcome

| Metric | Before | Target |
|---|---|---|
| Initial JS bundle | 855 KB | ≤ 400 KB |
| node_modules | 421 MB | ~320 MB |
| Dependencies count | 13 | 9 |
| Ghost deps | 2 | 0 |

Numbers are estimates from the audit; P6 confirms.

# Bloat Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut initial JS bundle from ~855 KB to ≤ 400 KB and trim `node_modules` by ≥ 50 MB, without changing user-visible behavior or migrating the database.

**Architecture:** Six independently-revertible phases: (1) baseline measurement, (2) remove ghost deps + reorganize package.json, (3) replace date-fns with hand-rolled utilities, (4) lazy-load route components + manual chunks, (5) replace `@google/genai` SDK with REST `fetch`, (6) final measurement.

**Tech Stack:** React 19, Vite 6, Firebase 12, Express, TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-21-bloat-cleanup-design.md`

---

## File Inventory

**Will create:**
- `issues/BLOAT_BASELINE.md` — before/after metrics
- `src/dateUtils.ts` — replaces date-fns

**Will modify:**
- `package.json` — remove ghost deps, fix dev/prod placement
- `.gitignore` — already contains `.DS_Store`; remove tracked file
- `src/App.tsx` — convert imports to `React.lazy` + Suspense
- `vite.config.ts` — manual chunks
- `src/components/ProgressView.tsx` — swap date-fns → dateUtils
- `src/components/HabitTracker.tsx` — swap date-fns → dateUtils
- `server.ts` — replace SDK with fetch

**Will delete:**
- `firebase-applet-config.json`, `firebase-blueprint.json`, `metadata.json`
- `src/.DS_Store` (if tracked — verify in P2)

---

## Task 1: Baseline measurement

**Files:**
- Create: `issues/BLOAT_BASELINE.md`

- [ ] **Step 1: Clean build**

```bash
rm -rf dist
npm run build
```

- [ ] **Step 2: Collect metrics**

```bash
echo "=== Bundle ==="
ls -lh dist/assets/*.js dist/assets/*.css
echo "=== node_modules ==="
du -sh node_modules
echo "=== Top 10 ==="
du -sh node_modules/* 2>/dev/null | sort -hr | head -10
echo "=== SHA ==="
git rev-parse HEAD
```

- [ ] **Step 3: Write baseline file**

Create `issues/BLOAT_BASELINE.md` with the captured numbers. Template:

```markdown
# Bloat Cleanup Metrics

## Baseline — 2026-05-21 (commit <SHA>)

### Client bundle (dist/assets/)
- `index-*.js`: <SIZE>
- `index-*.css`: <SIZE>

### node_modules
- Total: <SIZE>
- Top 10:
  1. <pkg> — <size>
  ...

### Lighthouse
(Filled in at P6.)
```

- [ ] **Step 4: Commit**

```bash
git add issues/BLOAT_BASELINE.md
git commit -m "docs: baseline bloat metrics before cleanup"
```

---

## Task 2: Remove ghost dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify zero imports**

```bash
grep -rn "from ['\"]recharts" src/ server.ts || echo "OK: no recharts imports"
grep -rn "from ['\"]motion" src/ server.ts || echo "OK: no motion imports"
```

Expected: both print "OK: no ... imports".

- [ ] **Step 2: Uninstall**

```bash
npm uninstall recharts motion
```

- [ ] **Step 3: Verify build still works**

```bash
npm run build && npm run lint
```

Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused recharts and motion deps"
```

---

## Task 3: Fix package.json layout

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Move build-time deps to devDependencies**

Edit `package.json`:
- Remove `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` from `"dependencies"`.
- Ensure `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` exist in `"devDependencies"`. `vite` and `@tailwindcss/vite` should already be there; add `@vitejs/plugin-react` if missing (use the same version that was in `dependencies`).

After edit, `dependencies` should be:

```json
"dependencies": {
  "@google/genai": "^1.29.0",
  "date-fns": "^4.2.1",
  "dotenv": "^17.2.3",
  "express": "^4.21.2",
  "firebase": "^12.13.0",
  "lucide-react": "^0.546.0",
  "react": "^19.0.1",
  "react-dom": "^19.0.1"
}
```

(`@google/genai` and `date-fns` will be removed in later tasks.)

- [ ] **Step 2: Reinstall to refresh lock file**

```bash
rm -rf node_modules package-lock.json
npm install
```

- [ ] **Step 3: Verify build + dev still work**

```bash
npm run build
```

Expected: succeeds, no missing-module errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: move build tooling to devDependencies"
```

---

## Task 4: Delete orphan scaffolding files

**Files:**
- Delete: `firebase-applet-config.json`, `firebase-blueprint.json`, `metadata.json`
- Modify: `src/.DS_Store` (remove from index if tracked)

- [ ] **Step 1: Confirm no imports reference them**

```bash
grep -rn "firebase-applet-config\|firebase-blueprint\|metadata\.json" src/ server.ts vite.config.ts 2>/dev/null || echo "OK: no references"
```

Expected: "OK: no references".

- [ ] **Step 2: Delete the files**

```bash
rm firebase-applet-config.json firebase-blueprint.json metadata.json
```

Note: `firebase-applet-config.json` is in `.gitignore` already and not tracked; `firebase-blueprint.json` and `metadata.json` are tracked.

- [ ] **Step 3: Remove tracked DS_Store files**

```bash
git ls-files | grep DS_Store | xargs -r git rm --cached
```

(`.DS_Store` is already in `.gitignore`; no edit needed.)

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove orphan scaffolding files and tracked .DS_Store"
```

---

## Task 5: Create dateUtils module with tests

**Files:**
- Create: `src/dateUtils.ts`
- Create: `src/dateUtils.test.ts` (no test runner is installed yet; this file is a quick standalone script we will run with `tsx` and then delete in step 6)

The two existing files use these date-fns APIs:

- `format(date, pattern)` with patterns: `'EEE'`, `'MMM d'`, `'MMM dd'`, `'MMM dd, yyyy · h:mm a'`, `'d'`, `'yyyy-MM-dd'`
- `subDays(date, n)`
- `eachDayOfInterval({ start, end })`
- `startOfWeek(date, { weekStartsOn: 1 })`
- `endOfWeek(date, { weekStartsOn: 1 })`
- `subWeeks(date, n)`, `addWeeks(date, n)`
- `isSameDay(a, b)`

- [ ] **Step 1: Write the failing test script**

Create `src/dateUtils.test.ts`:

```ts
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, subWeeks, addWeeks, isSameDay } from './dateUtils';

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${name}\n  actual:   ${a}\n  expected: ${e}`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}

// Fixed reference: Wed 2026-05-20 14:05 local
const ref = new Date(2026, 4, 20, 14, 5, 0); // months are 0-indexed

eq('format yyyy-MM-dd', format(ref, 'yyyy-MM-dd'), '2026-05-20');
eq('format MMM d',      format(ref, 'MMM d'),      'May 20');
eq('format MMM dd',     format(ref, 'MMM dd'),     'May 20');
eq('format d',          format(ref, 'd'),          '20');
eq('format EEE',        format(ref, 'EEE'),        'Wed');
eq('format full',       format(ref, 'MMM dd, yyyy · h:mm a'), 'May 20, 2026 · 2:05 PM');

eq('subDays 1', format(subDays(ref, 1), 'yyyy-MM-dd'), '2026-05-19');
eq('subDays 7', format(subDays(ref, 7), 'yyyy-MM-dd'), '2026-05-13');

// Mon-start week containing Wed 2026-05-20 is Mon 05-18 .. Sun 05-24
const ws = startOfWeek(ref, { weekStartsOn: 1 });
const we = endOfWeek(ref, { weekStartsOn: 1 });
eq('startOfWeek Mon', format(ws, 'yyyy-MM-dd'), '2026-05-18');
eq('endOfWeek Sun',   format(we, 'yyyy-MM-dd'), '2026-05-24');

const interval = eachDayOfInterval({ start: ws, end: we });
eq('eachDayOfInterval length', interval.length, 7);
eq('eachDayOfInterval first',  format(interval[0], 'yyyy-MM-dd'), '2026-05-18');
eq('eachDayOfInterval last',   format(interval[6], 'yyyy-MM-dd'), '2026-05-24');

eq('subWeeks 2', format(subWeeks(ref, 2), 'yyyy-MM-dd'), '2026-05-06');
eq('addWeeks 1', format(addWeeks(ref, 1), 'yyyy-MM-dd'), '2026-05-27');

eq('isSameDay yes', isSameDay(ref, new Date(2026, 4, 20, 23, 59)), true);
eq('isSameDay no',  isSameDay(ref, subDays(ref, 1)), false);

console.log('\nAll dateUtils tests passed.');
```

- [ ] **Step 2: Verify it fails (module not implemented yet)**

```bash
npx tsx src/dateUtils.test.ts
```

Expected: error — cannot find module `./dateUtils`.

- [ ] **Step 3: Implement dateUtils**

Create `src/dateUtils.ts`:

```ts
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function format(date: Date, pattern: string): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const h24 = date.getHours();
  const min = date.getMinutes();
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? 'AM' : 'PM';

  const tokens: Array<[RegExp, string]> = [
    [/yyyy/g, String(y)],
    [/MMM/g,  MONTHS_SHORT[m]],
    [/MM/g,   pad2(m + 1)],
    [/dd/g,   pad2(d)],
    [/EEE/g,  WEEKDAYS_SHORT[date.getDay()]],
    [/\bd\b/g, String(d)],
    [/\bh\b/g, String(h12)],
    [/mm/g,   pad2(min)],
    [/\ba\b/g, ampm],
  ];

  let out = pattern;
  for (const [re, val] of tokens) out = out.replace(re, val);
  return out;
}

export function subDays(date: Date, n: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() - n);
  return r;
}

export function addWeeks(date: Date, n: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + n * 7);
  return r;
}

export function subWeeks(date: Date, n: number): Date {
  return addWeeks(date, -n);
}

type WeekOpts = { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 };

export function startOfWeek(date: Date, opts: WeekOpts = {}): Date {
  const weekStartsOn = opts.weekStartsOn ?? 0;
  const r = new Date(date);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  r.setDate(r.getDate() - diff);
  return r;
}

export function endOfWeek(date: Date, opts: WeekOpts = {}): Date {
  const start = startOfWeek(date, opts);
  const r = new Date(start);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function eachDayOfInterval({ start, end }: { start: Date; end: Date }): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (cur.getTime() <= stop.getTime()) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
```

- [ ] **Step 4: Run the test**

```bash
npx tsx src/dateUtils.test.ts
```

Expected: every line prints `PASS ...` and ends with `All dateUtils tests passed.`

- [ ] **Step 5: Delete the test script**

`src/dateUtils.test.ts` was a one-shot check — no test runner is installed in the project. Delete it:

```bash
rm src/dateUtils.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/dateUtils.ts
git commit -m "feat: add hand-rolled dateUtils to replace date-fns"
```

---

## Task 6: Swap date-fns for dateUtils in components

**Files:**
- Modify: `src/components/ProgressView.tsx` (line 7 import)
- Modify: `src/components/HabitTracker.tsx` (line 7 import)
- Modify: `package.json` (remove `date-fns`)

- [ ] **Step 1: Update ProgressView import**

In `src/components/ProgressView.tsx`, replace line 7:

```ts
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
```

with:

```ts
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from '../dateUtils';
```

- [ ] **Step 2: Update HabitTracker import**

In `src/components/HabitTracker.tsx`, replace line 7:

```ts
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, subWeeks, isSameDay } from 'date-fns';
```

with:

```ts
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, subWeeks, isSameDay } from '../dateUtils';
```

- [ ] **Step 3: Build to confirm no other call sites**

```bash
grep -rn "from ['\"]date-fns" src/ server.ts || echo "OK: no more date-fns imports"
npm run build && npm run lint
```

Expected: "OK: no more date-fns imports", then build + lint succeed.

- [ ] **Step 4: Uninstall date-fns**

```bash
npm uninstall date-fns
```

- [ ] **Step 5: Smoke-test in dev**

```bash
npm run dev
```

In a browser at `http://localhost:3000`:
- Log in, open **Progress** tab → weekly chart should render with day labels (Mon, Tue, ...) and the date range should match today.
- Click prev/next week arrows → week navigates by 7 days.
- Open **Habits** tab → calendar grid should render 30 days ending today; weekly grid should start on Monday.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ProgressView.tsx src/components/HabitTracker.tsx
git commit -m "refactor: replace date-fns with hand-rolled dateUtils"
```

---

## Task 7: Lazy-load route components

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx imports + render**

Replace the top of `src/App.tsx` (lines 1-14) with:

```tsx
import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { RoutinesList } from './components/RoutinesList';
import { Routine } from './types';
import { initError } from './firebase';

const RoutineGenerator     = lazy(() => import('./components/RoutineGenerator').then(m => ({ default: m.RoutineGenerator })));
const LiveWorkout          = lazy(() => import('./components/LiveWorkout').then(m => ({ default: m.LiveWorkout })));
const ProgressView         = lazy(() => import('./components/ProgressView').then(m => ({ default: m.ProgressView })));
const CustomRoutineBuilder = lazy(() => import('./components/CustomRoutineBuilder').then(m => ({ default: m.CustomRoutineBuilder })));
const ExerciseLibrary      = lazy(() => import('./components/ExerciseLibrary').then(m => ({ default: m.ExerciseLibrary })));
const HabitTracker         = lazy(() => import('./components/HabitTracker').then(m => ({ default: m.HabitTracker })));

const TabFallback = () => (
  <div className="p-8 text-[11px] font-mono text-[var(--stone)]">Loading…</div>
);
```

- [ ] **Step 2: Wrap LiveWorkout and the tab grid in Suspense**

In `src/App.tsx`, change the `activeWorkout` branch:

```tsx
if (activeWorkout) {
  return (
    <Layout currentTab="none" setTab={() => {}}>
      <Suspense fallback={<TabFallback />}>
        <LiveWorkout routine={activeWorkout} onFinish={() => setActiveWorkout(null)} />
      </Suspense>
    </Layout>
  );
}
```

And wrap the main tab block (the `return <Layout ...>` containing all the mountedTabs divs) so that everything *inside* `<Layout>` is wrapped in one Suspense:

```tsx
return (
  <Layout currentTab={tab} setTab={changeTab}>
    <Suspense fallback={<TabFallback />}>
      {mountedTabs.has('routines') && (
        /* existing div */
      )}
      {/* ...all other mountedTabs blocks unchanged... */}
    </Suspense>
  </Layout>
);
```

Do not change any of the inner `<div style=...>` blocks; only add `<Suspense fallback={<TabFallback />}>` around them.

- [ ] **Step 3: Verify each lazy component has a named export matching the import**

```bash
grep -E "export (const|function|class) (RoutineGenerator|LiveWorkout|ProgressView|CustomRoutineBuilder|ExerciseLibrary|HabitTracker)" src/components/*.tsx
```

Expected: one match per component.

- [ ] **Step 4: Build and inspect chunks**

```bash
npm run build
ls -lh dist/assets/*.js
```

Expected: multiple `.js` files (not just one `index-*.js`). Note the largest file size.

- [ ] **Step 5: Smoke-test every tab in dev**

```bash
npm run dev
```

Log in, then click each tab in order: Routines → Generate → Exercises → Custom → Progress → Habits. Each should render without console errors. Start a workout from Routines → LiveWorkout should mount.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "perf: lazy-load route components for code splitting"
```

---

## Task 8: Add manual chunks for Firebase and React

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add build config**

In `vite.config.ts`, inside the returned config object (alongside `plugins`, `resolve`, `server`), add:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        react: ['react', 'react-dom'],
      },
    },
  },
},
```

The full file should look like:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
```

- [ ] **Step 2: Build and verify chunks**

```bash
npm run build
ls -lh dist/assets/*.js
```

Expected: distinct files named like `firebase-*.js`, `react-*.js`, and a smaller main `index-*.js`. Main chunk should be < 400 KB.

- [ ] **Step 3: Smoke-test built app**

```bash
NODE_ENV=production npm run start
```

Open `http://localhost:3000`, log in, click through all tabs. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf: split Firebase and React into separate vendor chunks"
```

---

## Task 9: Replace @google/genai SDK with REST fetch

**Files:**
- Modify: `server.ts`
- Modify: `package.json`

- [ ] **Step 1: Rewrite the Gemini call**

Replace the entire contents of `server.ts` with:

```ts
import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const responseSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Engaging name for the routine" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          bodyPart: { type: "string", description: "Must be exactly one of: Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Glutes, Forearms, Calves, Cardio" },
          sets: { type: "number" },
          reps: { type: "number" },
          weight: { type: "number", description: "Suggest starting weight in lbs" },
          tip: { type: "string", description: "A quick form tip" },
        },
        required: ["name", "bodyPart", "sets", "reps", "weight"],
      },
    },
  },
  required: ["name", "exercises"],
};

async function callGemini(bodyPart: string): Promise<string> {
  const prompt = `Generate a workout routine for the body part: ${bodyPart}. 
Provide the response as JSON matching the schema format.
Include up to 6 exercises maximum.
Make sure to specify sets, reps, and a brief tip for each exercise.
For each exercise, assign a bodyPart from this exact list: ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Forearms", "Calves", "Cardio"]. Choose the most appropriate body part that the exercise primarily targets.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "aistudio-build",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text output from Gemini");
  return text;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-workout", async (req, res) => {
    try {
      const { bodyPart } = req.body;
      if (!bodyPart) {
        return res.status(400).json({ error: "bodyPart is required" });
      }

      let text: string | undefined;
      let retries = 3;
      while (retries > 0) {
        try {
          text = await callGemini(bodyPart);
          break;
        } catch (error: any) {
          console.error("Gemini API Error:", error.message);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!text) throw new Error("Failed to generate content after retries");
      res.json(JSON.parse(text));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: String(error) });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
```

- [ ] **Step 2: Live-test the endpoint**

```bash
npm run dev
```

In a second terminal:

```bash
curl -s -X POST http://localhost:3000/api/generate-workout \
  -H 'Content-Type: application/json' \
  -d '{"bodyPart":"Chest"}' | head -c 500
```

Expected: JSON beginning with `{"name":"...","exercises":[...`. Verify `exercises[0]` has `name`, `bodyPart`, `sets`, `reps`, `weight`.

Stop the dev server.

- [ ] **Step 3: Uninstall the SDK**

```bash
npm uninstall @google/genai
```

- [ ] **Step 4: Verify build + lint still pass**

```bash
npm run build && npm run lint
```

Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add server.ts package.json package-lock.json
git commit -m "refactor: replace @google/genai SDK with REST fetch"
```

---

## Task 10: Final measurement

**Files:**
- Modify: `issues/BLOAT_BASELINE.md`

- [ ] **Step 1: Re-measure**

```bash
rm -rf dist
npm run build

echo "=== Bundle ==="
ls -lh dist/assets/*.js dist/assets/*.css
echo "=== node_modules ==="
du -sh node_modules
echo "=== Top 10 ==="
du -sh node_modules/* 2>/dev/null | sort -hr | head -10
echo "=== SHA ==="
git rev-parse HEAD
```

- [ ] **Step 2: Run Lighthouse on production build**

```bash
NODE_ENV=production npm run start
```

In Chrome at `http://localhost:3000` (logged out, Login page):
- DevTools → Lighthouse → Mode: Navigation, Device: Mobile, Categories: Performance only → Analyze.
- Record: Performance score, First Contentful Paint, Largest Contentful Paint, Total Blocking Time, Time to Interactive.

Stop the server.

- [ ] **Step 3: Append after-numbers + comparison table to baseline file**

Edit `issues/BLOAT_BASELINE.md`, append a new `## After — 2026-05-21 (commit <SHA>)` section mirroring the baseline section, plus a `## Comparison` table:

```markdown
## Comparison

| Metric             | Before  | After   | Δ        |
|--------------------|---------|---------|----------|
| Main JS chunk      | <X> KB  | <Y> KB  | <delta>  |
| Total dist/ JS     | <X> KB  | <Y> KB  | <delta>  |
| node_modules       | <X> MB  | <Y> MB  | <delta>  |
| Lighthouse Perf    | n/a     | <score> | —        |
| TTI                | n/a     | <ms>    | —        |
```

- [ ] **Step 4: Commit**

```bash
git add issues/BLOAT_BASELINE.md
git commit -m "docs: post-cleanup bloat metrics"
```

---

## Self-review notes

- **Spec coverage:** P1↔Task 1, P2↔Tasks 2-4, P3↔Tasks 5-6, P4↔Tasks 7-8, P5↔Task 9, P6↔Task 10. All audit items in scope (#1, #2, #4, #5, #7) are covered.
- **Type/name consistency:** dateUtils export names match the destructured imports in ProgressView/HabitTracker exactly. Lazy-load wrappers use the existing named exports (verified by grep step before build).
- **Risks called out in spec are mitigated:**
  - P3 week-start: Task 5 implements `weekStartsOn` option and tests Mon-start week explicitly.
  - P4 named vs default: Task 7 step 3 greps for named exports before building.
  - P5 schema format: Task 9 step 2 hits the live endpoint and checks response shape before committing.

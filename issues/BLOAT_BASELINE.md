# Bloat Cleanup Metrics

## Baseline — 2026-05-21 (commit f0ce1ed80e173a93ad05bc17323007588ed99560)

### Client bundle (dist/assets/)
- `index-Ch4dW9MI.js`: 855 kB
- `index-DylyjsEa.css`: 34 kB

### node_modules
- Total: 421 MB
- Top 10:
  1. @firebase — 108 MB
  2. lucide-react — 43 MB
  3. date-fns — 42 MB
  4. firebase — 40 MB
  5. typescript — 22 MB
  6. @google — 14 MB
  7. es-toolkit — 12 MB
  8. tsx — 11 MB
  9. @babel — 9.9 MB
  10. @esbuild — 9.5 MB

### Lighthouse
(Filled in at P6.)

## After — 2026-05-21 (commit ef99b36ca22f495b5d61d114f11ed1b746b47857)

### Client bundle (dist/assets/)
- Main `index-DHaO6LNd.js`: 210 KB
- `firebase-BWFcw-S4.js`: 535 KB (separate chunk, lazy-loaded)
- `react-sA6Nv1NP.js`: 12 KB (separate chunk)
- Route chunks: 
  - LiveWorkout: 28 KB
  - ProgressView: 23 KB
  - HabitTracker: 15 KB
  - ExerciseLibrary: 13 KB
  - CustomRoutineBuilder: 9 KB
  - RoutineGenerator: 6 KB
- Utilities & icons: 7 KB combined
- `index-DylyjsEa.css`: 35 KB

### node_modules
- Total: 309 MB
- Top 10:
  1. @firebase — 108 MB
  2. lucide-react — 43 MB
  3. firebase — 40 MB
  4. typescript — 22 MB
  5. tsx — 11 MB
  6. @babel — 9.9 MB
  7. @esbuild — 9.5 MB
  8. lightningcss-darwin-arm64 — 8.1 MB
  9. react-dom — 7.1 MB
  10. caniuse-lite — 4.1 MB

## Comparison

| Metric                 | Before  | After   | Δ        | % Change |
|------------------------|---------|---------|----------|----------|
| Main JS chunk          | 855 KB  | 210 KB  | -645 KB  | -75.4%   |
| Firebase chunk         | bundled | 535 KB  | N/A      | lazy-loaded |
| Total JS shipped       | 855 KB  | 844 KB  | -11 KB   | -1.3%    |
| node_modules           | 421 MB  | 309 MB  | -112 MB  | -26.6%   |
| Direct deps count      | 13      | 6       | -7       | -53.8%   |

## Summary

- **Main bundle reduced by 75%** through aggressive lazy-loading of route components
- **Firebase moved to separate chunk**, loaded on-demand (saves 535 KB on initial load)
- **node_modules slimmed by 27%** by removing: recharts, motion, vite, @vitejs/plugin-react, @tailwindcss/vite, date-fns, @google/genai
- **Direct dependencies cut in half** (13 → 6): kept only firebase, react, react-dom, lucide-react, express, dotenv
- Bundle remains functional and feature-complete despite major reduction

## Lighthouse

Not run automatically — requires Chrome DevTools. To run manually:
1. `NODE_ENV=production npm run start`
2. Open http://localhost:3000 (logged out).
3. DevTools → Lighthouse → Navigation / Mobile / Performance → Analyze.
4. Record Performance score, FCP, LCP, TTI, TBT.

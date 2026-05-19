# Forge.AI Visual Revamp Design

**Date:** 2026-05-18
**Scope:** Restyle-only — no new features, no backend changes, no auth changes
**Reference mockup:** `layout/forge-revamp.html`

## Decisions

- **Auth:** Keep Firebase + Google SSO. Login page adapts the new visual language with a "Continue with Google" button.
- **CSS approach:** Hybrid — CSS custom properties define the design token system, Tailwind utilities reference them via `bg-[var(--red)]` etc.
- **Scope:** Restyle only. New fields in the mockup (Experience Level, Goal), "Last done N days ago", volume totals, and full-screen rest timer behavioral changes are **not included** except where noted (rest timer takeover uses existing state).
- **Execution:** Foundation-first (tokens → layout → pages in order).

## 1. Design Tokens + CSS Architecture

### Fonts

Replace system sans + JetBrains Mono with:
- **Syne** (sans-serif) — UI text, headings, buttons, body copy
- **Space Mono** (monospace) — metadata, set numbers, field labels, timestamps, table data

Loaded via Google Fonts `<link>` tags in `index.html`.

Configure Tailwind `fontFamily` via `@theme` block in `index.css` (Tailwind CSS 4 uses CSS-based config): `sans` → Syne, `mono` → Space Mono. Existing `font-sans` and `font-mono` utilities automatically use the new fonts.

### Color Tokens

Defined as CSS custom properties in `src/index.css`:

| Token | Value | Replaces |
|---|---|---|
| `--bg` | `#080808` | `#0C0C0C` |
| `--bg-1` | `#0e0e0e` | card backgrounds |
| `--bg-2` | `#141414` | input backgrounds, subtle fills |
| `--bg-3` | `#1a1a1a` | active states, hover fills |
| `--border` | `#1e1e1e` | `#222222` |
| `--border-2` | `#2a2a2a` | `#333` |
| `--muted` | `#3a3a3a` | dim borders, inactive elements |
| `--dim` | `#555` | secondary text |
| `--text-2` | `#999` | `#a1a1aa` |
| `--text` | `#e8e8e8` | `#E0E0E0` |
| `--red` | `#C0392B` | all emerald-500 accents |
| `--red-dim` | `#1a0808` | emerald-900 subtle backgrounds |
| `--red-hi` | `#E74C3C` | hover/active red state |

### Other Tokens

- `--radius: 8px` (was implicit 4px from Tailwind `rounded`)
- `--radius-sm: 5px` (buttons, inputs, pills)

### CSS Approach

Custom properties in `index.css`. Components use Tailwind utilities referencing variables: `bg-[var(--bg)]`, `text-[var(--red)]`, `border-[var(--border)]`, `rounded-[var(--radius)]`. All emerald references replaced with red tokens throughout all components.

---

## 2. Layout — Icon Rail (`Layout.tsx`)

**Current:** 256px sidebar with text labels, "Navigation" heading, user email, SYNCED status, logout button. Collapses to horizontal icon bar on mobile.

**After:** 60px icon rail. No text labels.

Structure top-to-bottom:
- **Logo square** — 32×32px `--red` rounded square (7px radius) with white dumbbell icon
- **Three icon nav buttons** — 36×36px, icons: `calendar`, `sparkles`, `bar-chart-2`. Active: `--red-dim` bg + `--red` icon. Inactive: transparent + `--muted` icon, hover `--bg-2` bg.
- **Spacer** — pushes avatar to bottom
- **Avatar circle** — 28px, `--bg-3` background + `--border-2` border, user's first initial in `--dim`. Logout on click/hover.

**Removed:** "Navigation" heading, "Forge.AI" text, version number, text nav labels, email display, "SYNCED" indicator.

**Mobile:** 60px rail works as-is for narrow screens — already icon-only.

---

## 3. Login (`Login.tsx`)

**Current:** Centered card with dumbbell icon, "Forge.AI" heading, version number, white "Initialize Session" button. Google SSO only.

**After:** Full-viewport, left-aligned. No card wrapper.

Structure:
- **Brand mark** — red 30×30 square with dumbbell icon + wordmark: bold 800 "Forge" in white + regular 400 ".AI" in `--dim`. Version below in `--muted` mono.
- **Greeting** — time-of-day ("Good morning." / "Good afternoon." / "Good evening.") as 28px heading in `--white`. Subtext: "Sign in to continue your program." in `--dim`.
- **Button** — single red `--red` button: "Continue with Google". Full-width, 13px padding, `--radius` rounded.
- **Positioning** — left-aligned max-width column (380px), vertically centered.

---

## 4. My Routines (`RoutinesList.tsx`)

**Current:** 2-column grid of boxy cards with header, exercise list, and "Initiate session" button.

**After:** Single-column list of horizontal card rows.

**Page header:**
- Eyebrow: "{N} routines" in mono `--muted`
- Title: "My Routines" at 22px, 700 weight
- Red "New +" button top-right

**Top card (most recent):**
- Main row: routine name (14px, 600 weight, sentence case) + body part as red pill (`--red-dim` bg, `--red` text) + exercise count + mono metadata in `--muted`. Red "Start" button.
- Preview section (border-top `--border`): first 3 exercises with `›` prefix + scheme notation. "+N more" dimmed.

**Other cards:** Collapsed main row only. Name + dim pill tag (`--bg-2` bg, `--muted` text, `--border` border) + metadata. Ghost "Start" button.

**Empty state:** Centered. Icon in `--bg-2` square, "No routines yet" heading, descriptive copy, two buttons: red "Generate with AI" + ghost "Build manually".

---

## 5. AI Generator (`RoutineGenerator.tsx`)

**Current:** Green heading, single muscle group input, white "Generate Plan" button.

**After:**

**Page header:**
- Eyebrow: "AI Generator" in mono
- Title: "Build a program." at 22px

**Input form** — card with "Parameters" header + `--muted` mono "Define your target" subtext:
- "Muscle group" field label in mono + text input (`--bg-2` bg, `--border-2` border, `--red` focus)
- "Generate Plan" button: red with sparkles icon, right-aligned

**Empty result** — dashed border placeholder: "Your generated routine will appear here" in `--muted` mono.

**Results** — header updates:
- Eyebrow: "AI Generator · {bodyPart}"
- Title: generated routine name
- Red "Save Routine" button with bookmark icon (replaces "Save Draft" link)

**Exercise cards** — one card per exercise:
- Header: mono number (`01` in `--red`, rest `--muted`) + name (13px, 600 weight) + scheme in `--muted` mono
- Body: tip with `›` in `--red` + suggested load in `--muted` mono

---

## 6. Custom Routine Builder (`CustomRoutineBuilder.tsx`)

**Current:** "Configure Routine" with "Abort", identifier input, exercise rows, white "Commit Sequence" button.

**After:**

**Page header:**
- Eyebrow: "New Routine"
- Title: "Configure Routine" at 22px
- Ghost "Discard" button top-right

**Identifier** — own card with "Identifier" header + "Routine name" field.

**Protocol Structure** — separate card:
- Header: "Protocol Structure" + ghost "Strength" / "Cardio" buttons with plus icons
- Exercise rows: `--bg-2` background, `--border` border, new field styling
- Field labels in mono `--muted`

**Save button:** Red full-width "Save Routine" with check icon.

---

## 7. Live Workout — Exercise Area (`LiveWorkout.tsx`)

### Header bar
- Red pulse dot + routine name (14px, 600 weight) + mono metadata line
- Rest timer config: `--bg-2` pill with timer icon
- Unit toggle: `--bg-2` bg, active `--bg-3` + white, inactive `--muted`
- Ghost "Abort" + red "Finish Session"

### Exercise cards
- **Active exercise** — full opacity, `--border-2` border. Header: mono number in `--red`, name (14px, 600), scheme in `--muted`, **set progress squares** (7×7px — red fill = done, `--bg-3` + `--border-2` border = pending).
- **Upcoming exercises** — 45% opacity. Card header only (no set table).
- **Set table**: `--border` dividers, `--muted` headers, `--white` values. Done button = red. Pending = ghost `--muted`. Prev history in `--border-2`.
- **"Add Set"**: ghost button in card footer
- **"Add Exercise"**: dashed border, muted, plus icon at bottom

### Status footer
- Mono: "Sets 1 / 4" (number in `--white` bold)
- Red pulse dot + "LIVE" label

### Visual dimming
The currently active exercise (first with an incomplete set) renders at full opacity. All others render at 45% opacity. This is a presentational-only CSS class derived from existing tracked set data — no new state or logic.

---

## 8. Rest Timer (`LiveWorkout.tsx` — timer section)

**Current:** Small floating widget bottom-right with countdown, play/pause, +30s, stop. Turns red when ≤10s.

**After:** Full-screen takeover.

When `restTimeRemaining > 0 && isTimerActive`, the exercise card area is replaced with a centered rest view. Header bar and footer bar remain visible.

Rest view:
- "Resting" label in `--muted` mono uppercase
- Countdown at 80px, mono, `--white`, bold
- Progress bar: 280px × 2px, `--bg-3` track, `--red` fill (percentage = elapsed / configured)
- Next set context: "Next · Set **03 / 4** at 135 lbs × 8 reps" in `--dim`
- Action buttons: ghost "+30s" + ghost "Skip Rest"
- Low-time state (≤10s): countdown + progress bar turn `--red`, countdown pulses. Same layout, color state only.

**Rendering change:** Component conditionally renders exercise list OR timer takeover based on existing `restTimeRemaining` and `isTimerActive` state. No new state variables.

---

## 9. Analytics (`ProgressView.tsx`)

**Current:** Green "Analytics Engine" heading with trophy. Calendar grid. Weekly summary. Detail modal.

**After:**

**Page header:**
- Eyebrow: "Week of {date range}" in mono
- Title: "Analytics" at 22px (no trophy icon)
- Ghost chevron buttons for week nav in header right

**Calendar** — card wrapper:
- Day labels: mono `--muted` 9px
- Date numbers: 16px 600 weight, `--text-2` normal / `--red` today
- Today column: subtle `rgba(192,57,43,0.04)` bg tint
- Workout entries: `--bg-2` bg, `--border` border, body part in white 9px 600, set count in `--red` mono
- Rest days: "Rest" in `--border-2` mono

**Weekly Output** — separate card:
- Header: "Weekly Output"
- Target areas: `--white` 600 weight uppercase
- Volume numbers: `--red` 700 weight right-aligned

**Workout detail modal:**
- 12px border-radius
- Header: routine name (15px, 700, `--white`) + date in `--muted` mono + delete/close buttons
- Body: exercise cards with data tables. "Done" in `--red`, "Skip" in `--dim`. Cardio values in `--red`.

---

## Files Changed

| File | Nature of Change |
|---|---|
| `index.html` | Add Google Fonts link tags |
| `src/index.css` | Add CSS custom properties + `@theme` block for fontFamily (Tailwind CSS 4 uses CSS-based config) |
| `src/components/Layout.tsx` | Full rewrite — icon rail |
| `src/components/Login.tsx` | Full rewrite — left-aligned layout + greeting |
| `src/components/RoutinesList.tsx` | Full rewrite — list cards + empty state |
| `src/components/RoutineGenerator.tsx` | Restyle — tokens, typography, card structure |
| `src/components/CustomRoutineBuilder.tsx` | Restyle — tokens, card sections, button labels |
| `src/components/LiveWorkout.tsx` | Restyle + timer takeover rendering branch |
| `src/components/ProgressView.tsx` | Restyle — tokens, calendar, modal, table |

## Out of Scope

- New AI Generator fields (Experience Level, Goal)
- "Last done N days ago" computation on routine cards
- Volume totals in live workout footer
- Backend or auth changes
- Email/password auth

# Forge.AI — Railway Deployment Plan

## Prerequisites
- [x] Railway account exists
- [x] GitHub repo exists (realdaniel1989/Forge) — empty, ready for code
- [x] Local project initialized as git repo with initial commit
- [x] Spec approved: `docs/superpowers/specs/2026-05-19-railway-deployment-design.md`

## Implementation Steps

### Step 1: Create `railway.json`
- **Action:** Write `railway.json` to project root
- **Contents:** build command, start command, healthcheck, restart policy
- **Verify:** File exists and is valid JSON

### Step 2: Security audit before push
- **Action:** Grep for hardcoded secrets (GEMINI_API_KEY, any .env with real values)
- **Verify:** No secrets in tracked files

### Step 3: Push to GitHub
- **Action:** Commit railway.json, add remote, push to `main`
- **Verify:** `git remote -v` shows correct URL; `git log` shows commit

### Step 4: Guide user through Railway dashboard setup
- **Action:** Walk user through creating project, connecting GitHub repo, setting env vars
- **Verify:** First deploy succeeds

### Step 5: Post-deploy configuration
- **Action:** Set APP_URL env var, add Railway domain to Firebase authorized domains
- **Verify:** App loads, Google Sign-In works, AI generation works

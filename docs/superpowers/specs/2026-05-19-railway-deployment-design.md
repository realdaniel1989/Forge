# Forge.AI — Railway Deployment Design

## Overview

Deploy the Forge.AI gym workout tracker to Railway via GitHub integration. The app is a unified React 19 + Express.js project using Firestore, Firebase Auth, and the Gemini API.

## Approach

**Nixpacks with `railway.json` config.** Railway auto-detects Node.js and uses Nixpacks to build. A `railway.json` file provides explicit build/start commands. GitHub integration enables auto-deploys on push.

---

## 1. Project Configuration Files

### `railway.json`

- **Build command:** `npm run build` (runs `vite build` + `esbuild` to produce `dist/server.cjs` + static assets)
- **Start command:** `npm run start` (runs `node dist/server.cjs`)
- **Healthcheck path:** `/api/health` (existing Express endpoint)
- **Restart policy:** on failure with max retries

### `PORT` handling

Railway injects the `PORT` env var automatically. `server.ts` already reads `process.env.PORT` and defaults to 3000. No code changes needed.

---

## 2. Git & GitHub Setup

The GitHub repo at `realdaniel1989/Forge` is currently empty. The local project has no git repo.

### Steps

1. `git init` in the project directory
2. Verify `.gitignore` excludes: `node_modules/`, `dist/`, `.env*` (except `.env.example`), `.superpowers/`
3. Audit that no API keys or secrets are hardcoded (Firebase web API key is public by design — safe to commit)
4. Add remote: `https://github.com/realdaniel1989/Forge.git`
5. Commit all files and push to `main`

### Security check before push

- `GEMINI_API_KEY` must only appear as `process.env.GEMINI_API_KEY` — never hardcoded
- No `.env` file with real secrets can be committed
- `firebase-applet-config.json` is safe to commit (Firebase web API keys are public; security enforced via Firestore rules)

---

## 3. Railway Project & Service Setup

### Create project

- New project → "Deploy from GitHub repo" → select `realdaniel1989/Forge`
- Railway auto-detects Node.js, uses `railway.json` for build/start

### Environment variables

| Variable | Value | Notes |
|---|---|---|
| `GEMINI_API_KEY` | *(user's key)* | For AI workout generation |
| `APP_URL` | `https://<railway-app>.up.railway.app` | Set after first deploy |
| `NODE_ENV` | `production` | Ensures Express serves static built files |
| `PORT` | *(auto-injected by Railway)* | No action needed |

### Domain

- Railway provides a default `*.up.railway.app` domain
- Custom domain can be added later (out of scope)

### Firebase authorized domain

After first deploy, add the Railway URL to Firebase Console → Authentication → Settings → Authorized domains. Required for Google Sign-In to work in production.

---

## 4. Deployment Flow

### Step 1: Local setup

- Create `railway.json`
- Verify `.gitignore`
- Init git, commit, push to GitHub

### Step 2: Railway setup (guided via dashboard)

- Create new project from GitHub repo
- Set environment variables (`GEMINI_API_KEY`, `NODE_ENV`)
- Trigger first deploy

### Step 3: Post-deploy configuration

- Get Railway URL from deploy logs
- Set `APP_URL` env var
- Add URL to Firebase authorized domains
- Redeploy

### Step 4: Verify

- App loads at Railway URL
- Google Sign-In works
- AI workout generation works
- Full workout logging flow works

---

## Out of Scope

- Custom domain setup
- CI/CD beyond Railway's default auto-deploy
- Staging/preview environments
- Database migrations (Firestore is schemaless)

# CalorieAI — Smart Food Tracker

A full-stack calorie tracker powered by Claude Vision AI. Take or upload a photo of food → Claude identifies it and returns calorie info → entries are logged per user in PostgreSQL.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + TypeScript + Express (Vercel Serverless) |
| Database | PostgreSQL (Supabase) |
| AI | Anthropic Claude claude-sonnet-4-6 (Vision + prompt caching) |
| Deployment | Vercel (2 projects) |

---

## Project Structure

```
Calorie-Tracker/
├── backend/
│   ├── api/
│   │   └── index.ts        Vercel serverless entry point
│   ├── src/
│   │   ├── app.ts          Express app (no listen — exported)
│   │   ├── index.ts        Local dev entry (calls app.listen)
│   │   ├── db.ts           pg Pool
│   │   ├── middleware/
│   │   │   └── auth.ts     JWT middleware
│   │   └── routes/
│   │       ├── auth.ts     POST /auth/register, POST /auth/login
│   │       ├── food.ts     POST /food/analyse, CRUD /food/log
│   │       └── user.ts     GET /user/me, PUT /user/goal
│   └── vercel.json         Routes all traffic → api/index.ts
├── frontend/
│   ├── src/
│   │   ├── App.tsx         React Router routes
│   │   ├── api/client.ts   Axios instance (auto-attach JWT)
│   │   ├── context/        AuthContext (token + user state)
│   │   ├── components/     Layout, ProtectedRoute
│   │   └── pages/          Login, Register, Dashboard, Camera
│   └── vercel.json         SPA fallback rewrite to index.html
├── schema.sql              PostgreSQL schema (run once)
└── README.md
```

---

## Local Development

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is fine) **or** local PostgreSQL
- Anthropic API key (`sk-ant-...`)

### 1. Database

**Option A — local Postgres:**
```bash
psql -U postgres -c "CREATE DATABASE calorie_tracker;"
psql -U postgres -d calorie_tracker -f schema.sql
```

**Option B — Supabase (skip local Postgres entirely):**
- Run `schema.sql` in your Supabase project → **SQL Editor**
- Copy the **Session mode** pooler URL from **Project Settings → Database → Connection Pooling**
- Use that URL as `DATABASE_URL` in `backend/.env`

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm run dev            # http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:3001
npm install
npm run dev            # http://localhost:5173
```

---

## Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase pooler connection string (see Step 2 below) |
| `JWT_SECRET` | Yes | Long random string — generate with `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key (`sk-ant-...`) |
| `FRONTEND_URL` | Yes | Your deployed frontend URL for CORS |
| `PORT` | No | HTTP port for local dev (default `3001`) |
| `NODE_ENV` | No | Set to `production` on Vercel |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Your deployed backend URL |

> `VITE_API_URL` is a **build-time** variable — Vite bakes it into the bundle. Set it in the Vercel project settings **before** the first deploy.

---

## API Reference

### Auth

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/auth/register` | — | `{ email, password }` |
| POST | `/auth/login` | — | `{ email, password }` |

### User

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/user/me` | JWT | — |
| PUT | `/user/goal` | JWT | `{ daily_calorie_goal }` |

### Food

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/food/analyse` | JWT | `multipart/form-data` — field `image` (max 4 MB) |
| POST | `/food/log` | JWT | `{ food_name, calories, serving_description? }` |
| GET | `/food/log` | JWT | — (returns today's entries) |
| DELETE | `/food/log/:id` | JWT | — |

---

## Vercel Deployment

You'll create **two separate Vercel projects** from the same GitHub repository — one for the backend, one for the frontend.

---

### Step 1 — Push to GitHub

```bash
git add .
git commit -m "Initial full-stack calorie tracker"
git push origin main
```

---

### Step 2 — Create a Supabase project and run the schema

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine)
2. Choose a name, password, and region → **Create new project**
3. Once provisioned, open the **SQL Editor** (left sidebar) → paste and run `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  daily_calorie_goal INTEGER NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_name VARCHAR(255) NOT NULL,
  calories INTEGER NOT NULL,
  serving_description VARCHAR(255),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_date
  ON food_logs (user_id, logged_at DESC);
```

4. Go to **Project Settings → Database → Connection Pooling**
5. Make sure **Connection pooling** is enabled
6. Copy the **Session mode** connection string (port **5432**) — it looks like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
   This is your `DATABASE_URL`.

> **Why Session mode?** Transaction mode (port 6543) doesn't support all PostgreSQL features. Session mode works with the `pg` driver and is fine for Vercel serverless because Supabase's pooler manages the underlying connections.

---

### Step 3 — Deploy the Backend

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select your repo
2. **Project Name**: e.g. `calorie-tracker-api`
3. Under **Root Directory** → click **Edit** → enter `backend`
4. **Framework Preset**: leave as **Other**
5. Expand **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Supabase pooler URL from Step 2 |
   | `JWT_SECRET` | run `openssl rand -base64 32` locally |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` *(fill in after Step 4)* |
   | `NODE_ENV` | `production` |

6. Click **Deploy**
7. Once deployed, copy the production URL (e.g. `https://calorie-tracker-api.vercel.app`)

---

### Step 4 — Deploy the Frontend

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select the same repo
2. **Project Name**: e.g. `calorie-tracker`
3. Under **Root Directory** → click **Edit** → enter `frontend`
4. **Framework Preset**: Vercel auto-detects **Vite**
5. Expand **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://calorie-tracker-api.vercel.app` *(from Step 3)* |

6. Click **Deploy**
7. Copy the frontend URL (e.g. `https://calorie-tracker.vercel.app`)

---

### Step 5 — Wire up CORS

Go back to the **backend** Vercel project → **Settings** → **Environment Variables** → update:

```
FRONTEND_URL = https://calorie-tracker.vercel.app
```

Then **Deployments** → three-dot menu on the latest → **Redeploy**.

---

### Step 6 — Verify

1. Open `https://calorie-tracker.vercel.app`
2. Register a new account
3. Go to **+ Add Food** → upload a food photo
4. Claude AI analyses it → confirm → check your Dashboard

---

## How It Works

1. **Auth** — JWT signed with `JWT_SECRET`, stored in `localStorage`, auto-attached to every request via Axios interceptor
2. **Photo upload** — image sent as `multipart/form-data` to `POST /food/analyse` (max 4 MB on Vercel)
3. **Claude Vision** — backend base64-encodes the image and calls `claude-sonnet-4-6` with prompt caching on the system message. Claude returns structured JSON: `{ food_name, calories, serving_description }`
4. **Log entry** — user confirms; frontend calls `POST /food/log`; entry saved to PostgreSQL
5. **Dashboard** — fetches today's entries, renders an SVG calorie ring (consumed vs. goal) and a deletable log list

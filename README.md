# Calenduel

climb mountains as a cat with your friends

## Story

Once upon a time, there was a house cat. He felt his destiny was to climb mountains, but throughout his life he was told that climbing mountains as a house cat was impossible. He fell into a deep depression, spending 20 hours every day on tiktok, for 20 years of his life.

He attempted to climb mountains a few times, but every time he failed because he didn't have support from his cat friends, or the right tools.

It was only once he was able to get a harness, the right tools, and team up with his friends that he could summit the mountain, and since then he's forgotten his life of sorrow and climbed every day!

You can play as this cat! Sync your Google Calendar events, check in, and log work to climb the mountain.

## The problem

Other study apps block some apps on your phone (which you can bypass anyways), and have a timer. That's pretty much it.

## The Solution

Calenduel keeps you accountable through social pressure and focus detection.

Here's the flow:

1. Pick a study block from your calendar.
2. Climb for the duration of your event. Friends studying at the same time can see that you're studying, and can throw snowballs if you're off-task.
3. Get periodic focus feedback from Gemini processing an image of your face every 2-3 minutes.
4. End at Summit with outcome metrics (planned vs completed, focus score, kept commitment).

### what you mean i'm climbing a mountain?

- altitude maps to time you spent working
- summitting the mountain means commitment completion.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Browser CV: MediaPipe FaceLandmarker via `@mediapipe/tasks-vision` (eye-aspect-ratio + head pose, runs client-side)
- Serverless API: Vercel Functions (`@vercel/node`)
- Data: Postgres accessed through `@vercel/postgres` (Neon free tier in production, local Docker for development)
- Auth/Calendar: Google OAuth + Google Calendar API (readonly scope), refresh tokens encrypted at rest with AES-256-GCM
- Vision API route: Google Gemini via `@google/generative-ai` (`/api/check-focus`)

## Vercel Implementation Details

Vercel is the backbone of the deployed web stack: the frontend is built and served as a Vite app, and backend behavior is implemented through serverless routes under `api/` (auth, friends, sessions, focus scoring, and roasts). Google OAuth login and callback handling run in Vercel Functions, session identity is stored via HTTP cookies set by those functions, and social/session endpoints read and write persistent state through `@vercel/postgres`. Refresh tokens are encrypted at rest with AES-256-GCM before being stored. The focus-scoring endpoint (`/api/check-focus`) calls Gemini server-side so the API key never reaches the browser, and the roast endpoint (`/api/roast`) calls Anthropic server-side with a deterministic fallback when no key is configured. This gives us one deployment surface for UI and APIs while keeping room for the legacy Python eye-tracking service as an optional parallel component.

Primary environment variables used by this architecture (see `.env.example` for the full set):

- `POSTGRES_URL`: Postgres connection string (Neon in production, local Docker for dev)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth + Calendar readonly scope
- `GEMINI_API_KEY`: required for `/api/check-focus` and the academic-event classifier
- `ANTHROPIC_API_KEY`: optional, only needed for richer `/api/roast` outputs
- `REFRESH_TOKEN_KEY`: 32-byte hex key for AES-256-GCM encryption of stored refresh tokens (generate with `openssl rand -hex 32`)
- `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL`: used for OAuth callback and base URL handling

## Repo Structure

```text
.
├── api/                    # Vercel serverless endpoints
│   ├── auth/               # Google OAuth login, callback, logout
│   ├── calendar/           # Server-side Calendar event proxy and overrides
│   ├── friends/            # Invite, join, incoming, respond, remove, revoke, list
│   ├── profile/            # User preferences
│   ├── sessions/           # Session start/end persistence
│   ├── roasts/             # Friend-throw delivery and inbox
│   ├── check-focus.ts      # Gemini vision focus scoring
│   ├── roast.ts            # Anthropic roast generator with deterministic fallback
│   └── _lib/               # cookies, db, session, crypto, google-token, classify
├── frontend/               # React + Vite app
│   ├── docs/               # Demo, focus checks, calendar integration notes
│   └── src/                # Includes lib/use-face-tracker.ts (MediaPipe browser tracker)
├── backend/                # Legacy Python FastAPI eye-tracking WebSocket prototype
├── migrations/             # Idempotent SQL migrations (001 through 004)
├── pitch-deck/             # Static pitch deck and renderer
└── package.json            # Root deps used by /api routes
```

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.10+

### 1) Install dependencies

```bash
# from repo root
npm install

# frontend deps
cd frontend && npm install

# backend deps
cd ../backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_mediapipe_model.py
```

### 2) Run frontend

```bash
cd frontend
npm run dev
```

## Environment Notes

Copy `.env.example` to `.env.local` and fill in:

- `POSTGRES_URL` (Neon connection string in production, local Docker for dev)
- Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) with redirect URI `http://localhost:3000/api/auth/callback`
- `GEMINI_API_KEY` (required for `/api/check-focus` and the academic classifier in `api/_lib/classify.ts`)
- `ANTHROPIC_API_KEY` (optional, only needed for richer `/api/roast` outputs; unset uses the deterministic fallback)
- `REFRESH_TOKEN_KEY` (32-byte hex, generate with `openssl rand -hex 32`)

## Database migrations

Apply the SQL files in `migrations/` in order: 001 base schema (users, friendships, sessions), 002 refresh-token storage and event classifications, 003 auth sessions, 004 friend system polish. All files are idempotent (`CREATE TABLE IF NOT EXISTS`), so re-running is safe. The `roast_events` table used by the friend-throw flow is auto-created on first insert by `/api/roasts/throw` and `/api/roasts/inbox`.

## Demo and Docs

- Frontend implementation notes: [`frontend/README.md`](frontend/README.md)
- Eye-tracking backend protocol: [`backend/README.md`](backend/README.md)
- Demo talk track: [`frontend/docs/DEMO_SCRIPT.md`](frontend/docs/DEMO_SCRIPT.md)
- Focus check behavior: [`frontend/docs/FOCUS_CHECKS.md`](frontend/docs/FOCUS_CHECKS.md)
- Calendar integration plan: [`frontend/docs/CALENDAR_INTEGRATION.md`](frontend/docs/CALENDAR_INTEGRATION.md)

## Team

- Candy Xie - UI, frontend 
- Travis Sim - backend
- Andy Li - design, pitch
- Zachary Galbraith - calendar/auth integration, backend yuh

## Links

- Written Description: [[Docs](https://docs.google.com/document/d/1ph8xvU7aXd4bVt_SnOja5ocCN6N0PLpWgEO2ofITH88/edit?usp=sharing)]
- Demo Video: [[Link](https://www.youtube.com/watch?v=lC2OZYatt8Y)]

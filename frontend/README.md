# CompCal frontend

React + Vite app for CompCal (calendar check-ins, focus mountain, friends).

## Run locally

```bash
npm i
npm run dev
```

## Deploy on Vercel

1. Import this Git repo in [Vercel](https://vercel.com/).
2. Set **Root Directory** to `frontend` (repo root is `nyu-eeg-hack`).
3. Framework preset: **Vite**. Build: `npm run build`, Output: `dist`.
4. `vercel.json` in this folder rewrites all routes to `index.html` for client-side routing.

The UI uses a **wide centered shell** (`max-w-6xl`, ~1152px) so demos read well on desktop, not only a narrow phone width.

**Visual theme:** One coherent **Snow Mountain Retro** palette site-wide (see [`src/styles/theme.css`](src/styles/theme.css)) keyed off the pixel art asset [`public/media/snow-mountain-retro-theme.png`](public/media/snow-mountain-retro-theme.png) (renamed from the Gemini export). The same image backs the body (subtle) and the **mountain / summit** flows (full-bleed) with an SVG trail + climber overlay only.

**Study session:** **Calendar → Start studying** opens full-screen `/mountain/*` with that art + trail; the tab bar is hidden so the mountain is the main UI. Optional legacy clip: [`public/media/study-ambient.mp4`](public/media/study-ambient.mp4) (unused by default).

## Why this matters (Education + Social Good)

CompCal is designed for college students dealing with attention drift and burnout, where the
problem is not knowledge, but staying with one planned task long enough to finish it.

- **Low-pressure accountability:** commitment is framed as support, not punishment.
- **Buddy co-check-ins:** students can start a block with one peer and both see completion.
- **Visible outcomes:** summit and profile surface kept commitments, completed minutes, and
  focus trend so progress is concrete.
- **Trust-first checks:** focus checks are periodic and can be disabled; no continuous recording.

## What is real vs mocked (important for judges)

### Implemented in app now

- Calendar -> Mountain -> Summit flow with session timing.
- Buddy co-commit selection and completion visibility.
- Session outcome persistence in local storage and weekly summary on profile.
- Low-pressure mode toggle (roast disabled + softer drift messaging).
- Focus-check transparency panel + user control to enable/disable checks.

### Prototype / mocked today

- Calendar data source uses fixtures (not Google OAuth sync yet).
- Focus checks are simulated events (no camera capture in this prototype).
- Study assistant answers are canned text, not a production LLM backend.

## Demo assets

- 90-second script + architecture narrative: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)
- Calendar integration path: [`docs/CALENDAR_INTEGRATION.md`](docs/CALENDAR_INTEGRATION.md)
- Focus checks and privacy notes: [`docs/FOCUS_CHECKS.md`](docs/FOCUS_CHECKS.md)

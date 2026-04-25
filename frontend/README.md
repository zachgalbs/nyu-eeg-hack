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

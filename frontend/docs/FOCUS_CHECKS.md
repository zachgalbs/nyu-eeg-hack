# Focus checks (periodic) — prototype and production notes

## Current prototype

- [`MountainScreen.tsx`](../src/app/components/MountainScreen.tsx) runs a **mock** periodic check on a fixed interval (short for demo) and random “verified / distracted” outcomes.
- No images are captured; no third-party APIs are called.
- Users can toggle checks on/off in-app, and enable a **low-pressure mode** that softens nudges and disables roast behavior.

## Intended product behavior

- **Periodic snapshots only** (e.g. every 5–10 minutes), not continuous video—lower cost and clearer consent story.
- Send each snapshot (or derived features) to a **configurable vision / multimodal model**; keep model id and prompt version in server config so you can swap providers.
- **Cost:** at production scale, per-image inference adds up; rate-limit per user, cap free tier, or charge. For hackathon / prototype, mocks are fine.

## Co-study “relaxed mode” (future flag)

- Product idea: when users are in a **mutual overlap check-in** (same time window as a friend’s block), vision checks might be **less frequent**, **softer**, or **skipped**—studying with someone else is already accountability; the camera is not strictly required.
- Implement as a boolean on session state, e.g. `coStudyRelaxed`, derived from calendar overlap at check-in time. Default in prototype: **off** (checks unchanged).

## Eye tracking vs full video

- Prefer **single frames** or short bursts over continuous video for bandwidth and storage.
- Eye / gaze estimation from one frame is noisy; product rules should combine weak signals (e.g. gaze + window focus API where available) and avoid harsh penalties on ambiguous frames.

## Study assistant (Q&A)

- The in-app **Quick question** panel is **text Q&A only**—not activity surveillance. If you later connect an LLM, route questions through your backend with logging and abuse controls; do not mix assistant logs with focus images without explicit consent.

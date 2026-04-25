# Google Calendar integration (next milestone)

This prototype uses **mock events** in [`src/data/calendarFixtures.ts`](../src/data/calendarFixtures.ts). The steps below are for a future milestone when CompCal should read a user’s real calendar.

## Goals

- **Read-only** sync of the user’s events (create/edit/delete in Google Calendar stays the source of truth initially).
- Map each external event into the internal shape: `id`, `title`, `start`, `end`, `ownerId`, `ownerName` (see `CalendarEvent` in fixtures).
- Preserve **overlap detection** in the user’s local timezone: two intervals overlap if `startA < endB && endA > startB` (inclusive boundaries as implemented today).

## OAuth (high level)

1. Create a Google Cloud project; enable **Google Calendar API**.
2. OAuth consent screen (internal / test users for development).
3. Create **OAuth 2.0 Web client** credentials; authorized JavaScript origins = your Vercel domain + `http://localhost:5173` for dev.
4. Scopes: start with `https://www.googleapis.com/auth/calendar.readonly`.
5. Exchange auth code for refresh + access tokens on your **backend** (do not store client secrets in the Vite bundle). The SPA should only receive short-lived access tokens or session cookies from your API.

## Sync strategy

- **Initial:** `events.list` with `timeMin` / `timeMax` for the visible week (or rolling window).
- **Incremental:** `syncToken` via `events.list` incremental sync when supported; otherwise periodic poll while the app is open.
- **IDs:** Store Google `event.id` + `iCalUID` in your DB or local cache to dedupe updates.

## Overlaps with friends

- Today’s prototype treats “friends” as **fixture rows**. In production, friends’ busy intervals would come from **their shared availability** or **opt-in shared calendar** endpoints—not from scraping private calendars without consent.
- **UTC vs local:** Store instants in UTC; render and compare overlaps in the user’s IANA timezone (`Intl` / `date-fns-tz`).

## Privacy (ties to focus checks)

- Calendar data is separate from **camera snapshots**. If you add vision checks later, document data retention, who can see images, and how co-study mode affects sampling (see `FOCUS_CHECKS.md`).

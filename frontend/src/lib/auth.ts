/**
 * Auth helpers. The Google access token now lives server-side and is
 * refreshed automatically — the client only knows whether a session
 * cookie (`user_id`) exists.
 */

export function isSignedIn(): boolean {
  return /(?:^|;\s*)user_id=/.test(document.cookie);
}

export function getUserName(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)user_name=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * @deprecated The client no longer holds the Google access token. Use
 * `isSignedIn()` to gate UI; calendar fetches go through `/api/calendar/*`.
 * Retained as a shim so any lingering callers compile until migrated.
 */
export function getGoogleToken(): string | null {
  return isSignedIn() ? 'server-side' : null;
}

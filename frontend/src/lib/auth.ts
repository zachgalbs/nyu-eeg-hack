export function getGoogleToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)google_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getUserName(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)user_name=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

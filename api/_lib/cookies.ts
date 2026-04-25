import type { VercelRequest } from '@vercel/node';

export function parseCookie(req: VercelRequest, name: string): string | null {
  const match = req.headers.cookie?.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function getUserIdFromCookies(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)user_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

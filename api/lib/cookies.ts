import type { VercelRequest } from '@vercel/node';

export function parseCookie(req: VercelRequest, name: string): string | null {
  const match = req.headers.cookie?.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

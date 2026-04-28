import crypto from 'crypto';

/**
 * AES-256-GCM at-rest encryption for sensitive credentials (Google refresh
 * tokens). Format: base64(iv) ":" base64(authTag) ":" base64(ciphertext).
 *
 * Requires REFRESH_TOKEN_KEY env var: 64 hex chars = 32 random bytes.
 * Generate one with: openssl rand -hex 32
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const hex = process.env.REFRESH_TOKEN_KEY;
  if (!hex) {
    throw new Error('REFRESH_TOKEN_KEY env var is not set (need 64 hex chars)');
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_BYTES) {
    throw new Error(`REFRESH_TOKEN_KEY must decode to ${KEY_BYTES} bytes, got ${buf.length}`);
  }
  cachedKey = buf;
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join(':');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Malformed ciphertext');
  const [iv, tag, enc] = parts.map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

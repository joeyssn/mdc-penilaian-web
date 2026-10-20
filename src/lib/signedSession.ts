// Signed session tokens (HMAC-SHA256). Uses Web Crypto so it works in both route handlers and middleware.
// Token format: base64url(JSON payload) + "." + base64url(signature). Editing the payload invalidates the signature.

const enc = new TextEncoder();
const dec = new TextDecoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters. Add it to .env.');
  }
  return s;
}

function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str: string) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(usage: KeyUsage[]) {
  return crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function signSession(payload: Record<string, unknown>): Promise<string> {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS };
  const data = toB64Url(enc.encode(JSON.stringify(body)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(['sign']), enc.encode(data));
  return `${data}.${toB64Url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined): Promise<Record<string, any> | null> {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(['verify']), fromB64Url(sig), enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(fromB64Url(data)));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

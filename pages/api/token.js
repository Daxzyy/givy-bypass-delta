// pages/api/token.js
// Issue session token 1x pakai
// Proteksi:
//   - Origin WAJIB ada dan harus match domain sendiri
//   - Rate limit: max 30 token / IP / menit
//   - Token expire 90 detik, 1x pakai

import crypto from 'crypto';

export const tokenStore = new Map();   // token → { exp }
const rateMap  = new Map();            // ip    → [timestamps]

const RATE_LIMIT  = 30;      // max request per window
const RATE_WINDOW = 60_000;  // 1 menit
const TOKEN_TTL   = 90_000;  // 90 detik

function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now  = Date.now();
  const hits = (rateMap.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of tokenStore.entries()) {
    if (now > v.exp) tokenStore.delete(k);
  }
  for (const [k, v] of rateMap.entries()) {
    const fresh = v.filter(t => now - t < RATE_WINDOW);
    if (fresh.length === 0) rateMap.delete(k);
    else rateMap.set(k, fresh);
  }
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // ── Origin check: WAJIB ada & harus match ───────────────
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  const host    = req.headers['host']    || '';
  const ALLOWED = process.env.ALLOWED_DOMAIN || host;
  const clean   = (s) => s.replace(/https?:\/\//, '').split('/')[0];

  // Tolak kalau origin kosong (curl/Postman/fetch dari domain lain)
  const originOk =
    (origin  && clean(origin).endsWith(clean(ALLOWED))) ||
    (referer && clean(referer).endsWith(clean(ALLOWED)));

  if (!originOk) {
    return res.status(403).end();
  }

  // ── Rate limiting ────────────────────────────────────────
  const ip = getIP(req);
  if (isRateLimited(ip)) {
    return res.status(429).end();
  }

  cleanup();

  // ── Issue token ──────────────────────────────────────────
  const token = crypto.randomBytes(32).toString('hex');
  tokenStore.set(token, { exp: Date.now() + TOKEN_TTL });

  return res.status(200).json({ s: token });
}

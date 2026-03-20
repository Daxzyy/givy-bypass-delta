// pages/api/bypass.js
// ════════════════════════════════════════════════════
//  PROTEKSI 4 LAPIS:
//  1. Origin/Referer wajib dari domain sendiri
//  2. Secret header X-Givy-Req wajib match env var
//  3. CSRF token 1x-pakai (dapet dari GET ?action=csrf)
//  4. Rate limit 12 req/menit per IP
// ════════════════════════════════════════════════════

const csrfStore = new Map();
const rateStore = new Map();
const CSRF_TTL   = 90_000;
const RATE_LIMIT = 12;
const RATE_WIN   = 60_000;

function makeKey(len = 20) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let k = '';
  for (let i = 0; i < len; i++) k += c[Math.floor(Math.random() * c.length)];
  return k;
}

function xorEncode(str, key) {
  const buf = [];
  for (let i = 0; i < str.length; i++)
    buf.push(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return Buffer.from(buf).toString('base64url');
}

function obfuscate(payload) {
  const key  = makeKey(20);
  const data = xorEncode(JSON.stringify(payload), key);
  return `${makeKey(10)}.${key.split('').reverse().join('')}.${data}.${makeKey(7)}`;
}

function cleanHost(s) {
  return (s || '').replace(/https?:\/\//, '').split('/')[0].split(':')[0];
}

function domainMatch(headerVal, allowed) {
  if (!headerVal) return false;
  const h = cleanHost(headerVal);
  const a = cleanHost(allowed);
  return h === a || h.endsWith('.' + a);
}

function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress || 'unknown'
  );
}

function rateOk(ip) {
  const now = Date.now();
  const e   = rateStore.get(ip);
  if (!e || now > e.resetAt) { rateStore.set(ip, { count: 1, resetAt: now + RATE_WIN }); return true; }
  if (e.count >= RATE_LIMIT) return false;
  e.count++;
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const host    = req.headers['host']    || '';
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  const ALLOWED = process.env.ALLOWED_DOMAIN || host;

  // ── CSRF token issuer ─────────────────────────────
  if (req.method === 'GET' && req.query.action === 'csrf') {
    if (!domainMatch(origin, ALLOWED) && !domainMatch(referer, ALLOWED)) return res.status(403).end();
    const token = makeKey(32);
    csrfStore.set(token, Date.now() + CSRF_TTL);
    for (const [k, exp] of csrfStore) { if (Date.now() > exp) csrfStore.delete(k); }
    return res.status(200).json({ c: token });
  }

  // ── Hanya POST ────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).end();

  // Layer 1: Origin/Referer
  if (!domainMatch(origin, ALLOWED) && !domainMatch(referer, ALLOWED)) return res.status(403).end();

  // Layer 2: Secret header
  const SECRET = process.env.GIVY_SECRET || '';
  if (!SECRET || req.headers['x-givy-req'] !== SECRET) return res.status(403).end();

  // Layer 3: CSRF
  const { url, c: csrf } = req.body || {};
  if (!csrf) return res.status(401).end();
  const csrfExp = csrfStore.get(csrf);
  if (!csrfExp || Date.now() > csrfExp) { csrfStore.delete(csrf); return res.status(401).end(); }
  csrfStore.delete(csrf);

  // Layer 4: Rate limit
  if (!rateOk(getIP(req))) return res.status(429).end();

  // Validasi URL
  if (!url) return res.status(400).end();
  try { new URL(url); } catch { return res.status(400).end(); }

  // Fetch upstream
  const API_KEY  = process.env.BYPASS_API_KEY || 'freeApikey';
  try {
    const up = await fetch(
      `https://anabot.my.id/api/tools/izenLOL?url=${encodeURIComponent(url)}&apikey=${API_KEY}`,
      { headers: { 'User-Agent': 'GivyBypassDelta/1.0' }, signal: AbortSignal.timeout(15000) }
    );
    if (!up.ok) return res.status(502).json({ t: obfuscate({ ok: false, e: 'upstream' }) });
    const data = await up.json();
    return res.status(200).json({ t: obfuscate({
      ok: data.success === true,
      result: data.data?.result?.result ?? null,
      time:   data.data?.result?.time   ?? null,
    })});
  } catch (err) {
    if (err.name === 'TimeoutError') return res.status(504).json({ t: obfuscate({ ok: false, e: 'timeout' }) });
    return res.status(500).json({ t: obfuscate({ ok: false, e: 'err' }) });
  }
}

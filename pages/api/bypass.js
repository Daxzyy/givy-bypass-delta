import { serialize, parse } from 'cookie';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const csrfStore = new Map();
const rateStore = new Map();
const CSRF_TTL  = 90_000;
const RATE_MAX  = 12;
const RATE_WIN  = 60_000;
const COOKIE    = '__gsid';

function rand(n = 24) {
  return randomBytes(n).toString('base64url');
}

function signSession(id) {
  const secret = process.env.COOKIE_SECRET || 'changeme';
  return createHmac('sha256', secret).update(id).digest('base64url');
}

function verifySession(cookie) {
  if (!cookie) return false;
  const [id, sig] = cookie.split('.');
  if (!id || !sig) return false;
  const expected = Buffer.from(signSession(id));
  const actual   = Buffer.from(sig);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function makeKey(n = 20) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let k = '';
  for (let i = 0; i < n; i++) k += c[Math.floor(Math.random() * c.length)];
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

function domainOk(val, allowed) {
  if (!val) return false;
  const h = cleanHost(val);
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
  if (!e || now > e.r) { rateStore.set(ip, { n: 1, r: now + RATE_WIN }); return true; }
  if (e.n >= RATE_MAX) return false;
  e.n++;
  return true;
}

function setHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

async function sendTelegram(ip, url, result, status) {
  const token  = process.env.T_T;
  const chatId = process.env.T_C;
  if (!token || !chatId) return;

  let ipInfo = 'Unknown';
  try {
    const geo = await fetch(`http://ip-api.com/json/${ip}`, { signal: AbortSignal.timeout(4000) });
    const g   = await geo.json();
    if (g.status === 'success') {
      ipInfo = `${g.city}, ${g.regionName}, ${g.country} (${g.isp})`;
    }
  } catch {}

  const now  = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const icon = status === 'success' ? '✅' : '❌';

  const text = `${icon} <b>Givy Bypass — ${status === 'success' ? 'Berhasil' : 'Gagal'}</b>\n\n` +
    `<blockquote expandable>` +
    `🕐 <b>Waktu:</b> ${now}\n` +
    `🌐 <b>IP:</b> <code>${ip}</code>\n` +
    `📍 <b>Lokasi:</b> ${ipInfo}\n` +
    `🔗 <b>URL:</b> <code>${url}</code>\n` +
    `📦 <b>Hasil:</b> <code>${result}</code>` +
    `</blockquote>`;

  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

export default async function handler(req, res) {
  setHeaders(res);

  const host    = req.headers['host']    || '';
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  const sf      = req.headers['sec-fetch-site'] || '';
  const ALLOWED = process.env.ALLOWED_DOMAIN || host;

  if (req.method === 'GET' && req.query.action === 'init') {
    if (sf !== 'same-origin' && sf !== 'same-site' && sf !== '') return res.status(403).end();
    if (!domainOk(origin, ALLOWED) && !domainOk(referer, ALLOWED)) return res.status(403).end();

    const id  = rand(18);
    const sig = signSession(id);
    const val = `${id}.${sig}`;

    const csrf = rand(24);
    csrfStore.set(csrf, Date.now() + CSRF_TTL);
    for (const [k, exp] of csrfStore) { if (Date.now() > exp) csrfStore.delete(k); }

    res.setHeader('Set-Cookie', serialize(COOKIE, val, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/bypass',
      maxAge: 300,
    }));

    return res.status(200).json({ c: csrf });
  }

  if (req.method !== 'POST') return res.status(405).end();

  if (sf && sf !== 'same-origin' && sf !== 'same-site') return res.status(403).end();
  if (!domainOk(origin, ALLOWED) && !domainOk(referer, ALLOWED)) return res.status(403).end();

  const cookies = parse(req.headers['cookie'] || '');
  if (!verifySession(cookies[COOKIE])) return res.status(403).end();

  const { url, c: csrf } = req.body || {};
  if (!csrf) return res.status(401).end();
  const csrfExp = csrfStore.get(csrf);
  if (!csrfExp || Date.now() > csrfExp) { csrfStore.delete(csrf); return res.status(401).end(); }
  csrfStore.delete(csrf);

  const ip = getIP(req);
  if (!rateOk(ip)) return res.status(429).end();

  if (!url) return res.status(400).end();
  try { new URL(url); } catch { return res.status(400).end(); }

  const KEY = process.env.BYPASS_API_KEY || 'freeApikey';
  try {
    const up = await fetch(
      `https://anabot.my.id/api/tools/izenLOL?url=${encodeURIComponent(url)}&apikey=${KEY}`,
      { headers: { 'User-Agent': 'GivyBypassDelta/1.0' }, signal: AbortSignal.timeout(15000) }
    );
    if (!up.ok) {
      sendTelegram(ip, url, 'upstream error', 'failed');
      return res.status(502).json({ t: obfuscate({ ok: false, e: 'upstream' }) });
    }

    const d      = await up.json();
    const raw    = d.data?.result?.result ?? null;
    const status = d.data?.result?.status ?? '';
    const isFail = status === 'failed' || !d.success;

    if (isFail) {
      sendTelegram(ip, url, raw || 'failed', 'failed');
      return res.status(200).json({ t: obfuscate({ ok: false, e: raw || 'Bypass gagal.' }) });
    }

    sendTelegram(ip, url, raw, 'success');
    return res.status(200).json({ t: obfuscate({
      ok:     true,
      result: raw,
      time:   d.data?.result?.time ?? null,
    })});

  } catch (err) {
    sendTelegram(ip, url, err.name === 'TimeoutError' ? 'timeout' : 'server error', 'failed');
    if (err.name === 'TimeoutError') return res.status(504).json({ t: obfuscate({ ok: false, e: 'timeout' }) });
    return res.status(500).json({ t: obfuscate({ ok: false, e: 'err' }) });
  }
}

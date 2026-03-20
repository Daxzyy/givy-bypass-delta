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
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ips = xff.split(',').map(s => s.trim()).filter(s =>
      s && !s.startsWith('10.') && !s.startsWith('172.') &&
      !s.startsWith('192.168.') && s !== '127.0.0.1' && s !== '::1'
    );
    if (ips.length) return ips[0];
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
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

async function tgSend(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

async function tgSendMd(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

function row(label, value, w = 12) {
  return label.padEnd(w) + ': ' + value;
}

async function sendTelegram(ip, url, result, status, battery, di) {
  const token  = process.env.T_T;
  const chatId = process.env.T_C;
  if (!token || !chatId) return;

  let ipInfo = 'Unknown';
  let isp    = 'Unknown';
  try {
    const realIP = (ip || '').match(/^(::|(10|127)\.)/) ? '' : ip;
    if (realIP) {
      const geo = await fetch(`http://ip-api.com/json/${realIP}?fields=status,city,regionName,country,isp`, {
        signal: AbortSignal.timeout(4000),
      });
      const g = await geo.json();
      if (g.status === 'success') {
        ipInfo = `${g.city}, ${g.regionName}, ${g.country}`;
        isp    = g.isp;
      }
    }
  } catch {}

  const now  = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const icon = status === 'success' ? '✅' : '❌';
  const d    = di || {};

  const batLevel  = battery ? battery.split(' ')[0] : 'N/A';
  const batStatus = battery ? (battery.includes('Charging') && !battery.includes('Not') ? 'Charging' : 'Not Charging') : 'N/A';

  const msg1 =
    `${icon} <b>Givy Bypass — ${status === 'success' ? 'Berhasil' : 'Gagal'}</b>\n\n` +
    `<blockquote expandable>` +
    `🕐 <b>Waktu:</b> ${now}\n\n` +
    `🌐 <b>Network</b>\n` +
    `<code>` +
    `${row('IP', ip || 'N/A')}\n` +
    `${row('Lokasi', ipInfo)}\n` +
    `${row('ISP', isp)}\n` +
    `${row('Koneksi', d.conn || 'N/A')}` +
    `</code>\n\n` +
    `📱 <b>Device</b>\n` +
    `<code>` +
    `${row('Layar', d.screen || 'N/A')}\n` +
    `${row('Bahasa', d.lang || 'N/A')}\n` +
    `${row('Timezone', d.tz || 'N/A')}\n` +
    `${row('CPU Cores', String(d.cores || 'N/A'))}\n` +
    `${row('RAM', d.mem || 'N/A')}\n` +
    `${row('Touch', d.touch || 'N/A')}` +
    `</code>\n\n` +
    `🔋 <b>Battery</b>\n` +
    `<code>` +
    `${row('Level', batLevel)}\n` +
    `${row('Status', batStatus)}` +
    `</code>\n\n` +
    `🔗 <b>URL</b>\n` +
    `<code>${url}</code>` +
    `</blockquote>`;

  await tgSend(token, chatId, msg1);

  if (status === 'success' && result) {
    await tgSend(token, chatId, `<pre><code class="language-text">${String(result).trim()}</code></pre>`);
  }
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

  const { url, c: csrf, ip: clientIP, battery, deviceInfo } = req.body || {};
  if (!csrf) return res.status(401).end();
  const csrfExp = csrfStore.get(csrf);
  if (!csrfExp || Date.now() > csrfExp) { csrfStore.delete(csrf); return res.status(401).end(); }
  csrfStore.delete(csrf);

  const ip = (clientIP && clientIP !== 'unknown') ? clientIP : getIP(req);
  if (!rateOk(ip)) return res.status(429).end();

  if (!url) return res.status(400).end();
  try { new URL(url); } catch { return res.status(400).end(); }

  const KEY = process.env.BYPASS_API_KEY;
  try {
    const up = await fetch(
      `https://anabot.my.id/api/tools/izenLOL?url=${encodeURIComponent(url)}&apikey=${KEY}`,
      { headers: { 'User-Agent': 'GivyBypassDelta/1.0' }, signal: AbortSignal.timeout(15000) }
    );
    if (!up.ok) {
      await sendTelegram(ip, url, 'upstream error', 'failed', battery, deviceInfo);
      return res.status(502).json({ t: obfuscate({ ok: false, e: 'upstream' }) });
    }

    const d      = await up.json();
    const raw    = d.data?.result?.result ?? null;
    const status = d.data?.result?.status ?? '';
    const isFail = status === 'failed' || !d.success;

    if (isFail) {
      await sendTelegram(ip, url, raw || 'failed', 'failed', battery, deviceInfo);
      return res.status(200).json({ t: obfuscate({ ok: false, e: raw || 'Bypass gagal.' }) });
    }

    await sendTelegram(ip, url, raw, 'success', battery, deviceInfo);
    return res.status(200).json({ t: obfuscate({
      ok:     true,
      result: raw,
      time:   d.data?.result?.time ?? null,
    })});

  } catch (err) {
    await sendTelegram(ip, url, err.name === 'TimeoutError' ? 'timeout' : 'server error', 'failed', battery, deviceInfo);
    if (err.name === 'TimeoutError') return res.status(504).json({ t: obfuscate({ ok: false, e: 'timeout' }) });
    return res.status(500).json({ t: obfuscate({ ok: false, e: 'err' }) });
  }
}

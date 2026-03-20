// pages/api/bypass.js
// Proxy route — API key & endpoint tersembunyi di server
// Response di-obfuscate: di Network tab hanya kelihatan token acak
// Set BYPASS_API_KEY di Vercel Environment Variables

// ── Obfuscation helpers ──────────────────────────────────────
// Key acak per-request: XOR payload lalu base64, hasilnya beda tiap request
function makeKey(len = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let k = '';
  for (let i = 0; i < len; i++) k += chars[Math.floor(Math.random() * chars.length)];
  return k;
}

function xorEncode(str, key) {
  const buf = [];
  for (let i = 0; i < str.length; i++) {
    buf.push(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(buf).toString('base64url');
}

function obfuscate(payload) {
  const key  = makeKey(18);
  const data = xorEncode(JSON.stringify(payload), key);
  // Nonce acak di depan dan belakang biar makin tidak jelas
  const nonce = makeKey(8);
  const tail  = makeKey(6);
  // Format: nonce.key.data.tail  — key di-reverse biar tidak obvious
  return `${nonce}.${key.split('').reverse().join('')}.${data}.${tail}`;
}
// ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ t: obfuscate({ error: 'method' }) });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ t: obfuscate({ ok: false, e: 'missing_url' }) });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ t: obfuscate({ ok: false, e: 'invalid_url' }) });
  }

  const API_KEY = process.env.BYPASS_API_KEY || 'freeApikey';
  const BASE_URL = 'https://anabot.my.id/api/tools/izenLOL';

  try {
    const apiUrl = `${BASE_URL}?url=${encodeURIComponent(url)}&apikey=${API_KEY}`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'GivyBypassDelta/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(502).json({ t: obfuscate({ ok: false, e: `upstream_${response.status}` }) });
    }

    const data = await response.json();

    // Kirim hanya field yang perlu, bungkus dengan obfuscation
    const payload = {
      ok:     data.success === true,
      result: data.data?.result?.result ?? null,
      time:   data.data?.result?.time   ?? null,
    };

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    // Yang muncul di Network tab: { "t": "AbCdEfGh.kEyReVeRsEd.base64urlDATA.TaIlXx" }
    return res.status(200).json({ t: obfuscate(payload) });

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ t: obfuscate({ ok: false, e: 'timeout' }) });
    }
    return res.status(500).json({ t: obfuscate({ ok: false, e: 'server_error' }) });
  }
}

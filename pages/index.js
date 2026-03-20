import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, fail: 0 });
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [copied, setCopied] = useState(false);
  const [pasting, setPasting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('givy-history');
    if (saved) { try { setHistory(JSON.parse(saved)); } catch {} }
  }, []);

  function saveHistory(h) {
    localStorage.setItem('givy-history', JSON.stringify(h));
  }

  function showToast(msg) {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2300);
  }

  function decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length < 4) return null;
      const key   = parts[1].split('').reverse().join('');
      const bin   = atob(parts[2].replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      let str = '';
      for (let i = 0; i < bytes.length; i++)
        str += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
      return JSON.parse(str);
    } catch { return null; }
  }

  async function doBypass() {
    if (!url.trim()) { showToast('⚠ URL tidak boleh kosong'); return; }
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'auth.platorelay.com') {
        showToast('⚠ URL tidak valid');
        return;
      }
    } catch { showToast('⚠ URL tidak valid'); return; }

    setLoading(true);
    setResult(null);

    try {
      const initRes = await fetch('/api/bypass?action=init', { credentials: 'same-origin' });
      if (!initRes.ok) throw new Error('init_fail');
      const { c: csrf } = await initRes.json();

      let clientIP = 'unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
        const ipData = await ipRes.json();
        clientIP = ipData.ip || 'unknown';
      } catch {}

      let battery = 'N/A';
      try {
        if (navigator.getBattery) {
          const bat = await navigator.getBattery();
          battery = `${Math.round(bat.level * 100)}% ${bat.charging ? '⚡' : '🔋'}`;
        }
      } catch {}

      const res = await fetch('/api/bypass', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, c: csrf, ip: clientIP, battery }),
      });

      if (!res.ok) {
        const msg = res.status === 429 ? 'Terlalu banyak request, tunggu sebentar.'
                  : res.status === 403 ? 'Akses ditolak.'
                  : 'Server error ' + res.status;
        setResult({ ok: false, value: msg });
        setStats(s => ({ total: s.total + 1, success: s.success, fail: s.fail + 1 }));
        setLoading(false);
        return;
      }

      const raw  = await res.json();
      const data = raw.t ? decodeToken(raw.t) : null;

      if (data?.ok && data.result) {
        setResult({ ok: true, value: data.result, time: data.time || '?' });
        setHistory(h => {
          const next = [{ url, result: data.result, time: new Date().toLocaleTimeString() }, ...h].slice(0, 40);
          saveHistory(next);
          return next;
        });
        setStats(s => ({ total: s.total + 1, success: s.success + 1, fail: s.fail }));
      } else {
        const errMsg = data?.e
          ? (data.e.toLowerCase().includes('expired') ? 'Link sudah expired, ambil link baru.' :
             data.e.toLowerCase().includes('invalid') ? 'Link tidak valid.' :
             data.e)
          : 'Bypass gagal.';
        setResult({ ok: false, value: errMsg });
        setStats(s => ({ total: s.total + 1, success: s.success, fail: s.fail + 1 }));
      }
    } catch (e) {
      setResult({ ok: false, value: 'Koneksi gagal: ' + e.message });
      setStats(s => ({ total: s.total + 1, success: s.success, fail: s.fail + 1 }));
    }

    setLoading(false);
  }

  function copyResult() {
    if (!result?.value) return;
    navigator.clipboard.writeText(result.value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  async function pasteUrl() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setUrl(text.trim());
    } catch {
      showToast('⚠ Izin clipboard ditolak');
    }
  }

  return (
    <>
      <Head>
        <title>Givy Bypass</title>
        <meta name="description" content="Bypass link cepat, aman, dan gratis." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <link rel="icon" href="/delta.jpg" />
      </Head>

      <style>{`
        /* ── Variables ─────────────────────────────── */
        :root {
          --bg-primary:   #ffffff;
          --bg-secondary: #f8f8f8;
          --bg-card:      #ffffff;
          --text-primary:   #1a1a1a;
          --text-secondary: #4a4a4a;
          --text-muted:     #666666;
          --accent:         #000000;
          --accent-hover:   #333333;
          --border:         #e0e0e0;
          --border-light:   #f0f0f0;
          --success:        #10b981;
          --success-bg:     rgba(16,185,129,.1);
          --danger:         #ef4444;
          --danger-bg:      rgba(239,68,68,.1);
          --warning:        #f59e0b;
          --warning-bg:     rgba(245,158,11,.1);
          --shadow-sm: 0 2px 4px rgba(0,0,0,.05);
          --shadow-md: 0 4px 6px rgba(0,0,0,.1);
          --shadow-lg: 0 10px 15px rgba(0,0,0,.1);
        }

        /* ── Reset ──────────────────────────────────── */
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        *:focus{outline:none;}
        button,a{-webkit-tap-highlight-color:transparent;}
        html{scroll-behavior:smooth;}
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          line-height: 1.6;
        }

        /* ── Grid background ────────────────────────── */
        .bg-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(0,0,0,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,.08) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        /* ── Header ─────────────────────────────────── */
        .hdr {
          position: sticky; top: 0; z-index: 10;
          background: rgba(255,255,255,.9);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        .hdr-inner {
          max-width: 720px; margin: 0 auto;
          padding: .875rem 1.25rem;
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
        }
        .logo { display: flex; align-items: center; gap: .625rem; text-decoration: none; }
        .logo-img {
          width: 36px; height: 36px; border-radius: 9px;
          object-fit: cover; flex-shrink: 0;
          border: 1px solid var(--border);
        }
        .logo-text { font-size: 1.05rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
        .logo-sub  { font-size: .58rem; font-family: 'JetBrains Mono', monospace; color: var(--text-muted); letter-spacing: .08em; text-transform: uppercase; }
        .hdr-actions { display: flex; align-items: center; gap: .4rem; }
        .icon-btn {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-primary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: .85rem; transition: border-color .2s, background .2s;
        }
        .icon-btn:hover { border-color: var(--accent); background: var(--bg-secondary); }

        /* ── Main ───────────────────────────────────── */
        .main { max-width: 720px; margin: 0 auto; padding: 1.75rem 1.25rem 4rem; position: relative; z-index: 1; }

        /* ── Card base ──────────────────────────────── */
        .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 1.5rem;
          box-shadow: var(--shadow-lg);
          margin-bottom: .875rem;
        }
        .card-label {
          font-size: .62rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          color: var(--text-muted); font-family: 'JetBrains Mono', monospace;
          margin-bottom: .875rem; display: flex; align-items: center; gap: .4rem;
        }
        .card-label::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--text-muted); flex-shrink:0; }

        /* ── Input row ──────────────────────────────── */
        .inp-row { display: flex; gap: .625rem; margin-bottom: .875rem; }
        .inp-wrap { position: relative; flex: 1; min-width: 0; }
        .url-inp {
          width: 100%;
          background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
          padding: .7rem 2.5rem .7rem 1rem; color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace; font-size: .8rem; outline: none;
          transition: border-color .2s, box-shadow .2s;
        }
        .url-inp:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(0,0,0,.06); outline: none; }
        .url-inp::placeholder { color: var(--text-muted); }
        .paste-btn {
          position: absolute; right: .45rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; padding: .25rem;
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          border-radius: 6px; transition: color .2s, background .2s;
        }
        .paste-btn:hover { color: var(--accent); background: rgba(0,0,0,.05); }

        .bypass-btn {
          flex-shrink: 0;
          background: var(--accent); color: #fff;
          border: none; border-radius: 10px; padding: .7rem 1.2rem;
          font-family: 'Inter', sans-serif; font-size: .8rem; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase; cursor: pointer;
          display: flex; align-items: center; gap: .4rem;
          transition: background .2s, transform .15s, box-shadow .15s; white-space: nowrap;
        }
        .bypass-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); box-shadow: var(--shadow-md); }
        .bypass-btn:active:not(:disabled) { transform: scale(.97); }
        .bypass-btn:disabled { opacity: .45; cursor: not-allowed; }

        /* ── Result box ─────────────────────────────── */
        .result-box {
          border-radius: 10px; border: 1px solid var(--border); background: var(--bg-secondary);
          padding: .875rem 1rem; min-height: 56px; transition: border-color .25s, background .25s;
        }
        .result-box.ok  { border-color: rgba(16,185,129,.35); background: var(--success-bg); }
        .result-box.err { border-color: rgba(239,68,68,.35);  background: var(--danger-bg); }
        .result-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:.45rem; }
        .result-status {
          font-size:.6rem; letter-spacing:.1em; text-transform:uppercase;
          font-weight:700; color:var(--text-muted);
          display:flex; align-items:center; gap:.35rem; font-family:'JetBrains Mono',monospace;
        }
        .dot { width:6px; height:6px; border-radius:50%; background:var(--border); }
        .dot.ok  { background:var(--success); box-shadow:0 0 5px var(--success); }
        .dot.err { background:var(--danger);  box-shadow:0 0 5px var(--danger); }
        .dot.spin { background:var(--accent); animation:dotpulse .8s ease infinite; }
        .result-val  { color:var(--success); font-size:.85rem; font-weight:600; word-break:break-all; font-family:'JetBrains Mono',monospace; }
        .result-err  { color:var(--danger);  font-size:.8rem; font-family:'JetBrains Mono',monospace; }
        .result-empty{ color:var(--text-muted); font-size:.8rem; font-family:'JetBrains Mono',monospace; }
        .copy-btn {
          background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-secondary);
          padding: .2rem .6rem; border-radius: 6px;
          font-size:.6rem; font-family:'JetBrains Mono',monospace;
          font-weight:700; letter-spacing:.08em; text-transform:uppercase;
          cursor:pointer; transition:all .2s;
        }
        .copy-btn:hover { border-color:var(--accent); color:var(--accent); }

        /* ── Stats ──────────────────────────────────── */
        .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.625rem; margin-bottom:.875rem; }
        .stat-card {
          background:var(--bg-card); border:1px solid var(--border); border-radius:14px;
          padding:.875rem .75rem; text-align:center; box-shadow:var(--shadow-sm);
          transition:border-color .2s, box-shadow .2s, transform .2s;
        }
        .stat-card:hover { border-color:var(--accent); box-shadow:var(--shadow-md); transform:translateY(-2px); }
        .stat-num { font-family:'JetBrains Mono',monospace; font-size:1.5rem; font-weight:700; color:var(--text-primary); display:block; }
        .stat-lbl { font-size:.58rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--text-muted); margin-top:.2rem; }

        /* ── History ────────────────────────────────── */
        .section-card {
          background:var(--bg-card); border:1px solid var(--border); border-radius:20px;
          padding:1.25rem 1.5rem; box-shadow:var(--shadow-lg);
        }
        .sec-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:.875rem; }
        .hist-list { display:flex; flex-direction:column; gap:.4rem; max-height:300px; overflow-y:auto; }
        .hist-list::-webkit-scrollbar { width:3px; }
        .hist-list::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
        .hist-item {
          display:flex; flex-direction:column; gap:.25rem;
          background:var(--bg-secondary); border:1px solid var(--border-light);
          border-radius:8px; padding:.6rem .875rem; cursor:pointer;
          transition:border-color .2s, background .2s;
          -webkit-tap-highlight-color: transparent;
        }
        .hist-item:hover { border-color:var(--accent); background:#fff; }
        .hi-row  { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
        .hi-url  { font-family:'JetBrains Mono',monospace; font-size:.68rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
        .hi-res  { font-family:'JetBrains Mono',monospace; font-size:.7rem; color:var(--success); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; cursor:pointer; }
        .hi-res:hover { text-decoration:underline; text-underline-offset:2px; }
        .hi-time { font-size:.58rem; color:var(--text-muted); flex-shrink:0; }
        .empty-hist { text-align:center; padding:2rem; font-family:'JetBrains Mono',monospace; font-size:.72rem; color:var(--text-muted); }

        /* ── Sidebar ────────────────────────────────── */
        .sidebar {
          position:fixed; top:0; right:0; height:100%; width:235px; z-index:100;
          background:var(--bg-card); border-left:1px solid var(--border);
          display:flex; flex-direction:column;
          transition:transform .3s cubic-bezier(.4,0,.2,1);
          box-shadow: -4px 0 24px rgba(0,0,0,.08);
        }
        .sidebar-closed { transform:translateX(100%); }
        .sidebar-open   { transform:translateX(0); }
        .sb-top {
          padding:1.1rem 1.25rem .9rem; border-bottom:1px solid var(--border);
          display:flex; align-items:center; justify-content:space-between;
        }
        .sb-title { font-size:.82rem; font-weight:700; color:var(--text-primary); }
        .sb-body  { flex:1; overflow-y:auto; padding:.875rem; }
        .sb-sec-lbl {
          font-size:.58rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.1em; color:var(--text-muted); margin-bottom:.4rem; padding:0 .5rem;
        }
        .sb-link {
          display:flex; align-items:center; justify-content:space-between;
          padding:.45rem .75rem; border-radius:9px; font-size:.8rem;
          color:var(--text-muted); text-decoration:none; cursor:pointer;
          transition:background .15s,color .15s; margin-bottom:2px;
        }
        .sb-link:hover  { background:var(--bg-secondary); color:var(--text-primary); }
        .sb-link.active { background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border); }
        .sb-link.ext { justify-content:flex-start; gap:.35rem; }
        .overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:90;
          transition:opacity .3s,visibility .3s;
        }

        /* ── Footer ─────────────────────────────────── */
        footer {
          text-align:center; padding:1.1rem;
          border-top:1px solid var(--border);
          font-size:.62rem; font-weight:700; text-transform:uppercase;
          letter-spacing:.1em; color:var(--text-muted);
          position:relative; z-index:1;
        }

        /* ── Toast ──────────────────────────────────── */
        .toast-wrap { position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; align-items:center; gap:.4rem; pointer-events:none; }
        .toast {
          background:var(--accent); border:1px solid var(--accent);
          color:#fff; padding:.55rem 1rem; border-radius:100px;
          font-size:.75rem; font-weight:600; box-shadow:var(--shadow-lg);
          white-space:nowrap; animation:toastIn .3s ease both;
        }

        /* ── Animations ─────────────────────────────── */
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes dotpulse { 0%,100%{opacity:1}50%{opacity:.25} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn  { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        .anim-1 { animation:fadeUp .4s ease both; }
        .anim-2 { animation:fadeUp .4s .08s ease both; }
        .anim-3 { animation:fadeUp .4s .16s ease both; }
        .spin-anim { animation:spin .65s linear infinite; }

        /* ── Responsive ─────────────────────────────── */
        @media(max-width:520px){
          .inp-row{flex-direction:column;}
          .stat-num{font-size:1.2rem;}
          .sidebar{width:220px;}
        }
        @media(min-width:768px){
          .sidebar{transform:translateX(0)!important;}
        }

        /* ── Scrollbar ──────────────────────────────── */
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:var(--bg-secondary);}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:var(--text-muted);}
`}</style>

      <div className="bg-grid" />

      <header className="hdr">
        <div className="hdr-inner">
          <a className="logo" href="/">
            <img src="/delta.jpg" alt="Delta" className="logo-img" />
            <div>
              <div className="logo-text">Givy Bypass</div>
              <div className="logo-sub">v2.0</div>
            </div>
          </a>
          <div className="hdr-actions">
            <button className="icon-btn" onClick={() => setSidebarOpen(true)} title="Menu">
              <i className="fa-solid fa-bars" />
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="card anim-1">
          <div className="card-label">Bypass URL</div>
          <div className="inp-row">
            <div className="inp-wrap">
              <input
                ref={inputRef}
                className="url-inp"
                type="url"
                placeholder="https://auth.platorelay.com/a?d=..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doBypass()}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="paste-btn" onClick={pasteUrl} title="Paste">
                <span className="material-icons" style={{fontSize:'17px'}}>content_paste</span>
              </button>
            </div>
            <button className="bypass-btn" onClick={doBypass} disabled={loading}>
              <i className={`fa-solid ${loading ? 'fa-spinner spin-anim' : 'fa-bolt'}`} />
              <span>{loading ? 'Loading...' : 'Bypass'}</span>
            </button>
          </div>

          <div className={`result-box${result ? (result.ok ? ' ok' : ' err') : ''}`}>
            <div className="result-hdr">
              <div className="result-status">
                <span className={`dot${loading ? ' spin' : result ? (result.ok ? ' ok' : ' err') : ''}`} />
                <span>
                  {loading ? 'Processing...' : result ? (result.ok ? `Success · ${result.time}s` : 'Error') : 'Waiting'}
                </span>
              </div>
              {result?.ok && (
                <button className="copy-btn" onClick={copyResult}>
                  <span className="material-icons" style={{fontSize:'14px',verticalAlign:'middle',marginRight:'3px'}}>{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            {loading ? (
              <span className="result-empty">Memproses...</span>
            ) : result ? (
              result.ok
                ? <div className="result-val">{result.value}</div>
                : <div className="result-err">{result.value}</div>
            ) : (
              <span className="result-empty">Masukkan URL lalu klik Bypass...</span>
            )}
          </div>
        </div>

        <div className="stats-grid anim-2">
          {[['Total', stats.total], ['Success', stats.success], ['Failed', stats.fail]].map(([lbl, val]) => (
            <div className="stat-card" key={lbl}>
              <span className="stat-num">{val}</span>
              <div className="stat-lbl">{lbl}</div>
            </div>
          ))}
        </div>

        <div className="section-card anim-3">
          <div className="sec-hdr">
            <div className="card-label" style={{ margin: 0 }}>History</div>
            <button className="copy-btn" onClick={() => { setHistory([]); localStorage.removeItem('givy-history'); showToast('History dihapus'); }}>Clear</button>
          </div>
          <div className="hist-list">
            {history.length === 0
              ? <div className="empty-hist">Belum ada history...</div>
              : history.map((h, i) => (
                <div className="hist-item" key={i} onClick={() => setUrl(h.url)}>
                  <div className="hi-row">
                    <span className="hi-url">{h.url}</span>
                    <span className="hi-time">{h.time}</span>
                  </div>
                  <span className="hi-res" onClick={e => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(h.result).then(() => showToast('✓ Tersalin!'));
                  }} title="Klik untuk copy">{h.result}</span>
                </div>
              ))
            }
          </div>
        </div>
      </main>

      <footer>© 2026 Givy Bypass</footer>

      {sidebarOpen && (
        <div className="overlay" style={{ opacity: 1, visibility: 'visible' }} onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sb-top">
          <span className="sb-title">#GivyBypass</span>
          <button className="icon-btn" style={{ border: 'none', background: 'none', width: 28, height: 28 }} onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="sb-body">
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="sb-sec-lbl">Dashboard</div>
            <a className="sb-link active" href="/">
              Home <i className="fa-solid fa-chevron-left fa-xs" />
            </a>
          </div>
          <div>
            <div className="sb-sec-lbl">Social</div>
            <a className="sb-link ext" href="https://tiktok.com/@_yudxx" target="_blank" rel="noopener noreferrer">
              <span className="material-icons" style={{fontSize:'14px'}}>open_in_new</span>TikTok @givy
            </a>
          </div>
        </div>
      </aside>

      <div className="toast-wrap">
        {toasts.map(t => <div className="toast" key={t.id}>{t.msg}</div>)}
      </div>
    </>
  );
}

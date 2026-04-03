// pages/xnxx.js
import Head from 'next/head';

export default function Prank() {
  return (
    <>
      <Head>
        <title>XNXX.COM - Free Porn, Sex, Tube Videos...</title>
        <meta name="robots" content="noindex" />
      </Head>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#1a1a2e; font-family: Arial, sans-serif; min-height:100vh; }

        .topbar {
          background:#00a8e0;
          padding:.5rem 1rem;
          display:flex; align-items:center; gap:1rem;
        }
        .logo {
          font-size:1.6rem; font-weight:900; color:#fff;
          background:#f60; padding:.1rem .5rem; border-radius:4px;
          letter-spacing:-1px;
        }
        .search-bar {
          flex:1; max-width:500px;
          display:flex; gap:.3rem;
        }
        .search-bar input {
          flex:1; padding:.45rem .75rem; border-radius:4px;
          border:none; font-size:.85rem; background:#fff;
          color:#999;
        }
        .search-bar button {
          background:#f60; color:#fff; border:none;
          padding:.45rem .9rem; border-radius:4px; cursor:pointer;
          font-weight:700; font-size:.85rem;
        }

        .nav {
          background:#111;
          display:flex; gap:0; overflow-x:auto;
          border-bottom:2px solid #f60;
        }
        .nav a {
          color:#ccc; text-decoration:none;
          padding:.5rem .9rem; font-size:.78rem; white-space:nowrap;
          transition:background .15s;
        }
        .nav a:hover { background:#222; color:#fff; }

        .grid {
          display:grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap:1rem; padding:1.5rem;
          max-width:1100px; margin:0 auto;
        }
        .thumb {
          background:#111; border-radius:6px; overflow:hidden;
          cursor:pointer; border:1px solid #222;
          transition:transform .2s, border-color .2s;
        }
        .thumb:hover { transform:translateY(-3px); border-color:#f60; }
        .thumb-img {
          width:100%; aspect-ratio:16/9;
          background:#0d0d2b;
          display:flex; align-items:center; justify-content:center;
          font-size:2.5rem;
        }
        .thumb-info { padding:.5rem .6rem; }
        .thumb-title { font-size:.72rem; color:#ddd; font-weight:600; line-height:1.3; margin-bottom:.3rem; }
        .thumb-meta  { font-size:.62rem; color:#888; }

        /* PRANK OVERLAY */
        .overlay {
          position:fixed; inset:0; z-index:9999;
          background:rgba(0,0,0,.85);
          display:flex; align-items:center; justify-content:center;
          backdrop-filter:blur(6px);
          animation:fadeIn .3s ease;
        }
        .prank-box {
          background:#fff; border-radius:16px;
          padding:2.5rem 3rem; text-align:center;
          max-width:360px; width:90%;
          animation:pop .4s cubic-bezier(.34,1.56,.64,1) both;
          box-shadow:0 20px 60px rgba(0,168,224,.4);
        }
        .prank-emoji { font-size:5rem; }
        .prank-text  { font-size:1.9rem; font-weight:900; color:#111; margin:.6rem 0 .3rem; }
        .prank-sub   { font-size:.95rem; color:#555; }
        .prank-btn {
          margin-top:1.2rem;
          background:#00a8e0; color:#fff; border:none;
          padding:.6rem 1.5rem; border-radius:8px;
          font-size:.9rem; font-weight:700; cursor:pointer;
        }
        .prank-btn:hover { background:#0090c0; }

        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pop {
          from { transform:scale(.4); opacity:0; }
          to   { transform:scale(1);  opacity:1; }
        }
      `}</style>

      {/* Fake UI di belakang */}
      <div className="topbar">
        <div className="logo">XNXX</div>
        <div className="search-bar">
          <input readOnly placeholder="Search..." />
          <button>Search</button>
        </div>
      </div>
      <nav className="nav">
        {['Home','Straight','Gay','Trans','Categories','Channels','Pornstars','Community'].map(n => (
          <a key={n} href="#">{n}</a>
        ))}
      </nav>
      <div className="grid">
        {Array.from({length:12}).map((_,i) => (
          <div className="thumb" key={i}>
            <div className="thumb-img">🔒</div>
            <div className="thumb-info">
              <div className="thumb-title">Loading...</div>
              <div className="thumb-meta">??? views · ??:??</div>
            </div>
          </div>
        ))}
      </div>

      {/* Prank overlay muncul langsung */}
      <div className="overlay">
        <div className="prank-box">
          <div className="prank-emoji">🤭</div>
          <div className="prank-text">HAYOO KETAUAN LU AOWKWKWWKWK😹</div>
          <div className="prank-sub">ngapain lu kocak?😈<br/>mw c0li kah?🤭😈</div>
          <button className="prank-btn" onClick={() => window.history.back()}>
            Ku bilangin mamah nanti🤭
          </button>
        </div>
      </div>
    </>
  );
}

# Givy Bypass Delta

Web bypass link dengan proxy API route — API key tersembunyi di server.

## Struktur
```
givy-bypass/
├── pages/
│   ├── index.js          ← Frontend (React/Next.js)
│   └── api/
│       └── bypass.js     ← Proxy route (API key di sini)
├── package.json
├── vercel.json
└── next.config.js
```

## Deploy ke Vercel

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "init givy bypass delta"
git remote add origin https://github.com/USERNAME/givy-bypass.git
git push -u origin main
```

### 2. Import di Vercel
- Buka https://vercel.com/new
- Import repo GitHub kamu
- Framework: **Next.js** (auto-detect)
- Klik **Deploy**

### 3. Set Environment Variable
Di Vercel dashboard → Project → Settings → Environment Variables:
```
BYPASS_API_KEY = freeApikey
```
> Kalau nanti punya API key berbayar, ganti di sini tanpa ubah kode.

### 4. Done!
Akses di `https://namaproject.vercel.app`

## Cara kerja proxy
```
Browser → /api/bypass?url=... → server Vercel → anabot.my.id (dengan API key)
                                                       ↓
Browser ← hasil bypass ←──────────────────────────────
```
User yang buka Network tab hanya lihat domain Vercel kamu, bukan `anabot.my.id`.

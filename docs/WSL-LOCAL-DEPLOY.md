# Deploy Lokal via WSL (Ubuntu)

Dokumen ini menjelaskan cara menjalankan aplikasi secara lokal di WSL, termasuk API server dan front-end Vite, sampai siap dipakai seperti server lokal.

## Prasyarat
- WSL2 sudah terpasang (disarankan Ubuntu 22.04+).
- Node.js 18+ (disarankan via nvm).
- Akses ke database MySQL yang dipakai API (lihat `.env`).

## 1) Masuk ke WSL dan install Node.js
```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node -v
npm -v
```

## 2) Masuk ke folder proyek
Jika repo ada di Windows, WSL bisa mengaksesnya via `/mnt/c`.
```bash
cd /mnt/c/Pop\ Maker
```

## 3) Konfigurasi environment
```bash
cp .env.example .env
```
Edit `.env` dan sesuaikan koneksi database serta `JWT_SECRET`. Contoh:
```env
DB_HOST=192.168.1.198
DB_NAME=pos_db
DB_USER=pos
DB_PASSWORD=your_password_here
AUTH_DB_HOST=192.168.1.198
AUTH_DB_NAME=auth_db
AUTH_DB_USER=pos
AUTH_DB_PASSWORD=your_password_here
JWT_SECRET=change_this_secret
API_PORT=5050
UPLOAD_PIN=12345
```

Catatan:
- Pastikan MySQL bisa diakses dari WSL (IP/port terbuka).
- Jika hanya butuh UI tanpa API, API bisa tidak dijalankan, tapi fitur login/produk akan gagal.

## 4) Install dependencies
```bash
npm install
```

## 5) Jalankan API server (terminal 1)
```bash
npm run dev:server
```
API default di `http://localhost:5050`.

## 6) Jalankan front-end Vite (terminal 2)
```bash
npm run dev -- --host 0.0.0.0 --port 5173
```
Akses dari Windows: `http://localhost:5173`.

## 7) Mode build + preview (lebih mirip server lokal)
Gunakan ini jika ingin menjalankan UI dari hasil build statis.
```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```
Preview di `http://localhost:4173`.

## 8) Verifikasi cepat
```bash
# Cek API
curl http://localhost:5050/api/health

# Cek UI (harus tampil HTML Vite)
curl http://localhost:5173
```

## 9) Menjalankan sebagai service (opsional)
Jika WSL sudah mendukung systemd, kamu bisa membuat service agar API berjalan otomatis.

1) Buat file service:
```bash
sudo nano /etc/systemd/system/popmaker-api.service
```

2) Isi file:
```ini
[Unit]
Description=Pop Maker API
After=network.target

[Service]
Type=simple
WorkingDirectory=/mnt/c/Pop Maker
Environment=NODE_ENV=production
ExecStart=/usr/bin/env npm run dev:server
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

3) Aktifkan service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable popmaker-api
sudo systemctl start popmaker-api
sudo systemctl status popmaker-api --no-pager
```

Catatan:
- Jika systemd belum aktif di WSL, aktifkan di `/etc/wsl.conf` lalu restart WSL.
- UI tetap dijalankan terpisah (gunakan `npm run preview` atau `npm run dev`).

## Troubleshooting singkat
- Port bentrok: ganti `API_PORT` di `.env` atau `--port` Vite/preview.
- MySQL tidak bisa diakses: cek firewall, user, host, dan port database.
- Performa akses file Windows lambat: pertimbangkan clone repo langsung di filesystem WSL.

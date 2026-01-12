# Push Project ke GitHub

Dokumen ini menjelaskan cara menyiapkan repo Git dan push project ke GitHub.

## Prasyarat
- Akun GitHub.
- Git terpasang di Windows atau WSL.
- Akses ke folder project.

## 1) Cek status repo
```bash
git status
```
Jika belum ada repo:
```bash
git init
```

## 2) Buat repository di GitHub
1. Buka https://github.com/new
2. Isi nama repo (contoh: `pop-maker`).
3. Pilih visibility (private/public).
4. Jangan centang "Initialize this repository with a README" jika repo lokal sudah ada.
5. Klik **Create repository**.

## 3) Tambahkan remote
```bash
git remote add origin https://github.com/<username>/<repo>.git
git remote -v
```

Jika remote sudah ada dan mau diganti:
```bash
git remote set-url origin https://github.com/<username>/<repo>.git
```

## 4) Pastikan file sensitif tidak ikut ter-commit
Periksa `.gitignore`. Pastikan file berikut tidak ikut:
```
.env
node_modules
dist
server/uploads
```

## 5) Commit dan push
```bash
git add -A
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

## 6) Autentikasi GitHub
Jika diminta login:
- Gunakan Personal Access Token (PAT) sebagai password.
- Atau gunakan GitHub CLI:
```bash
gh auth login
```

## Catatan
- File `.env` berisi kredensial, jangan pernah di-push.
- Untuk file besar, pertimbangkan Git LFS jika diperlukan.

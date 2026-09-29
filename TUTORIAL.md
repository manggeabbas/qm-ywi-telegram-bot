# 📘 Tutorial Lengkap QM-YWI Telegram Bot

Panduan lengkap penggunaan dan penerapan **QM-YWI Telegram Form Generator Bot**
(Department of Quality Management — Divisi QM-YWI).

> Motto: *"Periksa dengan teliti, Pastikan Sempurna!"*

---

## Daftar Isi

1. [Pendahuluan](#1-pendahuluan)
2. [Fitur Utama](#2-fitur-utama)
3. [Kebutuhan Sistem](#3-kebutuhan-sistem)
4. [Instalasi](#4-instalasi)
5. [Konfigurasi Environment](#5-konfigurasi-environment)
6. [Menjalankan Bot](#6-menjalankan-bot)
7. [Alur Access Control (Pengguna Baru)](#7-alur-access-control-pengguna-baru)
8. [Tutorial Owner / Administrator](#8-tutorial-owner--administrator)
9. [Tutorial Pengguna — Form Generator](#9-tutorial-pengguna--form-generator)
10. [Contoh Alur Lengkap](#10-contoh-alur-lengkap)
11. [Format Output Mandarin](#11-format-output-mandarin)
12. [Database, Backup & Maintenance](#12-database-backup--maintenance)
13. [Deployment (Produksi)](#13-deployment-produksi)
14. [Keamanan](#14-keamanan)
15. [Testing & Typecheck](#15-testing--typecheck)
16. [Troubleshooting / FAQ](#16-troubleshooting--faq)
17. [Referensi Perintah](#17-referensi-perintah)
18. [Update Bot via Git](#18-update-bot-via-git)

---

## 1. Pendahuluan

Bot Telegram ini membantu inspector/operator QM-YWI membuat data gulungan baru
secara bertahap, konsisten, dan cepat, serta meminimalkan kesalahan penomoran
dan penentuan material.

Bot memiliki **dua bagian utama**:

1. **Access Control** — hanya pengguna dengan token undangan yang boleh masuk,
   wajib registrasi dengan NIK karyawan, dan memiliki status akses
   (`NEW`, `REGISTRATION`, `ACTIVE`, `BLOCKED`).
2. **Form Generator** — alur pembuatan form gulungan (FT/FJ), deteksi material,
   penomoran `HAxx`, input inspeksi per coil, dan output teks Mandarin.

---

## 2. Fitur Utama

- 🔐 **Access control berbasis status** dengan access guard terpusat.
- 🎟 **Invite token** acak, aman, sekali pakai, disimpan sebagai **hash SHA-256**.
- 👔 **Direktori karyawan** (NIK → NAMA): user cukup memasukkan NIK, nama otomatis terisi.
- 🛠 **Panel admin/owner** (`/admin`): token, pengguna, dan data karyawan.
- 🧪 **Form Generator**:
  - Deteksi material otomatis: `Z → S30400`, `K → S30403`, `G → S31603`.
  - Penomoran `HAxx` dengan validasi ketat (anti `HA110`).
  - Aturan diameter mesin `FT` dan `FJ`.
  - Grade `A1/B/B1/R/S`, main defect, remark, panjang.
  - Preview & edit interaktif sebelum output.
- 🈶 **Output Mandarin workplace** siap salin.
- ♻️ **Idempotensi** `update_id` (anti proses ganda).
- 💾 **Persistence SQLite** bawaan Node — data tetap ada setelah restart.

---

## 3. Kebutuhan Sistem

| Kebutuhan | Keterangan |
|---|---|
| Node.js | **v22.5 atau lebih baru** (wajib; memakai `node:sqlite`). Diuji di v26. |
| npm | Mengikuti instalasi Node.js |
| Token Bot | Dari [@BotFather](https://t.me/BotFather) |
| Telegram User ID Owner | Untuk fitur `/admin` |
| (Opsional) Domain + HTTPS | Untuk mode webhook produksi |

> Cek versi: `node --version` harus ≥ `v22.5.0`.

---

## 4. Instalasi

```bash
# 1. Masuk ke direktori project
cd qm-ywi-bot

# 2. Install dependensi
npm install

# 3. Salin contoh konfigurasi
cp .env.example .env

# 4. Edit .env (lihat bagian berikutnya)
nano .env
```

Struktur project:

```text
src/
├── config.js         # Konfigurasi environment & konstanta
├── logger.js         # Logger aman (menyensor token/secret)
├── db.js             # Koneksi & schema SQLite + transaksi
├── users.js          # Repository user, status, masking NIK
├── employees.js      # Direktori karyawan (NIK -> NAMA)
├── invites.js        # Invite token: generate, hash, redeem atomic
├── registration.js   # Alur registrasi (NIK -> nama otomatis -> konfirmasi)
├── access.js         # Access guard (NEW/REGISTRATION/ACTIVE/BLOCKED)
├── admin.js          # Panel owner: token, pengguna, data karyawan
├── menu.js           # Menu utama
├── texts.js          # Kumpulan teks pesan
├── material.js       # Mapping Z/K/G
├── numbering.js      # Parsing coil & generator nomor HAxx
├── diameter.js       # Aturan diameter FT & FJ
├── validation.js     # Validasi input
├── form.js           # Output Mandarin & preview
├── state.js          # Sesi Form Generator & cache idempotensi
├── wizard.js         # Alur Form Generator
└── bot.js            # Router bot, access guard, webhook/polling
```

---

## 5. Konfigurasi Environment

Edit file `.env`:

```env
# ===== Wajib =====
# Token bot dari @BotFather (JANGAN di-hard-code / di-commit)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ

# Telegram User ID owner/admin (hanya ID ini yang bisa /admin)
# Bisa lebih dari satu, pisahkan dengan koma: 11111111,22222222
OWNER_TELEGRAM_ID=123456789

# ===== Mode Bot =====
# 'polling' untuk lokal/testing, 'webhook' untuk produksi
BOT_MODE=polling

# ===== Persistence =====
# Lokasi database SQLite (folder dibuat otomatis)
DB_PATH=./data/qmywi.sqlite

# Masa berlaku default token undangan (hari), 0 = tidak expired
DEFAULT_TOKEN_TTL_DAYS=0

# ===== Webhook (hanya jika BOT_MODE=webhook) =====
PORT=3000
HOST=0.0.0.0
WEBHOOK_URL=https://domain-anda.com/webhook
WEBHOOK_SECRET_TOKEN=random_string_rahasia
```

**Cara mengetahui Telegram User ID owner:** kirim pesan ke
[@userinfobot](https://t.me/userinfobot) atau bot sejenis; salin `Id` yang ditampilkan.

> ⚠️ `TELEGRAM_BOT_TOKEN` dan `OWNER_TELEGRAM_ID` **tidak boleh** di-hard-code.
> File `.env` sudah di-ignore oleh Git.

---

## 6. Menjalankan Bot

### Mode Polling (lokal/testing)

```bash
npm start
# atau auto-reload saat development
npm run dev
```

Bot akan mengambil update langsung dari Telegram (cocok untuk uji coba).
Pastikan **tidak ada webhook aktif** (lihat Troubleshooting).

### Mode Webhook (produksi)

```bash
# Set di .env:
# BOT_MODE=webhook
# WEBHOOK_URL=https://domain-anda.com/webhook
# WEBHOOK_SECRET_TOKEN=...
npm start
```

Saat start, bot otomatis memanggil `setWebhook` ke `WEBHOOK_URL`.
Endpoint yang tersedia:

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/health` atau `/` | Health check (JSON) |
| `POST` | `/webhook` atau `/` | Menerima update Telegram |

Health check:

```bash
curl http://localhost:3000/health
# {"status":"ok","department":"Department of Quality Management","division":"QM-YWI","version":"2.1"}
```

---

## 7. Alur Access Control (Pengguna Baru)

```text
/start
   ↓
Cek Telegram User ID
   ↓
Belum terdaftar (NEW)
   ↓
Minta TOKEN UNDANGAN  →  "🔐 Akses Terbatas ..."
   ↓
Token valid (langsung diikat ke Telegram User ID, sekali pakai)
   ↓
REGISTRATION
   ↓
Input NIK (8 digit)
   ↓
NIK dicari di Data Karyawan
   ├─ tidak ada → "❌ NIK tidak terdaftar pada data karyawan..."
   └─ ada       → NAMA otomatis terisi
   ↓
Preview & konfirmasi data  [ ✅ Benar ] [ ✏️ Ubah NIK ]
   ↓
Status ACTIVE
   ↓
Menu utama / Form Generator
```

**Status user:**

| Status | Hak akses |
|---|---|
| `NEW` | Hanya boleh memasukkan token undangan |
| `REGISTRATION` | Hanya boleh menyelesaikan registrasi |
| `ACTIVE` | Seluruh fitur bot (Form Generator, dll.) |
| `BLOCKED` | Ditolak sepenuhnya |

**Perilaku `/start`:**

- Belum terdaftar (`NEW`): menampilkan permintaan token.
- `REGISTRATION`: melanjutkan registrasi dari langkah terakhir (tidak minta token ulang).
- `ACTIVE`: langsung menampilkan menu utama.
- `BLOCKED`: `"🚫 Akses Ditolak ..."`.

> Penting: user `NEW` **tidak bisa** mengakses `/new`, `/material`, `/example`,
> `/help`, atau tombol lama. Guard memblokir semua sebelum fitur dijalankan.

---

## 8. Tutorial Owner / Administrator

Owner adalah Telegram User ID yang tercantum di `OWNER_TELEGRAM_ID`.

### 8.1 Membuka Panel Admin

Kirim:

```text
/admin
```

Jika bukan owner:

```text
🚫 Anda tidak memiliki akses administrator.
```

Jika owner, muncul **Panel Administrator**:

```text
🛠 PANEL ADMINISTRATOR QM-YWI

[ 🎟 Buat Token ]  [ 📋 Daftar Token ]
[ 👥 Daftar Pengguna ]
[ 👔 Data Karyawan ]
```

---

### 8.2 👔 Data Karyawan (WAJIB diisi lebih dulu)

Data ini yang dipakai bot untuk mengenali NAMA saat user memasukkan NIK.

Menu: **👔 Data Karyawan**

```text
👔 DATA KARYAWAN
Total karyawan terdaftar: 0
[ ➕ Tambah Karyawan ]
[ 📋 Daftar Karyawan ]
[ 🗑 Hapus Karyawan ]
```

#### a. Tambah massal (bulk)

Pilih **➕ Tambah Karyawan**, lalu kirim satu karyawan per baris:

```text
12345678,Budi Santoso
87654321,Siti Aminah
11223344,Andi Wijaya
```

Pemisah yang didukung: koma `,`, titik-koma `;`, tab, atau spasi.
Bot membalas:

```text
✅ Impor data karyawan selesai.
Ditambahkan: 3
Diperbarui: 0
Gagal: 0

Total karyawan sekarang: 3
```

- NIK yang sudah ada akan **diperbarui** namanya (upsert) — berguna untuk koreksi typo.
- Baris tidak valid dilaporkan di bagian **Gagal**.
- NIK harus **8 digit angka**; nama 2–100 karakter.

#### b. Tambah satu-satu

Cukup kirim satu baris: `12345678,Budi Santoso`.

#### c. Daftar Karyawan

Menampilkan seluruh data:

```text
👔 DAFTAR KARYAWAN (3 total)

1. 11223344 — Andi Wijaya
2. 12345678 — Budi Santoso
3. 87654321 — Siti Aminah
```

#### d. Hapus Karyawan

Pilih **🗑 Hapus Karyawan**, kirim NIK 8 digit. Bot membalas konfirmasi.

---

### 8.3 🎟 Buat Token Undangan

1. Pilih **🎟 Buat Token**.
2. Bot: *"Berapa token yang ingin dibuat?"* → kirim angka, mis. `5` (maks 50).
3. Pilih masa berlaku:

   ```text
   [ 7 Hari ]  [ 30 Hari ]
   [ Tidak Expired ]
   ```

4. Bot menampilkan token (hanya sekali):

   ```text
   ✅ Berhasil membuat 5 token undangan
   Masa berlaku: Tidak Expired

   QMYWI-7K9P-X4M2-AB3C
   QMYWI-82LM-P7QX-9TZN
   QMYWI-K4R8-T2ZN-5Q2A
   QMYWI-9Q2A-L7XM-P8KD
   QMYWI-P8KD-3X4M-7K9P
   ```

   > ⚠️ Simpan sekarang. Token tidak disimpan dalam bentuk asli (hanya hash),
   > jadi **tidak bisa ditampilkan lagi**.

Setiap token **hanya dapat digunakan satu kali**. Bagikan satu token per orang.

---

### 8.4 📋 Daftar Token

Menampilkan id, status (`AVAILABLE`/`USED`/`EXPIRED`/`REVOKED`), waktu dibuat,
expiry, dan siapa yang memakainya. Token asli tidak ditampilkan (hanya hash).

---

### 8.5 👥 Daftar Pengguna & Detail

```text
👥 DAFTAR PENGGUNA

1. Budi Santoso
   NIK: ********
   Status: ACTIVE
```

NIK **disamarkan**. Tombol per pengguna membuka **detail**:

```text
👤 DETAIL PENGGUNA
Nama: Budi Santoso
Username: @budi
Telegram ID: 900002
NIK: ********
Status: ACTIVE
Diundang: 2026-09-29 05:20 UTC
Terdaftar: 2026-09-29 05:22 UTC

[ 🚫 Blokir ]
[ ⬅️ Kembali ]
```

---

### 8.6 🚫 Blokir & ✅ Aktifkan Kembali

- Tekan **🚫 Blokir** → status menjadi `BLOCKED`. User langsung kehilangan akses;
  setiap pesan dijawab `"🚫 Akses Ditolak ..."`.
- Tekan **✅ Aktifkan Kembali** pada user `BLOCKED` → status kembali `ACTIVE`
  (bila registrasi sudah selesai), atau `REGISTRATION` bila data diri belum lengkap.

---

## 9. Tutorial Pengguna — Form Generator

Fitur ini hanya untuk user `ACTIVE`. Mulai dengan `/new` atau tombol
**🚀 Mulai Buat Form**.

### Langkah 1 — Pilih Mesin

```text
[ FT ]  [ FJ ]
```
- `FT`: default `目前内径: 610`, opsi ubah ke `508`.
- `FJ`: pilih diameter `610` atau `508`.

### Langkah 2 — Nomor Gulungan Asal

Kirim nomor coil asal, contoh:

```text
QH2608K2531HA10
```

Bot mendeteksi material otomatis:
- `Z → S30400`
- `K → S30403`
- `G → S31603`
- kode lain ditolak (bot tidak menebak).

Lalu tekan **Lanjut** atau **Ubah Nomor Gulungan**.

### Langkah 3 — Spesifikasi

```text
1.24*1524
```

### Langkah 4 — Jumlah & Digit Awal HA

- Jumlah gulungan, mis. `3`.
- Digit awal suffix `HA` (`0–9`), mis. `1`.

Aturan: `digit awal + jumlah - 1 ≤ 9` (mencegah `HA110`).

### Langkah 5 — Preview Penomoran

```text
Nomor gulungan yang akan dibuat:

1. QH2608K2531HA11
2. QH2608K2531HA12
3. QH2608K2531HA13

Material: S30403
```

Tekan **Konfirmasi**, **Edit Penomoran**, atau **Batal**.

### Langkah 6 — Data Per Coil

Untuk setiap coil:
1. **Grade**: `A1`, `B`, `B1`, `R`, `S`.
2. **Cacat Utama (Main Defect)**: mis. `B22`, `R20`, `D02`, `C13`.
3. **Remark**: ketik `-` atau tombol **Tanpa Remark (-)**.
4. **Panjang** (meter): mis. `955`.
5. **Diameter**: sesuai mesin FT/FJ.

Bot otomatis lanjut ke coil berikutnya.

### Langkah 7 — Preview Final & Generate

Setelah semua coil selesai, muncul **PREVIEW DATA INSPEKSI**. Opsi:
- **✅ Konfirmasi & Generate Output**
- **✏️ Edit Nomor**
- **✏️ Edit Spesifikasi**
- **✏️ Edit Data Coil** (Grade/Cacat/Remark/Panjang/Diameter)
- **❌ Batal**

Setelah konfirmasi, bot mengirim blok teks Mandarin siap salin.

### Membatalkan

Kirim `/cancel` kapan saja untuk membatalkan sesi Form Generator.

---

## 10. Contoh Alur Lengkap

**Owner:**
```text
/admin → 👔 Data Karyawan → ➕ Tambah Karyawan
12345678,Budi Santoso
```
```text
/admin → 🎟 Buat Token → 1 → Tidak Expired
QMYWI-7K9P-X4M2-AB3C
```

**Karyawan baru (Telegram):**
```text
/start
🔐 Akses Terbatas ... Silakan masukkan token undangan Anda.
QMYWI-7K9P-X4M2-AB3C
✅ Token valid. ...
📝 REGISTRASI PENGGUNA ... Silakan masukkan NIK.
12345678
📋 KONFIRMASI DATA
NAMA : Budi Santoso
NIK  : 12345678
[ ✅ Benar ]
✅ Registrasi berhasil. ... Akun Anda sekarang aktif.
```

**Lalu buat form:**
```text
/new → FT → QH2608K2531HA10 → Lanjut → 1.24*1524 → 3 → 1
→ Konfirmasi → A1/B22/Tanpa Remark/955/Tidak Perlu (ulang per coil)
→ ✅ Konfirmasi & Generate Output
```

---

## 11. Format Output Mandarin

```text
机组：FT
QH2608K2531HA10
要生成新卷号

QH2608K2531HA11
S30403
1.24*1524
等级: A1
主缺陷: B22
备注: -
目前内径: 610
是否需改内径: Tidak Perlu
长度: 955米

QH2608K2531HA12
S30403
1.24*1524
等级: S
主缺陷: C13
备注: -
目前内径: 610
是否需改内径: Tidak Perlu
长度: 15米
```

---

## 12. Database, Backup & Maintenance

Bot memakai **SQLite** (`node:sqlite`) di lokasi `DB_PATH`
(default `./data/qmywi.sqlite`).

Tabel:
- `users` — `telegram_user_id` (UNIQUE), username, name, `nik` (UNIQUE), status,
  invited_at, registered_at, created_at, updated_at.
- `invite_tokens` — `token_hash` (UNIQUE), status, created_by, created_at,
  expires_at, used_by, used_at.
- `employees` — `nik` (UNIQUE), name, created_by, created_at, updated_at.

**Backup:**

```bash
# Hentikan bot dulu bila memungkinkan, lalu salin file DB (+ WAL bila ada)
cp data/qmywi.sqlite data/backup-qmywi-$(date +%F).sqlite
```

**Restore:** hentikan bot, ganti `data/qmywi.sqlite` dengan file backup, jalankan ulang.

**Reset total (hati-hati, menghapus semua data):**

```bash
rm -f data/qmywi.sqlite data/qmywi.sqlite-wal data/qmywi.sqlite-shm
```

> `data/` dan `*.sqlite` sudah masuk `.gitignore` sehingga tidak ter-commit.

---

## 13. Deployment (Produksi)

### Opsi A — VPS + systemd (polling)

1. Pasang Node.js ≥ 22.5 di server, clone project, `npm install`.
2. Buat `.env` (jangan commit), isi `TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_ID`,
   `BOT_MODE=polling`, `DB_PATH=/var/lib/qmywi/qmywi.sqlite`.
3. Buat service `/etc/systemd/system/qm-ywi-bot.service`:

   ```ini
   [Unit]
   Description=QM-YWI Telegram Bot
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/opt/qm-ywi-bot
   ExecStart=/usr/bin/node src/bot.js
   Restart=always
   RestartSec=5
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

4. Jalankan:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now qm-ywi-bot
   sudo journalctl -u qm-ywi-bot -f
   ```

### Opsi B — VPS + pm2

```bash
npm install -g pm2
pm2 start src/bot.js --name qm-ywi-bot
pm2 save
pm2 startup
```

### Opsi C — Webhook + reverse proxy (HTTPS)

Set `BOT_MODE=webhook`, `WEBHOOK_URL=https://domain-anda.com/webhook`,
`WEBHOOK_SECRET_TOKEN=...`, lalu reverse proxy (contoh Nginx):

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Opsi D — Google Apps Script

Folder `google-apps-script/` berisi implementasi alternatif (serverless).
Lihat `google-apps-script/README_GAS.md`.

> Catatan: access control (token/registrasi/admin SQLite) saat ini hanya ada di
> implementasi Node.js (`src/`).

---

## 14. Keamanan

- `TELEGRAM_BOT_TOKEN` dan `OWNER_TELEGRAM_ID` selalu dari environment variable.
- Token bot/secret disensor otomatis di log (`logger.js`).
- Token undangan **tidak pernah** disimpan plaintext (hanya hash SHA-256) dan
  tidak dicatat di log produksi.
- UNIQUE constraint: `telegram_user_id`, `nik`, `token_hash`.
- Redeem token dilakukan dalam **transaksi** (anti pemakaian ganda bersamaan).
- Semua callback admin diverifikasi ulang sebagai owner.
- Seluruh command/fitur melewati access guard; NIK lengkap disamarkan di daftar admin.
- Jangan commit `.env`, `data/`, atau file `*.sqlite`.

---

## 15. Testing & Typecheck

```bash
# Pemeriksaan sintaks semua file (pengganti typecheck)
npm run typecheck

# Menjalankan seluruh test
npm test
```

Cakupan test: access control (token, registrasi, NIK, blokir), direktori karyawan,
idempotensi `update_id`, material, penomoran HAxx, diameter FT/FJ, validasi,
output Mandarin, command, dan health check webhook.

---

## 16. Troubleshooting / FAQ

**Bot tidak merespons di mode polling / muncul `409 Conflict`**
Ada webhook aktif. Hapus webhook:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

**`Cannot find module 'node:sqlite'`**
Versi Node terlalu lama. Update ke **Node ≥ 22.5**.

**User `ACTIVE` tidak bisa masuk / tiba-tiba ditolak**
Cek status di `/admin → 👥 Daftar Pengguna`. Mungkin `BLOCKED`.

**NIK terus ditolak padahal benar**
Pastikan NIK **8 digit** dan sudah ada di **👔 Data Karyawan**. Cek `/admin → 👔 → 📋 Daftar Karyawan`.

**Nama salah / typo**
Admin tambahkan ulang NIK tersebut dengan nama yang benar (otomatis diperbarui),
atau minta user tekan `✏️ Ubah NIK` lalu ulangi.

**Token tidak bisa dipakai**
Token mungkin sudah `USED`/`EXPIRED`. Buat token baru dari `/admin`.

**Owner tidak bisa `/admin`**
Periksa `OWNER_TELEGRAM_ID` di `.env` (harus sama persis dengan Telegram User ID),
lalu restart bot.

**Data hilang setelah restart**
Pastikan `DB_PATH` menunjuk lokasi permanen (bukan `:memory:`).

---

## 17. Referensi Perintah

| Perintah | Akses | Deskripsi |
|---|---|---|
| `/start` | Semua | Sadar-status: token / lanjut registrasi / menu utama |
| `/new` | ACTIVE | Mulai Form Generator |
| `/help` | ACTIVE | Panduan form |
| `/material` | ACTIVE | Tabel material Z/K/G |
| `/example` | ACTIVE | Contoh alur & output |
| `/cancel` | ACTIVE | Batalkan sesi form |
| `/about` | ACTIVE | Profil QM-YWI |
| `/admin` | Owner | Panel administrator |

---

## 18. Update Bot via Git

```bash
git status
git add .
git commit -m "docs: tambah tutorial lengkap & fitur data karyawan"
git push origin main
```

Jika push meminta autentikasi, gunakan **Personal Access Token (PAT)** GitHub
sebagai password (bukan password akun), atau setup SSH:

```bash
git remote set-url origin git@github.com:manggeabbas/qm-ywi-telegram-bot.git
```

> Setelah update, **tidak ada** deployment otomatis. Jalankan/restart bot secara
> manual sesuai metode deployment yang dipakai.

---

*Dokumen ini disusun untuk QM-YWI Telegram Bot v2.1.*

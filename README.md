# QM-YWI Telegram Form Generator (v2.1)

**Department:** Department of Quality Management  
**Division:** QM-YWI  
**Platform:** Telegram Bot  
**Interaction:** Bahasa Indonesia  
**Final Output:** Format Mandarin workplace  
**Motto:** *"Periksa dengan teliti, Pastikan Sempurna!"*

> 📘 **Panduan lengkap pemakaian & deployment ada di [TUTORIAL.md](./TUTORIAL.md).**

---

## 1. Deskripsi

Bot Telegram ini membantu inspector dan operator QM-YWI membuat data gulungan baru secara bertahap, konsisten, cepat, dan meminimalkan kesalahan penomoran serta penentuan material. 

Versi 2.1 berfokus pada **Form Generator** tanpa database coil, dilengkapi deteksi otomatis jenis material, aturan diameter FT/FJ, validasi penomoran suffix `HAxx`, preview dan pengeditan menyeluruh, serta ekspor format teks Mandarin workplace QM-YWI.

---

## 2. Fitur Utama

- **Identitas Bot Resmi**: Header dan motto resmi QM-YWI pada interaksi bot.
- **Deteksi Material Otomatis**:
  - `Z` ➔ `S30400`
  - `K` ➔ `S30403`
  - `G` ➔ `S31603`
  - Kode tidak dikenal langsung ditolak (tidak menebak).
- **Aturan Penomoran HAxx**:
  - Grouping: `HA10–HA19` ➔ `HA1x`, `HA20–HA29` ➔ `HA2x`, `HA30–HA39` ➔ `HA3x`.
  - Hanya digit terakhir yang berubah.
  - Validasi ketat `start + count - 1 <= 9` untuk mencegah penomoran tidak sah seperti `HA110`.
- **Aturan Diameter Mesin**:
  - **FT**: Default `目前内径: 610`, dengan opsi konfirmasi ubah diameter 508.
  - **FJ**: Pilihan diameter dalam `610` atau `508`, status ubah `Tidak Perlu`.
- **Pengumpulan Data Independen Per Coil**:
  - Grade: `A1`, `B`, `B1`, `R`, `S`.
  - Main Defect: input manual (contoh: `B22`, `R20`, `D02`, `C13`).
  - Remark: default `-` (tidak diwariskan antar coil).
  - Panjang: input meter (output otomatis diberi suffix `米`).
- **Preview & Edit Interaktif**:
  - Preview penomoran sebelum inspeksi.
  - Preview seluruh data sebelum konfirmasi akhir.
  - Fasilitas pengeditan nomor asal, spesifikasi, dan data coil individu jika ada revisi.
- **Output Mandarin Workplace**:
  - Teks terformat rapi dalam blok kode monospace agar mudah disalin langsung ke sistem kerja.
- **Idempotensi & Keamanan**:
  - Pencegahan pemrosesan `update_id` ganda akibat webhook retry.
  - Token bot dan secret terisolasi di environment variable / `.env` dan tidak pernah bocor ke log.
- **Access Control & Registrasi (baru)**:
  - User baru wajib memiliki token undangan (sekali pakai, disimpan sebagai hash).
  - Registrasi NAMA + NIK karyawan (8 digit angka, unik) dengan konfirmasi sebelum aktif.
  - Status user `NEW`, `REGISTRATION`, `ACTIVE`, `BLOCKED` dengan access guard terpusat.
  - Panel admin/owner (`/admin`): buat token, daftar token, daftar/detail user, blokir & aktifkan.
  - Persistence SQLite agar data tetap ada setelah restart/redeploy.

---

## 3. Struktur Modul

```text
src/
├── config.js         # Konfigurasi environment & konstanta
├── logger.js         # Logger aman (menyensor token/secret)
├── db.js             # Koneksi & schema SQLite (node:sqlite) + transaksi
├── users.js          # Repository user, status, masking NIK
├── invites.js        # Invite token: generate, hash, redeem atomic
├── registration.js   # Alur registrasi (NAMA -> NIK -> konfirmasi)
├── access.js         # Access guard (NEW/REGISTRATION/ACTIVE/BLOCKED)
├── admin.js          # Panel owner: token, daftar user, blokir/aktifkan
├── menu.js           # Menu utama reusable
├── texts.js          # Kumpulan teks pesan access control/registrasi
├── material.js       # Mapping Z/K/G dan logika deteksi material
├── numbering.js      # Parsing coil, grouping suffix HAxx, generator nomor
├── diameter.js       # Aturan diameter FT & FJ
├── validation.js     # Validasi input (mesin, coil, spec, count, defect, length, nama, NIK)
├── form.js           # Generator output Mandarin workplace & preview
├── state.js          # Sesi Form Generator & cache idempotensi update_id
├── wizard.js         # Alur step-by-step Form Generator
└── bot.js            # Router Telegram bot, access guard, webhook/polling runner
```

---

## 4. Instalasi & Menjalankan

### Prasyarat
- Node.js **v22.5 ke atas** (wajib, karena persistence memakai `node:sqlite` bawaan Node; diuji pada Node.js v26)
- Token Telegram Bot dari [@BotFather](https://t.me/BotFather)
- Telegram User ID owner (untuk fitur `/admin`)

### Langkah Setup

1. **Clone / Masuk ke direktori proyek**:
   ```bash
   cd /home/manggebn/.gemini/antigravity/scratch/qm-ywi-bot
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**:
   Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` dan masukkan token bot Anda:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   BOT_MODE=polling
   PORT=3000
   ```

4. **Jalankan Bot**:
   - **Mode Development (Polling)**:
     ```bash
     npm start
     ```
     atau dengan auto-reload:
     ```bash
     npm run dev
     ```

### Opsi Deployment: Google Apps Script (100% Gratis 24/7)
Jika ingin menjalankan bot secara serverless tanpa VPS/server:
1. Buka [google-apps-script/README_GAS.md](./google-apps-script/README_GAS.md).
2. Salin isi file [google-apps-script/Bundle.gs](./google-apps-script/Bundle.gs) ke [script.google.com](https://script.google.com).
3. Masukkan `TELEGRAM_BOT_TOKEN` di *Script Properties*, deploy sebagai *Web app*, dan jalankan fungsi `setupWebhook()`.

> Catatan: implementasi access control saat ini hanya tersedia pada versi Node.js (`src/`).

---

## 4b. Access Control, Invite Token & Registrasi

Bot tidak lagi dapat langsung digunakan oleh siapa pun. Setiap Telegram User ID
harus melewati access guard sebelum dapat mengakses Form Generator.

**Status user:**

| Status | Hak akses |
|---|---|
| `NEW` | Hanya boleh memasukkan token undangan |
| `REGISTRATION` | Hanya boleh menyelesaikan registrasi |
| `ACTIVE` | Seluruh fitur bot (Form Generator, dll.) |
| `BLOCKED` | Ditolak, tidak boleh memakai fitur apa pun |

**Alur pengguna baru:**

```text
/start
  -> Cek Telegram User ID
  -> Belum terdaftar: minta TOKEN UNDANGAN
  -> Token valid (langsung diikat ke Telegram User ID, sekali pakai)
  -> Registrasi: NIK karyawan (8 digit) -> NAMA dikenali otomatis
     dari Data Karyawan yang diisi admin
  -> Preview & konfirmasi data
  -> Status ACTIVE -> menu utama / Form Generator
```

**Data Karyawan (direktori NIK -> NAMA):** owner mengisi data karyawan lebih
dulu. Saat registrasi user cukup memasukkan NIK; jika NIK ada di direktori,
NAMA otomatis terisi. Jika NIK tidak terdaftar, registrasi ditolak dan user
diminta menghubungi administrator. Nama tidak dapat diisi manual.

**Token undangan:** dibuat acak secara kriptografis (contoh `QMYWI-7K9P-X4M2-AB3C`),
disimpan **hanya sebagai hash SHA-256** (tanpa plaintext), hanya dapat dipakai
**satu kali**, dan redeem dilakukan dalam **transaksi** agar tidak dapat
digunakan dua pengguna secara bersamaan. Token asli hanya ditampilkan sekali
kepada owner saat dibuat.

**Persistence (SQLite):** data user, NIK, status, invite token, status token,
riwayat pemakaian token, dan state registrasi tersimpan di `DB_PATH`
(default `./data/qmywi.sqlite`) sehingga tetap ada setelah restart/redeploy.

**Konfigurasi environment tambahan:**

```env
# Wajib untuk fitur /admin. Bisa lebih dari satu, pisahkan dengan koma.
OWNER_TELEGRAM_ID=123456789

# Lokasi database SQLite
DB_PATH=./data/qmywi.sqlite
```

**Panel admin (`/admin`, hanya owner):**
1. Buat token undangan (pilih jumlah + masa berlaku 7 hari / 30 hari / tidak expired)
2. Daftar token
3. Daftar pengguna (NIK disamarkan)
4. Detail pengguna
5. Blokir pengguna
6. Aktifkan kembali pengguna
7. Data Karyawan: tambah massal (tempel `NIK,Nama` banyak baris) / satu-satu, daftar, dan hapus

**Keamanan:** `TELEGRAM_BOT_TOKEN` dan `OWNER_TELEGRAM_ID` selalu dibaca dari
environment variable (tidak pernah di-hard-code), token bot/secret disensor di
log, token undangan tidak pernah disimpan dalam bentuk plaintext, serta
`telegram_user_id`, `nik`, dan `token_hash` memiliki UNIQUE constraint.

---

## 5. Menjalankan Pengujian (Testing)

Proyek dilengkapi unit test dan integration test yang mencakup kriteria PRD serta access control:

```bash
# Pemeriksaan sintaks seluruh file sumber (pengganti typecheck)
npm run typecheck

# Menjalankan seluruh test
npm test
```

Cakupan pengujian meliputi:
- Access control: user baru, token invalid/valid, registrasi, NIK invalid/duplikat, resume registrasi, BLOCKED, blokir/aktifkan
- Token undangan satu kali pakai & pembuatan token oleh owner
- Idempotensi `update_id` (termasuk duplicate)
- Mapping & deteksi material `Z/K/G`
- Penomoran `HAxx` dan pembatasan `start + count - 1 <= 9`
- Aturan diameter `FT` dan `FJ`
- Semua validasi input
- Format output Mandarin workplace persis sesuai Section 13 PRD
- Perintah `/start`, `/help`, `/material`, `/example`, `/about`, `/cancel`
- Server Webhook dan health check `GET /health`

---

## 6. Daftar Perintah Bot

| Perintah | Deskripsi |
|---|---|
| `/start` | Sadar-status: minta token (NEW), lanjutkan registrasi (REGISTRATION), atau tampilkan menu utama (ACTIVE) |
| `/new` | Memulai form generator baru (hanya ACTIVE) |
| `/help` | Panduan lengkap langkah dan aturan (hanya ACTIVE) |
| `/material` | Tabel referensi kode material Z, K, G (hanya ACTIVE) |
| `/example` | Contoh pengisian dan output teks Mandarin (hanya ACTIVE) |
| `/cancel` | Membatalkan sesi Form Generator aktif (hanya ACTIVE) |
| `/about` | Profil Department of Quality Management QM-YWI (hanya ACTIVE) |
| `/admin` | Panel administrator (hanya `OWNER_TELEGRAM_ID`) |

---

## 7. Format Output Mandarin Workplace

Contoh hasil akhir yang digenerate oleh bot:

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
等级: A1
主缺陷: B22
备注: -
目前内径: 610
是否需改内径: Tidak Perlu
长度: 955米

QH2608K2531HA13
S30403
1.24*1524
等级: S
主缺陷: C13
备注: -
目前内径: 610
是否需改内径: Tidak Perlu
长度: 15米
```

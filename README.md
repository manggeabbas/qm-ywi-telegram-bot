# QM-YWI Telegram Form Generator (v2.1)

**Department:** Department of Quality Management  
**Division:** QM-YWI  
**Platform:** Telegram Bot  
**Interaction:** Bahasa Indonesia  
**Final Output:** Format Mandarin workplace  
**Motto:** *"Periksa dengan teliti, Pastikan Sempurna!"*

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

---

## 3. Struktur Modul

```text
src/
├── config.js         # Konfigurasi environment & konstanta
├── logger.js         # Logger aman (menyensor token/secret)
├── material.js       # Mapping Z/K/G dan logika deteksi material
├── numbering.js      # Parsing coil, grouping suffix HAxx, generator nomor
├── diameter.js       # Aturan diameter FT & FJ
├── validation.js     # Validasi input (mesin, coil, spec, count, defect, length)
├── form.js           # Generator output Mandarin workplace & preview
├── state.js          # Sesi pengguna & cache idempotensi update_id
├── wizard.js         # Alur step-by-step & penanganan pesan interaktif
└── bot.js            # Router Telegram bot, webhook HTTP server, dan polling runner
```

---

## 4. Instalasi & Menjalankan

### Prasyarat
- Node.js (v18 ke atas disarankan, diuji pada Node.js v26)
- Token Telegram Bot dari [@BotFather](https://t.me/BotFather)

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

---

## 5. Menjalankan Pengujian (Testing)

Proyek dilengkapi 27 unit test dan integration test yang mencakup 100% kriteria PRD:

```bash
npm test
```

Semua pengujian mencakup:
- Mapping & deteksi material `Z/K/G`
- Penomoran `HAxx` dan pembatasan `start + count - 1 <= 9`
- Aturan diameter `FT` dan `FJ`
- Semua validasi input
- Format output Mandarin workplace persis sesuai Section 13 PRD
- Idempotensi `update_id`
- Perintah `/start`, `/help`, `/material`, `/example`, `/about`, `/cancel`
- Server Webhook dan health check `GET /health`

---

## 6. Daftar Perintah Bot

| Perintah | Deskripsi |
|---|---|
| `/start` | Menampilkan pesan sambutan QM-YWI dan tombol mulai |
| `/new` | Memulai form generator baru |
| `/help` | Panduan lengkap langkah dan aturan |
| `/material` | Tabel referensi kode material Z, K, G |
| `/example` | Contoh pengisian dan output teks Mandarin |
| `/cancel` | Membatalkan sesi pembuatan form aktif |
| `/about` | Profil Department of Quality Management QM-YWI |

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

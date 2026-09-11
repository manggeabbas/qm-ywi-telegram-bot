# Panduan Menjalankan Bot di Google Apps Script (google.script)

**Department:** Department of Quality Management  
**Division:** QM-YWI  
**Versi:** 2.1  
**Platform:** Google Apps Script Web App (Serverless Webhook)

Dengan Google Apps Script (GAS), bot Telegram QM-YWI Anda akan:
- **Aktif 24/7 Gratis** tanpa perlu sewa VPS / server.
- **Memiliki URL HTTPS otomatis** bawaan dari Google untuk Webhook Telegram.
- **Satu file siap pakai**: Cukup salin isi file [`Bundle.gs`](./Bundle.gs).

---

## Langkah 1: Buka Google Apps Script & Buat Proyek Baru

1. Buka browser dan kunjungi: **[script.google.com](https://script.google.com)** (pastikan login dengan akun Google Anda).
2. Klik tombol **New project** (Proyek baru) di pojok kiri atas.
3. Ganti nama proyek (klik teks *Untitled project* di atas) menjadi: **`QM-YWI Telegram Bot`**.

---

## Langkah 2: Salin Kode `Bundle.gs`

1. Di editor Google Apps Script, Anda akan melihat file bernama `Code.gs`.
2. Hapus seluruh isi default `myFunction()`.
3. Buka file [`google-apps-script/Bundle.gs`](./Bundle.gs) dari proyek ini.
4. **Salin seluruh isi kode** tersebut dan **tempelkan (paste)** ke editor `Code.gs` di Google Apps Script.
5. Tekan ikon disket 💾 (**Save project**) atau tekan `Ctrl + S`.

---

## Langkah 3: Masukkan Token Bot (Script Properties)

Sesuai aturan keamanan Section 16 PRD, token tidak boleh ditulis di dalam kode:

1. Di menu sebelah kiri editor Google Apps Script, klik ikon gerigi ⚙️ (**Project Settings**).
2. Gulir ke bawah ke bagian **Script Properties**.
3. Klik tombol **Edit script properties** lalu klik **Add script property**.
4. Masukkan:
   - **Property**: `TELEGRAM_BOT_TOKEN`
   - **Value**: Masukkan token asli bot Anda dari [@BotFather](https://t.me/BotFather) (contoh: `7123456789:AAHk...`)
5. Klik **Save script properties**.

---

## Langkah 4: Deploy sebagai Web App

1. Di pojok kanan atas editor, klik tombol biru **Deploy** ➔ pilih **New deployment**.
2. Klik ikon gerigi ⚙️ di samping *Select type* ➔ pilih **Web app**.
3. Isi konfigurasi berikut:
   - **Description**: `QM-YWI Form Generator v2.1`
   - **Execute as**: `Me (email-anda@gmail.com)`
   - **Who has access**: **`Anyone`** *(Wajib pilih 'Anyone' agar Telegram dapat mengirim update webhook ke bot)*
4. Klik **Deploy**.
5. Jika muncul permintaan izin (*Authorization*), klik **Authorize access**, pilih akun Google Anda, klik *Advanced*, lalu klik *Go to QM-YWI Telegram Bot (unsafe)* dan klik **Allow**.
6. Salin **Web app URL** yang muncul (URL berakhiran `/exec`).

---

## Langkah 5: Sambungkan Webhook ke Telegram (1x Klik)

Kami sudah menyiapkan fungsi otomatis di dalam script agar Anda tidak perlu membuka terminal atau curl:

1. Kembali ke editor kode (`Code.gs`).
2. Di toolbar atas editor, pada dropdown fungsi (di sebelah tombol *Debug*), pilih fungsi: **`setupWebhook`**.
3. Klik tombol **Run** (Jalankan) ▶️.
4. Tunggu beberapa detik hingga selesai. Anda dapat melihat *Execution log* di bawah yang bertuliskan:
   ```json
   {"ok":true,"result":true,"description":"Webhook was set"}
   ```

*(Opsional: Anda juga bisa memilih fungsi `getWebhookInfo` lalu klik Run untuk memastikan webhook Telegram sudah aktif mengarah ke URL script Anda).*

---

## Langkah 6: Uji Bot di Telegram!

1. Buka aplikasi Telegram.
2. Cari bot Anda dan kirim perintah:
   ```text
   /start
   ```
3. Bot akan membalas dengan sambutan identitas QM-YWI dan tombol **Mulai Buat Form**.
4. Ikuti wizard:
   - Pilih mesin: **FT** atau **FJ**
   - Masukkan nomor gulungan asal (misal: `QH2608K2531HA10`)
   - Deteksi material otomatis akan mengenali `K` sebagai `S30403`
   - Masukkan spesifikasi, jumlah gulungan, digit awal, data inspeksi per coil
   - Dapatkan output teks Mandarin Workplace QM-YWI yang rapi!

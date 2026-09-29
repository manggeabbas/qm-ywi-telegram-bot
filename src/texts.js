/**
 * Kumpulan teks pesan access control & registrasi QM-YWI.
 * Dipusatkan agar konsisten dan mudah diuji.
 */

export const TEXTS = Object.freeze({
  INVITE_PROMPT: `🔐 Akses Terbatas

Bot QM-YWI hanya dapat digunakan oleh pengguna yang memiliki token undangan.

Silakan masukkan token undangan Anda.`,

  TOKEN_INVALID: `❌ Token tidak valid atau sudah tidak dapat digunakan.

Silakan periksa kembali token Anda atau hubungi administrator.`,

  TOKEN_VALID: `✅ Token valid.

Sebelum menggunakan bot, silakan lengkapi data diri Anda.`,

  REG_PROMPT_NIK: `📝 REGISTRASI PENGGUNA

Silakan masukkan NIK (Nomor Induk Karyawan) Anda.`,

  REG_CONTINUE_NIK: `Registrasi Anda belum selesai.

Silakan masukkan NIK (Nomor Induk Karyawan) Anda.`,

  NIK_NOT_REGISTERED: `❌ NIK tidak terdaftar pada data karyawan.

Silakan periksa kembali NIK Anda atau hubungi administrator.`,

  NIK_INVALID: `❌ Format NIK tidak valid.

NIK harus terdiri dari 8 digit angka.
Silakan masukkan kembali.`,

  NIK_TAKEN: `❌ NIK tersebut sudah terdaftar pada akun lain.

Silakan hubungi administrator.`,

  BLOCKED: `🚫 Akses Ditolak

Akun Anda tidak memiliki akses ke bot ini.

Silakan hubungi administrator.`,

  ADMIN_DENIED: `🚫 Anda tidak memiliki akses administrator.`,

  RESTRICTED_REGISTRATION: `Anda harus menyelesaikan registrasi terlebih dahulu sebelum menggunakan fitur bot.`,

  REGISTER_SUCCESS: (name, nik) => `✅ Registrasi berhasil.

Selamat datang di QM-YWI Telegram Bot.

NAMA : ${name}
NIK  : ${nik}

Akun Anda sekarang aktif.`,

  REG_CONFIRM: (name, nik) => `📋 KONFIRMASI DATA

NAMA : ${name}
NIK  : ${nik}

Apakah data sudah benar?`
});

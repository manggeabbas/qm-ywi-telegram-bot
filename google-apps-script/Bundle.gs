/**
 * =========================================================================
 * QM-YWI TELEGRAM FORM GENERATOR BOT (v2.1)
 * Google Apps Script Implementation
 *
 * Department: Department of Quality Management
 * Division: QM-YWI
 * Platform: Google Apps Script Web App (Webhook)
 * Interaction: Bahasa Indonesia
 * Final Output: Format Mandarin workplace
 * Motto: "Periksa dengan teliti, Pastikan Sempurna!"
 * =========================================================================
 */

// ============================= KONFIGURASI =============================

const CONFIG = {
  DEPARTMENT: 'Department of Quality Management',
  DIVISION: 'QM-YWI',
  VERSION: '2.1',
  MOTTO: 'Periksa dengan teliti, Pastikan Sempurna!',
  HEADER_TEXT: 'Department of Quality Management\nQM-YWI\n\nPeriksa dengan teliti, Pastikan Sempurna!',
  
  MATERIAL_MAP: {
    Z: 'S30400',
    K: 'S30403',
    G: 'S31603'
  },
  
  VALID_GRADES: ['A1', 'B', 'B1', 'R', 'S'],
  
  DIAMETER: {
    FT_DEFAULT: 610,
    FT_CHANGE_YES: 'Perlu Ubah Diameter 508',
    FT_CHANGE_NO: 'Tidak Perlu',
    FJ_DEFAULT_CHANGE: 'Tidak Perlu'
  },
  
  STEPS: {
    IDLE: 'IDLE',
    SELECT_MACHINE: 'SELECT_MACHINE',
    INPUT_SOURCE_COIL: 'INPUT_SOURCE_COIL',
    CONFIRM_MATERIAL: 'CONFIRM_MATERIAL',
    INPUT_SPECIFICATION: 'INPUT_SPECIFICATION',
    INPUT_COUNT: 'INPUT_COUNT',
    INPUT_START_DIGIT: 'INPUT_START_DIGIT',
    PREVIEW_NUMBERING: 'PREVIEW_NUMBERING',
    INPUT_COIL_GRADE: 'INPUT_COIL_GRADE',
    INPUT_COIL_DEFECT: 'INPUT_COIL_DEFECT',
    INPUT_COIL_REMARK: 'INPUT_COIL_REMARK',
    INPUT_COIL_LENGTH: 'INPUT_COIL_LENGTH',
    INPUT_COIL_DIAMETER: 'INPUT_COIL_DIAMETER',
    PREVIEW_FULL_FORM: 'PREVIEW_FULL_FORM',
    EDIT_SELECT_COIL: 'EDIT_SELECT_COIL',
    EDIT_SELECT_FIELD: 'EDIT_SELECT_FIELD',
    EDIT_INPUT_VALUE: 'EDIT_INPUT_VALUE'
  }
};

/**
 * Mengambil token Telegram dari Script Properties
 */
function getBotToken() {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN belum diatur di Script Properties!');
  }
  return token.trim();
}

// ========================== TELEGRAM API CLIENT ==========================

/**
 * Memanggil Telegram Bot API menggunakan UrlFetchApp
 */
function callTelegram(method, payload) {
  const token = getBotToken();
  const url = 'https://api.telegram.org/bot' + token + '/' + method;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  if (!json.ok) {
    Logger.log('Telegram API Error (' + method + '): ' + JSON.stringify(json));
  }
  return json;
}

function sendMessage(chatId, text, replyMarkup, parseMode) {
  const payload = {
    chat_id: chatId,
    text: text
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  if (parseMode) payload.parse_mode = parseMode;
  return callTelegram('sendMessage', payload);
}

function editMessageText(chatId, messageId, text, replyMarkup, parseMode) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  if (parseMode) payload.parse_mode = parseMode;
  return callTelegram('editMessageText', payload);
}

function answerCallbackQuery(callbackQueryId, text) {
  const payload = { callback_query_id: callbackQueryId };
  if (text) payload.text = text;
  return callTelegram('answerCallbackQuery', payload);
}

// ======================== STATE & IDEMPOTENCY ========================

/**
 * Pengecekan dan penyimpanan update_id untuk mencegah respons ganda (Idempotency)
 */
function isUpdateProcessed(updateId) {
  if (!updateId) return false;
  const cache = CacheService.getScriptCache();
  return cache.get('update_' + updateId) !== null;
}

function markUpdateProcessed(updateId) {
  if (!updateId) return;
  const cache = CacheService.getScriptCache();
  // Simpan selama 10 menit (600 detik)
  cache.put('update_' + updateId, '1', 600);
}

/**
 * Mengambil sesi user dari CacheService (TTL 6 jam)
 */
function getSession(userId) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get('session_' + userId);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {}
  }
  return {
    step: CONFIG.STEPS.IDLE,
    machine: null,
    sourceCoil: null,
    materialCode: null,
    material: null,
    specification: null,
    count: null,
    startDigit: null,
    generatedCoils: [],
    inspections: [],
    currentCoilIndex: 0,
    currentCoilData: {},
    editTarget: null
  };
}

function setSession(userId, sessionData) {
  const cache = CacheService.getScriptCache();
  // Simpan state maksimal 21600 detik (6 jam)
  cache.put('session_' + userId, JSON.stringify(sessionData), 21600);
}

function clearSession(userId) {
  const cache = CacheService.getScriptCache();
  cache.remove('session_' + userId);
}

// ============================ LOGIKA DOMAIN ============================

/**
 * Deteksi material dari nomor gulungan asal
 */
function detectMaterial(coilNumber) {
  if (!coilNumber || typeof coilNumber !== 'string') {
    return { valid: false, error: 'Nomor gulungan tidak boleh kosong.' };
  }
  const clean = coilNumber.trim().toUpperCase();
  const match = clean.match(/^([A-Z]+\d+)([A-Z])(\d+)(HA\d{2})$/) || clean.match(/^(.+?)([A-Z])(\d+)(HA\d{2})$/);
  
  if (!clean.includes('HA') || !match) {
    return {
      valid: false,
      error: 'Format nomor gulungan tidak valid. Nomor gulungan harus memiliki suffix HAxx (contoh: QH2608K2531HA10).'
    };
  }

  const materialCode = match[2];
  const material = CONFIG.MATERIAL_MAP[materialCode];

  if (!material) {
    return {
      valid: false,
      materialCode: materialCode,
      error: 'Kode jenis/material tidak dikenali.\n\nZ = S30400\nK = S30403\nG = S31603\n\nSilakan periksa kembali nomor gulungan.'
    };
  }

  return {
    valid: true,
    cleanCoil: clean,
    materialCode: materialCode,
    material: material
  };
}

/**
 * Generator nomor gulungan HAxx
 */
function generateCoilNumbers(sourceCoil, count, startDigit) {
  const clean = sourceCoil.trim().toUpperCase();
  const match = clean.match(/^(.*HA\d)(\d)$/);
  if (!match) {
    return { valid: false, error: 'Nomor gulungan asal harus memiliki suffix HAxx (contoh: QH2608K2531HA10).' };
  }

  const basePrefix = match[1]; // e.g. QH2608K2531HA1
  const maxDigit = startDigit + count - 1;

  if (maxDigit > 9) {
    return {
      valid: false,
      error: 'Penomoran ditolak: digit awal (' + startDigit + ') + jumlah (' + count + ') - 1 = ' + maxDigit + ' (> 9).\nDigit terakhir suffix hanya boleh 0–9 agar tidak menghasilkan format tidak valid (seperti HA110).'
    };
  }

  const coils = [];
  for (let i = 0; i < count; i++) {
    coils.push(basePrefix + (startDigit + i));
  }

  return { valid: true, coils: coils };
}

/**
 * Aturan diameter FT / FJ
 */
function resolveDiameter(machine, selection) {
  if (machine === 'FT') {
    const isChange = String(selection).indexOf('508') !== -1;
    return {
      diameter: CONFIG.DIAMETER.FT_DEFAULT,
      changeDiameter: isChange ? CONFIG.DIAMETER.FT_CHANGE_YES : CONFIG.DIAMETER.FT_CHANGE_NO
    };
  }
  if (machine === 'FJ') {
    const parsed = parseInt(selection, 10);
    return {
      diameter: parsed === 508 ? 508 : 610,
      changeDiameter: CONFIG.DIAMETER.FJ_DEFAULT_CHANGE
    };
  }
  return { diameter: 610, changeDiameter: 'Tidak Perlu' };
}

/**
 * Output teks Mandarin Workplace (Section 13 PRD)
 */
function generateWorkplaceMandarinOutput(state) {
  const header = [
    '机组：' + state.machine,
    state.sourceCoil,
    '要生成新卷号'
  ].join('\n');

  const coilBlocks = state.inspections.map(function(item) {
    const remark = (item.remark && item.remark.trim().length > 0) ? item.remark.trim() : '-';
    return [
      item.coilNumber,
      state.material,
      state.specification,
      '等级: ' + item.grade,
      '主缺陷: ' + item.mainDefect,
      '备注: ' + remark,
      '目前内径: ' + item.diameter,
      '是否需改内径: ' + item.changeDiameter,
      '长度: ' + item.length + '米'
    ].join('\n');
  });

  return header + '\n\n' + coilBlocks.join('\n\n');
}

function formatFullPreview(state) {
  const lines = [
    '📋 *PREVIEW DATA INSPEKSI QM-YWI*',
    '----------------------------------------',
    '*Mesin:* ' + state.machine,
    '*Gulungan Asal:* `' + state.sourceCoil + '`',
    '*Material:* ' + state.material + ' (' + state.materialCode + ')',
    '*Spesifikasi:* `' + state.specification + '`',
    '*Jumlah Gulungan:* ' + state.count + ' coil',
    '----------------------------------------'
  ];

  state.inspections.forEach(function(item, idx) {
    lines.push('\n🔹 *Coil ' + (idx + 1) + ': `' + item.coilNumber + '`*');
    lines.push('• Grade: *' + item.grade + '*');
    lines.push('• Cacat Utama: *' + item.mainDefect + '*');
    lines.push('• Remark: *' + (item.remark || '-') + '*');
    lines.push('• Diameter Dalam: *' + item.diameter + '*');
    lines.push('• Ubah Diameter: *' + item.changeDiameter + '*');
    lines.push('• Panjang: *' + item.length + '米*');
  });

  lines.push('\n----------------------------------------');
  lines.push('Periksa seluruh data di atas. Apakah data sudah benar?');
  return lines.join('\n');
}

// ======================== WIZARD & ROUTING ========================

function handleStartCommand(chatId) {
  const text = CONFIG.HEADER_TEXT + '\n\nSelamat datang di *QM-YWI Telegram Form Generator* (v' + CONFIG.VERSION + ').\nBot ini membantu inspector/operator membuat form data gulungan baru secara bertahap dan konsisten.\n\nTekan tombol di bawah atau ketik /new untuk mulai:';
  const keyboard = {
    inline_keyboard: [
      [{ text: '🚀 Mulai Buat Form', callback_data: 'action:new_form' }],
      [
        { text: 'ℹ️ Referensi Material', callback_data: 'cmd:material' },
        { text: '📖 Bantuan', callback_data: 'cmd:help' }
      ]
    ]
  };
  sendMessage(chatId, text, keyboard, 'Markdown');
}

function handleHelpCommand(chatId) {
  const text = '*PANDUAN PENGGUNAAN QM-YWI FORM GENERATOR*\n\n' +
    '*Perintah yang tersedia:*\n' +
    '/start - Pesan pembuka dan menu awal\n' +
    '/new - Memulai pembuatan form gulungan baru\n' +
    '/help - Panduan penggunaan ini\n' +
    '/material - Tabel referensi material (Z/K/G)\n' +
    '/example - Contoh alur input dan format output\n' +
    '/cancel - Membatalkan sesi aktif\n' +
    '/about - Profil QM-YWI dan motto resmi';
  sendMessage(chatId, text, null, 'Markdown');
}

function handleMaterialCommand(chatId) {
  const list = Object.keys(CONFIG.MATERIAL_MAP).map(function(k) {
    return '• Kode *' + k + '* ➔ *' + CONFIG.MATERIAL_MAP[k] + '*';
  }).join('\n');
  const text = '*TABEL REFERENSI MATERIAL QM-YWI*\n\n' + list + '\n\n_Catatan: Kode material terletak setelah kode periode dan sebelum nomor urut utama._';
  sendMessage(chatId, text, null, 'Markdown');
}

function handleExampleCommand(chatId) {
  const text = '*CONTOH OUTPUT FINAL MANDARIN WORKPLACE QM-YWI*\n\n' +
    '```text\n' +
    '机组：FT\n' +
    'QH2608K2531HA10\n' +
    '要生成新卷号\n\n' +
    'QH2608K2531HA11\n' +
    'S30403\n' +
    '1.24*1524\n' +
    '等级: A1\n' +
    '主缺陷: B22\n' +
    '备注: -\n' +
    '目前内径: 610\n' +
    '是否需改内径: Tidak Perlu\n' +
    '长度: 955米\n\n' +
    'QH2608K2531HA12\n' +
    'S30403\n' +
    '1.24*1524\n' +
    '等级: A1\n' +
    '主缺陷: B22\n' +
    '备注: -\n' +
    '目前内径: 610\n' +
    '是否需改内径: Tidak Perlu\n' +
    '长度: 955米\n\n' +
    'QH2608K2531HA13\n' +
    'S30403\n' +
    '1.24*1524\n' +
    '等级: S\n' +
    '主缺陷: C13\n' +
    '备注: -\n' +
    '目前内径: 610\n' +
    '是否需改内径: Tidak Perlu\n' +
    '长度: 15米\n' +
    '```';
  sendMessage(chatId, text, null, 'Markdown');
}

function handleAboutCommand(chatId) {
  const text = '*' + CONFIG.DEPARTMENT + '*\n*Divisi:* ' + CONFIG.DIVISION + '\n*Versi:* ' + CONFIG.VERSION + '\n\n_"' + CONFIG.MOTTO + '"_';
  sendMessage(chatId, text, null, 'Markdown');
}

function startNewWizard(chatId, userId, messageIdToEdit) {
  clearSession(userId);
  const session = getSession(userId);
  session.step = CONFIG.STEPS.SELECT_MACHINE;
  setSession(userId, session);

  const text = CONFIG.HEADER_TEXT + '\n\nSilakan pilih mesin:';
  const keyboard = {
    inline_keyboard: [
      [
        { text: 'FT', callback_data: 'machine:FT' },
        { text: 'FJ', callback_data: 'machine:FJ' }
      ],
      [{ text: 'Batal', callback_data: 'action:cancel' }]
    ]
  };

  if (messageIdToEdit) {
    editMessageText(chatId, messageIdToEdit, text, keyboard);
  } else {
    sendMessage(chatId, text, keyboard);
  }
}

// ====================== TEXT INPUT HANDLER ======================

function handleTextInput(chatId, userId, text) {
  const cleanText = text.trim();
  const session = getSession(userId);

  switch (session.step) {
    case CONFIG.STEPS.INPUT_SOURCE_COIL: {
      const detection = detectMaterial(cleanText);
      if (!detection.valid) {
        sendMessage(chatId, detection.error);
        return;
      }

      session.sourceCoil = detection.cleanCoil;
      session.materialCode = detection.materialCode;
      session.material = detection.material;
      session.step = CONFIG.STEPS.CONFIRM_MATERIAL;
      setSession(userId, session);

      const confirmMsg = 'Nomor Gulungan: `' + session.sourceCoil + '`\nMaterial Terdeteksi: *' + session.material + '* (Kode: `' + session.materialCode + '`)\n\nApakah data nomor dan material di atas sudah benar?';
      const keyboard = {
        inline_keyboard: [
          [{ text: 'Lanjut', callback_data: 'action:confirm_material' }],
          [{ text: 'Ubah Nomor Gulungan', callback_data: 'action:edit_source_coil' }],
          [{ text: 'Batal', callback_data: 'action:cancel' }]
        ]
      };
      sendMessage(chatId, confirmMsg, keyboard, 'Markdown');
      break;
    }

    case CONFIG.STEPS.INPUT_SPECIFICATION: {
      if (cleanText.length < 3) {
        sendMessage(chatId, 'Spesifikasi terlalu pendek. Contoh format: 1.24*1524');
        return;
      }
      session.specification = cleanText;
      session.step = CONFIG.STEPS.INPUT_COUNT;
      setSession(userId, session);

      const msg = 'Spesifikasi tersimpan: `' + cleanText + '`\n\nSilakan masukkan jumlah gulungan baru yang akan dibuat (bilangan bulat positif):\n(Contoh: `3`)';
      sendMessage(chatId, msg, { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
      break;
    }

    case CONFIG.STEPS.INPUT_COUNT: {
      const count = parseInt(cleanText, 10);
      if (isNaN(count) || count < 1) {
        sendMessage(chatId, 'Jumlah gulungan harus berupa bilangan bulat positif minimal 1.');
        return;
      }
      session.count = count;
      session.step = CONFIG.STEPS.INPUT_START_DIGIT;
      setSession(userId, session);

      const msg = 'Jumlah gulungan: *' + count + '*\n\nSilakan masukkan digit awal penomoran suffix HA (0–9):\n(Contoh: `1`)';
      sendMessage(chatId, msg, { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
      break;
    }

    case CONFIG.STEPS.INPUT_START_DIGIT: {
      const startDigit = parseInt(cleanText, 10);
      if (isNaN(startDigit) || startDigit < 0 || startDigit > 9) {
        sendMessage(chatId, 'Digit awal harus bernilai 0 sampai 9.');
        return;
      }

      const numbering = generateCoilNumbers(session.sourceCoil, session.count, startDigit);
      if (!numbering.valid) {
        sendMessage(chatId, numbering.error);
        return;
      }

      session.startDigit = startDigit;
      session.generatedCoils = numbering.coils;
      session.step = CONFIG.STEPS.PREVIEW_NUMBERING;
      setSession(userId, session);

      const lines = ['Nomor gulungan yang akan dibuat:\n'];
      numbering.coils.forEach(function(c, i) {
        lines.push((i + 1) + '. ' + c);
      });
      lines.push('\nMaterial: ' + session.material);

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Konfirmasi', callback_data: 'action:confirm_numbering' }],
          [{ text: 'Edit Penomoran', callback_data: 'action:edit_numbering' }],
          [{ text: 'Batal', callback_data: 'action:cancel' }]
        ]
      };
      sendMessage(chatId, lines.join('\n'), keyboard);
      break;
    }

    case CONFIG.STEPS.INPUT_COIL_DEFECT: {
      const defect = cleanText.toUpperCase();
      session.currentCoilData.mainDefect = defect;
      session.step = CONFIG.STEPS.INPUT_COIL_REMARK;
      setSession(userId, session);

      const currentCoil = session.generatedCoils[session.currentCoilIndex];
      const header = '[Coil ' + (session.currentCoilIndex + 1) + ' / ' + session.generatedCoils.length + ']: `' + currentCoil + '`\nCacat Utama: *' + defect + '*\n\nSilakan masukkan Remark (keterangan):\n(Ketik `-` atau gunakan tombol di bawah jika tidak ada)';
      const keyboard = {
        inline_keyboard: [
          [{ text: 'Tanpa Remark (-)', callback_data: 'remark:default' }],
          [{ text: 'Batal', callback_data: 'action:cancel' }]
        ]
      };
      sendMessage(chatId, header, keyboard, 'Markdown');
      break;
    }

    case CONFIG.STEPS.INPUT_COIL_REMARK: {
      const remark = (!cleanText || cleanText === '-') ? '-' : cleanText;
      session.currentCoilData.remark = remark;
      session.step = CONFIG.STEPS.INPUT_COIL_LENGTH;
      setSession(userId, session);

      const currentCoil = session.generatedCoils[session.currentCoilIndex];
      const header = '[Coil ' + (session.currentCoilIndex + 1) + ' / ' + session.generatedCoils.length + ']: `' + currentCoil + '`\nRemark: *' + remark + '*\n\nSilakan masukkan Panjang gulungan dalam meter:\n(Contoh: `955`)';
      sendMessage(chatId, header, { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
      break;
    }

    case CONFIG.STEPS.INPUT_COIL_LENGTH: {
      const len = parseInt(cleanText, 10);
      if (isNaN(len) || len <= 0) {
        sendMessage(chatId, 'Panjang harus berupa angka positif dalam satuan meter (contoh: 955).');
        return;
      }

      session.currentCoilData.length = len;
      session.step = CONFIG.STEPS.INPUT_COIL_DIAMETER;
      setSession(userId, session);

      promptCoilDiameter(chatId, session);
      break;
    }

    case CONFIG.STEPS.EDIT_INPUT_VALUE: {
      handleEditValueInput(chatId, userId, cleanText);
      break;
    }

    default:
      sendMessage(chatId, 'Silakan ketik /new untuk membuat form baru atau /help untuk panduan.');
      break;
  }
}

function promptCoilDiameter(chatId, session) {
  const currentCoil = session.generatedCoils[session.currentCoilIndex];
  const progress = '[Coil ' + (session.currentCoilIndex + 1) + ' / ' + session.generatedCoils.length + ']: `' + currentCoil + '`';

  if (session.machine === 'FT') {
    const text = progress + '\n\n目前内径: 610\n\nApakah perlu ubah diameter menjadi 508?';
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Perlu Ubah Diameter 508', callback_data: 'diameter:508' }],
        [{ text: 'Tidak Perlu', callback_data: 'diameter:no' }],
        [{ text: 'Batal', callback_data: 'action:cancel' }]
      ]
    };
    sendMessage(chatId, text, keyboard, 'Markdown');
  } else {
    const text = progress + '\n\nPilih diameter dalam saat ini (目前内径):';
    const keyboard = {
      inline_keyboard: [
        [
          { text: '610', callback_data: 'diameter:610' },
          { text: '508', callback_data: 'diameter:508' }
        ],
        [{ text: 'Batal', callback_data: 'action:cancel' }]
      ]
    };
    sendMessage(chatId, text, keyboard, 'Markdown');
  }
}

// =================== CALLBACK QUERY HANDLER ===================

function handleCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const session = getSession(userId);

  answerCallbackQuery(callbackQuery.id);

  if (data === 'cmd:material') {
    handleMaterialCommand(chatId);
    return;
  }

  if (data === 'cmd:help') {
    handleHelpCommand(chatId);
    return;
  }

  if (data === 'action:new_form') {
    startNewWizard(chatId, userId, messageId);
    return;
  }

  if (data === 'action:cancel') {
    clearSession(userId);
    editMessageText(chatId, messageId, '❌ Sesi telah dibatalkan. Ketik /new untuk memulai kembali.');
    return;
  }

  if (data.indexOf('machine:') === 0) {
    const machine = data.split(':')[1];
    session.machine = machine;
    session.step = CONFIG.STEPS.INPUT_SOURCE_COIL;
    setSession(userId, session);

    const text = 'Mesin terpilih: *' + machine + '*\n\nSilakan masukkan nomor gulungan asal:\n(Contoh: `QH2608K2531HA10`)';
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Kembali', callback_data: 'action:back_to_machine' }],
        [{ text: 'Batal', callback_data: 'action:cancel' }]
      ]
    };
    editMessageText(chatId, messageId, text, keyboard, 'Markdown');
    return;
  }

  if (data === 'action:back_to_machine') {
    startNewWizard(chatId, userId, messageId);
    return;
  }

  if (data === 'action:confirm_material') {
    session.step = CONFIG.STEPS.INPUT_SPECIFICATION;
    setSession(userId, session);

    const text = 'Nomor Gulungan: `' + session.sourceCoil + '`\nMaterial: *' + session.material + '*\n\nSilakan masukkan spesifikasi asal gulungan:\n(Contoh: `1.24*1524`)';
    editMessageText(chatId, messageId, text, { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
    return;
  }

  if (data === 'action:edit_source_coil') {
    session.step = CONFIG.STEPS.INPUT_SOURCE_COIL;
    setSession(userId, session);
    editMessageText(chatId, messageId, 'Silakan masukkan kembali nomor gulungan asal:\n(Contoh: `QH2608K2531HA10`)', { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
    return;
  }

  if (data === 'action:confirm_numbering') {
    session.step = CONFIG.STEPS.INPUT_COIL_GRADE;
    session.currentCoilIndex = 0;
    session.currentCoilData = { coilNumber: session.generatedCoils[0] };
    session.inspections = [];
    setSession(userId, session);

    const firstCoil = session.generatedCoils[0];
    const text = 'Penomoran dikonfirmasi!\n\nLanjut ke data inspeksi:\n[Coil 1 / ' + session.generatedCoils.length + ']: `' + firstCoil + '`\nSilakan pilih Grade:';
    const keyboard = {
      inline_keyboard: [
        CONFIG.VALID_GRADES.map(function(g) { return { text: g, callback_data: 'grade:' + g }; }),
        [{ text: 'Batal', callback_data: 'action:cancel' }]
      ]
    };
    editMessageText(chatId, messageId, text, keyboard, 'Markdown');
    return;
  }

  if (data === 'action:edit_numbering') {
    session.step = CONFIG.STEPS.INPUT_COUNT;
    setSession(userId, session);
    editMessageText(chatId, messageId, 'Silakan masukkan kembali jumlah gulungan yang akan dibuat:\n(Contoh: `3`)', { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
    return;
  }

  if (data.indexOf('grade:') === 0) {
    const grade = data.split(':')[1];
    session.currentCoilData.grade = grade;
    session.currentCoilData.coilNumber = session.generatedCoils[session.currentCoilIndex];
    session.step = CONFIG.STEPS.INPUT_COIL_DEFECT;
    setSession(userId, session);

    const currentCoil = session.generatedCoils[session.currentCoilIndex];
    const text = '[Coil ' + (session.currentCoilIndex + 1) + ' / ' + session.generatedCoils.length + ']: `' + currentCoil + '`\nGrade: *' + grade + '*\n\nSilakan masukkan Cacat Utama (Main Defect):\n(Contoh: `B22`, `R20`, `D02`, `C13`)';
    editMessageText(chatId, messageId, text, { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
    return;
  }

  if (data === 'remark:default') {
    session.currentCoilData.remark = '-';
    session.step = CONFIG.STEPS.INPUT_COIL_LENGTH;
    setSession(userId, session);

    const currentCoil = session.generatedCoils[session.currentCoilIndex];
    const text = '[Coil ' + (session.currentCoilIndex + 1) + ' / ' + session.generatedCoils.length + ']: `' + currentCoil + '`\nRemark: *-\*\n\nSilakan masukkan Panjang gulungan (dalam meter):\n(Contoh: `955`)';
    editMessageText(chatId, messageId, text, { inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]] }, 'Markdown');
    return;
  }

  if (data.indexOf('diameter:') === 0) {
    const val = data.split(':')[1];
    const resolved = resolveDiameter(session.machine, val);

    session.currentCoilData.diameter = resolved.diameter;
    session.currentCoilData.changeDiameter = resolved.changeDiameter;

    session.inspections[session.currentCoilIndex] = session.currentCoilData;
    const nextIdx = session.currentCoilIndex + 1;

    if (nextIdx < session.generatedCoils.length) {
      session.currentCoilIndex = nextIdx;
      session.currentCoilData = { coilNumber: session.generatedCoils[nextIdx] };
      session.step = CONFIG.STEPS.INPUT_COIL_GRADE;
      setSession(userId, session);

      const nextCoil = session.generatedCoils[nextIdx];
      const text = 'Coil ' + nextIdx + ' selesai!\n\nLanjut ke [Coil ' + (nextIdx + 1) + ' / ' + session.generatedCoils.length + ']: `' + nextCoil + '`\nSilakan pilih Grade:';
      const keyboard = {
        inline_keyboard: [
          CONFIG.VALID_GRADES.map(function(g) { return { text: g, callback_data: 'grade:' + g }; }),
          [{ text: 'Batal', callback_data: 'action:cancel' }]
        ]
      };
      editMessageText(chatId, messageId, text, keyboard, 'Markdown');
    } else {
      session.step = CONFIG.STEPS.PREVIEW_FULL_FORM;
      setSession(userId, session);
      showFullPreviewScreen(chatId, userId, messageId);
    }
    return;
  }

  if (data === 'action:generate_final') {
    const finalMandarin = generateWorkplaceMandarinOutput(session);
    const successMsg = '✅ *FORM BERHASIL DIGENERATE*\n' + CONFIG.HEADER_TEXT + '\n\nSilakan salin teks di bawah ini:';
    editMessageText(chatId, messageId, successMsg, null, 'Markdown');

    const codeBlock = '```text\n' + finalMandarin + '\n```';
    sendMessage(chatId, codeBlock, {
      inline_keyboard: [[{ text: '➕ Buat Form Baru (/new)', callback_data: 'action:new_form' }]]
    }, 'Markdown');

    clearSession(userId);
    return;
  }

  // Edit Handlers
  if (data === 'edit:source_coil') {
    session.step = CONFIG.STEPS.INPUT_SOURCE_COIL;
    setSession(userId, session);
    sendMessage(chatId, 'Silakan masukkan nomor gulungan asal baru:\n(Contoh: `QH2608K2531HA10`)', null, 'Markdown');
    return;
  }

  if (data === 'edit:specification') {
    session.step = CONFIG.STEPS.EDIT_INPUT_VALUE;
    session.editTarget = { field: 'specification' };
    setSession(userId, session);
    sendMessage(chatId, 'Silakan masukkan spesifikasi baru (contoh: 1.24*1524):', null, 'Markdown');
    return;
  }

  if (data === 'edit:select_coil') {
    session.step = CONFIG.STEPS.EDIT_SELECT_COIL;
    setSession(userId, session);
    const buttons = session.inspections.map(function(c, i) {
      return [{ text: 'Coil ' + (i + 1) + ': ' + c.coilNumber, callback_data: 'edit_coil:' + i }];
    });
    buttons.push([{ text: 'Kembali ke Preview', callback_data: 'action:back_to_full_preview' }]);
    editMessageText(chatId, messageId, 'Pilih coil yang ingin diubah datanya:', { inline_keyboard: buttons });
    return;
  }

  if (data.indexOf('edit_coil:') === 0) {
    const coilIdx = parseInt(data.split(':')[1], 10);
    session.step = CONFIG.STEPS.EDIT_SELECT_FIELD;
    session.editTarget = { coilIndex: coilIdx };
    setSession(userId, session);

    const targetCoil = session.inspections[coilIdx];
    const text = 'Edit data untuk *Coil ' + (coilIdx + 1) + ' (' + targetCoil.coilNumber + ')*:\nPilih bagian yang ingin diubah:';
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Grade', callback_data: 'edit_field:grade' },
          { text: 'Cacat Utama', callback_data: 'edit_field:defect' }
        ],
        [
          { text: 'Remark', callback_data: 'edit_field:remark' },
          { text: 'Panjang', callback_data: 'edit_field:length' }
        ],
        [
          { text: 'Diameter', callback_data: 'edit_field:diameter' },
          { text: 'Kembali', callback_data: 'action:back_to_full_preview' }
        ]
      ]
    };
    editMessageText(chatId, messageId, text, keyboard, 'Markdown');
    return;
  }

  if (data.indexOf('edit_field:') === 0) {
    const field = data.split(':')[1];
    promptEditFieldValue(chatId, userId, messageId, field);
    return;
  }

  if (data.indexOf('edit_val:') === 0) {
    handleEditCallbackSelection(chatId, userId, messageId, data);
    return;
  }

  if (data === 'action:back_to_full_preview') {
    showFullPreviewScreen(chatId, userId, messageId);
    return;
  }
}

function showFullPreviewScreen(chatId, userId, messageId) {
  const session = getSession(userId);
  const previewText = formatFullPreview(session);
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Konfirmasi & Generate Output', callback_data: 'action:generate_final' }],
      [
        { text: '✏️ Edit Nomor', callback_data: 'edit:source_coil' },
        { text: '✏️ Edit Spesifikasi', callback_data: 'edit:specification' }
      ],
      [
        { text: '✏️ Edit Data Coil', callback_data: 'edit:select_coil' },
        { text: '❌ Batal', callback_data: 'action:cancel' }
      ]
    ]
  };

  if (messageId) {
    editMessageText(chatId, messageId, previewText, keyboard, 'Markdown');
  } else {
    sendMessage(chatId, previewText, keyboard, 'Markdown');
  }
}

function promptEditFieldValue(chatId, userId, messageId, field) {
  const session = getSession(userId);
  const coilIdx = session.editTarget ? session.editTarget.coilIndex : 0;
  const coil = session.inspections[coilIdx];

  session.step = CONFIG.STEPS.EDIT_INPUT_VALUE;
  session.editTarget.field = field;
  setSession(userId, session);

  if (field === 'grade') {
    const text = 'Pilih Grade baru untuk `' + coil.coilNumber + '`:';
    const keyboard = {
      inline_keyboard: [
        CONFIG.VALID_GRADES.map(function(g) { return { text: g, callback_data: 'edit_val:grade:' + g }; }),
        [{ text: 'Batal Edit', callback_data: 'action:back_to_full_preview' }]
      ]
    };
    editMessageText(chatId, messageId, text, keyboard, 'Markdown');
    return;
  }

  if (field === 'diameter') {
    if (session.machine === 'FT') {
      const text = 'Ubah diameter untuk `' + coil.coilNumber + '`:\n\n目前内径: 610\n\nApakah perlu ubah diameter menjadi 508?';
      const keyboard = {
        inline_keyboard: [
          [{ text: 'Perlu Ubah Diameter 508', callback_data: 'edit_val:diameter:508' }],
          [{ text: 'Tidak Perlu', callback_data: 'edit_val:diameter:no' }],
          [{ text: 'Batal Edit', callback_data: 'action:back_to_full_preview' }]
        ]
      };
      editMessageText(chatId, messageId, text, keyboard, 'Markdown');
    } else {
      const text = 'Pilih diameter dalam saat ini (目前内径) untuk `' + coil.coilNumber + '`:';
      const keyboard = {
        inline_keyboard: [
          [
            { text: '610', callback_data: 'edit_val:diameter:610' },
            { text: '508', callback_data: 'edit_val:diameter:508' }
          ],
          [{ text: 'Batal Edit', callback_data: 'action:back_to_full_preview' }]
        ]
      };
      editMessageText(chatId, messageId, text, keyboard, 'Markdown');
    }
    return;
  }

  if (field === 'defect') {
    sendMessage(chatId, 'Masukkan Cacat Utama baru untuk `' + coil.coilNumber + '` (contoh: B22):', null, 'Markdown');
    return;
  }

  if (field === 'remark') {
    sendMessage(chatId, 'Masukkan Remark baru untuk `' + coil.coilNumber + '` (ketik `-` jika kosong):', {
      inline_keyboard: [[{ text: 'Tanpa Remark (-)', callback_data: 'edit_val:remark:default' }]]
    }, 'Markdown');
    return;
  }

  if (field === 'length') {
    sendMessage(chatId, 'Masukkan Panjang baru dalam meter untuk `' + coil.coilNumber + '` (contoh: 955):', null, 'Markdown');
    return;
  }
}

function handleEditCallbackSelection(chatId, userId, messageId, data) {
  const parts = data.split(':');
  const field = parts[1];
  const val = parts[2];

  const session = getSession(userId);
  const coilIdx = session.editTarget ? session.editTarget.coilIndex : 0;
  const target = session.inspections[coilIdx];

  if (field === 'grade') {
    target.grade = val;
  } else if (field === 'diameter') {
    const resolved = resolveDiameter(session.machine, val);
    target.diameter = resolved.diameter;
    target.changeDiameter = resolved.changeDiameter;
  } else if (field === 'remark') {
    target.remark = '-';
  }

  session.inspections[coilIdx] = target;
  setSession(userId, session);

  showFullPreviewScreen(chatId, userId, messageId);
}

function handleEditValueInput(chatId, userId, text) {
  const session = getSession(userId);
  const field = session.editTarget ? session.editTarget.field : null;
  const coilIdx = session.editTarget ? session.editTarget.coilIndex : 0;

  if (field === 'specification') {
    if (text.length < 3) {
      sendMessage(chatId, 'Format spesifikasi terlalu pendek. Contoh: 1.24*1524');
      return;
    }
    session.specification = text;
    setSession(userId, session);
    sendMessage(chatId, '✅ Spesifikasi berhasil diperbarui menjadi `' + text + '`.', null, 'Markdown');
    showFullPreviewScreen(chatId, userId);
    return;
  }

  const target = session.inspections[coilIdx];
  if (field === 'defect') {
    target.mainDefect = text.toUpperCase();
  } else if (field === 'remark') {
    target.remark = (text === '' || text === '-') ? '-' : text;
  } else if (field === 'length') {
    const len = parseInt(text, 10);
    if (isNaN(len) || len <= 0) {
      sendMessage(chatId, 'Panjang harus berupa angka positif.');
      return;
    }
    target.length = len;
  }

  session.inspections[coilIdx] = target;
  setSession(userId, session);

  sendMessage(chatId, '✅ Data berhasil diperbarui untuk `' + target.coilNumber + '`.', null, 'Markdown');
  showFullPreviewScreen(chatId, userId);
}

// ======================== WEBHOOK ENDPOINTS ========================

/**
 * Webhook Telegram Receiver (POST)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('No content').setMimeType(ContentService.MimeType.TEXT);
    }

    const update = JSON.parse(e.postData.contents);
    const updateId = update.update_id;

    // Idempotency: Jika update_id sudah diproses, abaikan
    if (isUpdateProcessed(updateId)) {
      Logger.log('Duplicate update_id: ' + updateId + ' - Ignored.');
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }
    markUpdateProcessed(updateId);

    // Penanganan Callback Query (Inline Button Click)
    if (update.callback_query) {
      handleCallbackQuery(update.callback_query);
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }

    // Penanganan Pesan Teks
    if (update.message && update.message.text) {
      const text = update.message.text.trim();
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;

      if (text === '/start') {
        handleStartCommand(chatId);
      } else if (text === '/new') {
        startNewWizard(chatId, userId);
      } else if (text === '/help') {
        handleHelpCommand(chatId);
      } else if (text === '/material') {
        handleMaterialCommand(chatId);
      } else if (text === '/example') {
        handleExampleCommand(chatId);
      } else if (text === '/about') {
        handleAboutCommand(chatId);
      } else if (text === '/cancel') {
        clearSession(userId);
        sendMessage(chatId, '❌ Sesi form telah dibatalkan. Ketik /new untuk mulai kembali.');
      } else {
        handleTextInput(chatId, userId, text);
      }
    }

    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log('Error in doPost: ' + err.toString());
    return ContentService.createTextOutput('Error: ' + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Health check endpoint (GET)
 */
function doGet(e) {
  const info = {
    status: 'online',
    department: CONFIG.DEPARTMENT,
    division: CONFIG.DIVISION,
    version: CONFIG.VERSION,
    motto: CONFIG.MOTTO
  };
  return ContentService.createTextOutput(JSON.stringify(info, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// ======================== SETUP WEBHOOK HELPER ========================

/**
 * Jalankan fungsi ini SATU KALI di editor Google Apps Script setelah deploy Web App
 * untuk mendaftarkan URL Web App ke Telegram secara otomatis!
 */
function setupWebhook() {
  const token = getBotToken();
  const webAppUrl = ScriptApp.getService().getUrl();
  
  if (!webAppUrl || webAppUrl.indexOf('https') !== 0) {
    throw new Error('Web App belum di-deploy! Silakan Deploy -> New deployment -> Web app terlebih dahulu.');
  }

  const url = 'https://api.telegram.org/bot' + token + '/setWebhook?url=' + encodeURIComponent(webAppUrl);
  const response = UrlFetchApp.fetch(url);
  Logger.log('Setup Webhook Result: ' + response.getContentText());
  return response.getContentText();
}

/**
 * Cek status webhook yang sedang aktif di Telegram
 */
function getWebhookInfo() {
  const token = getBotToken();
  const url = 'https://api.telegram.org/bot' + token + '/getWebhookInfo';
  const response = UrlFetchApp.fetch(url);
  Logger.log('Webhook Info: ' + response.getContentText());
  return response.getContentText();
}

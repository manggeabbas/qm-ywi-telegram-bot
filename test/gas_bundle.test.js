import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Google Apps Script Bundle.gs - Mock Execution & Verification', async () => {
  const code = fs.readFileSync(new URL('../google-apps-script/Bundle.gs', import.meta.url), 'utf8');

  // Mocks untuk Google Apps Script Environment
  const cacheStorage = new Map();
  const logs = [];
  const telegramCalls = [];

  const mockCache = {
    get: (key) => cacheStorage.get(key) || null,
    put: (key, value) => cacheStorage.set(key, String(value)),
    remove: (key) => cacheStorage.delete(key)
  };

  const mockProperties = {
    getProperty: (key) => {
      if (key === 'TELEGRAM_BOT_TOKEN') return '123456:MOCK_TOKEN';
      return null;
    }
  };

  const context = {
    PropertiesService: {
      getScriptProperties: () => mockProperties
    },
    CacheService: {
      getScriptCache: () => mockCache
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        telegramCalls.push({ url, options: options ? { ...options, payload: JSON.parse(options.payload || '{}') } : null });
        return {
          getContentText: () => JSON.stringify({ ok: true, result: true })
        };
      }
    },
    ContentService: {
      MimeType: { TEXT: 'text/plain', JSON: 'application/json' },
      createTextOutput: (text) => ({
        text,
        setMimeType: (mime) => ({ text, mime })
      })
    },
    Logger: {
      log: (...args) => logs.push(args.join(' '))
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/ABC/exec' })
    },
    console: console,
    JSON: JSON,
    parseInt: parseInt,
    isNaN: isNaN,
    String: String,
    Object: Object,
    encodeURIComponent: encodeURIComponent
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  // 1. Uji doGet
  const getRes = context.doGet({});
  const parsedGet = JSON.parse(getRes.text);
  assert.equal(parsedGet.status, 'online');
  assert.equal(parsedGet.division, 'QM-YWI');
  assert.equal(parsedGet.version, '2.1');

  // 2. Uji doPost /start
  telegramCalls.length = 0;
  const startEvent = {
    postData: {
      contents: JSON.stringify({
        update_id: 101,
        message: {
          chat: { id: 888 },
          from: { id: 888 },
          text: '/start'
        }
      })
    }
  };
  context.doPost(startEvent);
  assert.equal(telegramCalls.length, 1);
  assert.match(telegramCalls[0].options.payload.text, /Department of Quality Management/);
  assert.match(telegramCalls[0].options.payload.text, /Periksa dengan teliti, Pastikan Sempurna!/);

  // 3. Uji Idempotensi (update_id ganda diabaikan)
  telegramCalls.length = 0;
  context.doPost(startEvent); // kirim ulang update_id 101
  assert.equal(telegramCalls.length, 0); // diabaikan, tidak ada panggilan ke Telegram

  // 4. Uji Wizard Lengkap via doPost
  // Step A: /new
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 102,
        message: { chat: { id: 888 }, from: { id: 888 }, text: '/new' }
      })
    }
  });

  // Step B: Pilih mesin FT
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 103,
        callback_query: {
          id: 'cb1',
          from: { id: 888 },
          message: { chat: { id: 888 }, message_id: 10 },
          data: 'machine:FT'
        }
      })
    }
  });

  // Step C: Masukkan nomor gulungan asal
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 104,
        message: { chat: { id: 888 }, from: { id: 888 }, text: 'QH2608K2531HA10' }
      })
    }
  });

  // Step D: Konfirmasi Material
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 105,
        callback_query: {
          id: 'cb2',
          from: { id: 888 },
          message: { chat: { id: 888 }, message_id: 11 },
          data: 'action:confirm_material'
        }
      })
    }
  });

  // Step E: Masukkan spesifikasi
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 106,
        message: { chat: { id: 888 }, from: { id: 888 }, text: '1.24*1524' }
      })
    }
  });

  // Step F: Masukkan jumlah (3)
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 107,
        message: { chat: { id: 888 }, from: { id: 888 }, text: '3' }
      })
    }
  });

  // Step G: Masukkan digit awal (1) -> generate HA11, HA12, HA13
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 108,
        message: { chat: { id: 888 }, from: { id: 888 }, text: '1' }
      })
    }
  });

  // Step H: Konfirmasi Penomoran
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 109,
        callback_query: {
          id: 'cb3',
          from: { id: 888 },
          message: { chat: { id: 888 }, message_id: 12 },
          data: 'action:confirm_numbering'
        }
      })
    }
  });

  // --- COIL 1: Grade A1, Cacat B22, Remark -, Panjang 955, Diameter Tidak Perlu ---
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 110, callback_query: { id: 'cb4', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 13 }, data: 'grade:A1' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 111, message: { chat: { id: 888 }, from: { id: 888 }, text: 'B22' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 112, callback_query: { id: 'cb5', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 14 }, data: 'remark:default' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 113, message: { chat: { id: 888 }, from: { id: 888 }, text: '955' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 114, callback_query: { id: 'cb6', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 15 }, data: 'diameter:no' } }) }
  });

  // --- COIL 2: Grade A1, Cacat B22, Remark -, Panjang 955, Diameter Tidak Perlu ---
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 115, callback_query: { id: 'cb7', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 16 }, data: 'grade:A1' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 116, message: { chat: { id: 888 }, from: { id: 888 }, text: 'B22' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 117, callback_query: { id: 'cb8', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 17 }, data: 'remark:default' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 118, message: { chat: { id: 888 }, from: { id: 888 }, text: '955' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 119, callback_query: { id: 'cb9', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 18 }, data: 'diameter:no' } }) }
  });

  // --- COIL 3: Grade S, Cacat C13, Remark -, Panjang 15, Diameter Tidak Perlu ---
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 120, callback_query: { id: 'cb10', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 19 }, data: 'grade:S' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 121, message: { chat: { id: 888 }, from: { id: 888 }, text: 'C13' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 122, callback_query: { id: 'cb11', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 20 }, data: 'remark:default' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 123, message: { chat: { id: 888 }, from: { id: 888 }, text: '15' } }) }
  });
  context.doPost({
    postData: { contents: JSON.stringify({ update_id: 124, callback_query: { id: 'cb12', from: { id: 888 }, message: { chat: { id: 888 }, message_id: 21 }, data: 'diameter:no' } }) }
  });

  // Sekarang state berada di PREVIEW_FULL_FORM, lakukan konfirmasi akhir
  telegramCalls.length = 0;
  context.doPost({
    postData: {
      contents: JSON.stringify({
        update_id: 125,
        callback_query: {
          id: 'cb13',
          from: { id: 888 },
          message: { chat: { id: 888 }, message_id: 22 },
          data: 'action:generate_final'
        }
      })
    }
  });

  // Periksa output teks Mandarin yang dikirim ke Telegram
  assert.equal(telegramCalls.length, 3); // answerCallbackQuery + editMessageText + sendMessage (codeblock)
  const finalCall = telegramCalls[2];
  const outputText = finalCall.options.payload.text;

  const expectedMandarin = `机组：FT
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
长度: 15米`;

  assert.ok(outputText.includes(expectedMandarin));
});

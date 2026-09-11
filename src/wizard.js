/**
 * State machine and conversational wizard handler for QM-YWI Telegram Form Generator
 */

import { config } from './config.js';
import { sessions } from './state.js';
import {
  validateMachine,
  validateSourceCoil,
  validateSpecification,
  validateCount,
  validateStartDigit,
  validateGrade,
  validateMainDefect,
  validateRemark,
  validateLength,
  VALID_GRADES
} from './validation.js';
import { generateCoilNumbers } from './numbering.js';
import { getDiameterPrompt, resolveDiameter, DIAMETER_CONSTANTS } from './diameter.js';
import {
  formatNumberingPreview,
  formatFullPreview,
  generateWorkplaceMandarinOutput
} from './form.js';

export const STEPS = {
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
};

/**
 * Memulai wizard baru
 */
export async function startNewWizard(ctx, userId) {
  sessions.clear(userId);
  sessions.set(userId, { step: STEPS.SELECT_MACHINE });

  const text = `${config.HEADER_TEXT}\n\nSilakan pilih mesin:`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: 'FT', callback_data: 'machine:FT' },
        { text: 'FJ', callback_data: 'machine:FJ' }
      ],
      [{ text: 'Batal', callback_data: 'action:cancel' }]
    ]
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } else {
    await ctx.reply(text, { reply_markup: keyboard });
  }
}

/**
 * Menangani pemilihan mesin (FT/FJ)
 */
export async function handleMachineSelection(ctx, userId, machine) {
  const check = validateMachine(machine);
  if (!check.valid) {
    await ctx.reply(check.error);
    return;
  }

  sessions.set(userId, {
    machine: check.value,
    step: STEPS.INPUT_SOURCE_COIL
  });

  const text = `Mesin terpilih: *${check.value}*\n\nSilakan masukkan nomor gulungan asal:\n(Contoh: \`QH2608K2531HA10\`)`;
  const keyboard = {
    inline_keyboard: [
      [{ text: 'Kembali', callback_data: 'action:back_to_machine' }],
      [{ text: 'Batal', callback_data: 'action:cancel' }]
    ]
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Menangani input teks pada wizard
 */
export async function handleWizardTextInput(ctx, userId, text) {
  const session = sessions.get(userId);

  switch (session.step) {
    case STEPS.INPUT_SOURCE_COIL: {
      const check = validateSourceCoil(text);
      if (!check.valid) {
        await ctx.reply(check.error);
        return;
      }

      sessions.set(userId, {
        sourceCoil: check.value,
        materialCode: check.materialCode,
        material: check.material,
        step: STEPS.CONFIRM_MATERIAL
      });

      const confirmMsg = `Nomor Gulungan: \`${check.value}\`\nMaterial Terdeteksi: *${check.material}* (Kode: \`${check.materialCode}\`)\n\nApakah data nomor dan material di atas sudah benar?`;
      await ctx.reply(confirmMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Lanjut', callback_data: 'action:confirm_material' }],
            [{ text: 'Ubah Nomor Gulungan', callback_data: 'action:edit_source_coil' }],
            [{ text: 'Batal', callback_data: 'action:cancel' }]
          ]
        }
      });
      break;
    }

    case STEPS.INPUT_SPECIFICATION: {
      const check = validateSpecification(text);
      if (!check.valid) {
        await ctx.reply(check.error);
        return;
      }

      sessions.set(userId, {
        specification: check.value,
        step: STEPS.INPUT_COUNT
      });

      await ctx.reply(`Spesifikasi tersimpan: \`${check.value}\`\n\nSilakan masukkan jumlah gulungan baru yang akan dibuat (bilangan bulat positif):\n(Contoh: \`3\`)`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
        }
      });
      break;
    }

    case STEPS.INPUT_COUNT: {
      const check = validateCount(text);
      if (!check.valid) {
        await ctx.reply(check.error);
        return;
      }

      sessions.set(userId, {
        count: check.value,
        step: STEPS.INPUT_START_DIGIT
      });

      await ctx.reply(`Jumlah gulungan: *${check.value}*\n\nSilakan masukkan digit awal penomoran suffix HA (0–9):\n(Contoh: \`1\`)`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
        }
      });
      break;
    }

    case STEPS.INPUT_START_DIGIT: {
      const check = validateStartDigit(text, session.count);
      if (!check.valid) {
        await ctx.reply(check.error);
        return;
      }

      const numbering = generateCoilNumbers(session.sourceCoil, session.count, check.value);
      if (!numbering.valid) {
        await ctx.reply(numbering.error);
        return;
      }

      sessions.set(userId, {
        startDigit: check.value,
        generatedCoils: numbering.coils,
        step: STEPS.PREVIEW_NUMBERING
      });

      const previewText = formatNumberingPreview(numbering.coils, session.material);
      await ctx.reply(previewText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Konfirmasi', callback_data: 'action:confirm_numbering' }],
            [{ text: 'Edit Penomoran', callback_data: 'action:edit_numbering' }],
            [{ text: 'Batal', callback_data: 'action:cancel' }]
          ]
        }
      });
      break;
    }

    case STEPS.INPUT_COIL_DEFECT: {
      const check = validateMainDefect(text);
      if (!check.valid) {
        await ctx.reply(check.error);
        return;
      }

      const currentCoilData = { ...session.currentCoilData, mainDefect: check.value };
      sessions.set(userId, {
        currentCoilData,
        step: STEPS.INPUT_COIL_REMARK
      });

      const currentCoil = session.generatedCoils[session.currentCoilIndex];
      const coilProgress = `[Coil ${session.currentCoilIndex + 1} / ${session.generatedCoils.length}]: \`${currentCoil}\``;
      await ctx.reply(`${coilProgress}\nCacat Utama: *${check.value}*\n\nSilakan masukkan Remark (keterangan):\n(Ketik \`-\` atau gunakan tombol di bawah jika tidak ada remark)`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Tanpa Remark (-)', callback_data: 'remark:default' }],
            [{ text: 'Batal', callback_data: 'action:cancel' }]
          ]
        }
      });
      break;
    }

    case STEPS.INPUT_COIL_REMARK: {
      const check = validateRemark(text);
      const currentCoilData = { ...session.currentCoilData, remark: check.value };
      sessions.set(userId, {
        currentCoilData,
        step: STEPS.INPUT_COIL_LENGTH
      });

      const currentCoil = session.generatedCoils[session.currentCoilIndex];
      const coilProgress = `[Coil ${session.currentCoilIndex + 1} / ${session.generatedCoils.length}]: \`${currentCoil}\``;
      await ctx.reply(`${coilProgress}\nRemark: *${check.value}*\n\nSilakan masukkan Panjang gulungan (dalam meter):\n(Contoh: \`955\`)`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
        }
      });
      break;
    }

    case STEPS.INPUT_COIL_LENGTH: {
      const check = validateLength(text);
      if (!check.valid) {
        await ctx.reply(check.error);
        return;
      }

      const currentCoilData = { ...session.currentCoilData, length: check.value };
      sessions.set(userId, {
        currentCoilData,
        step: STEPS.INPUT_COIL_DIAMETER
      });

      await showDiameterPrompt(ctx, session, currentCoilData);
      break;
    }

    case STEPS.EDIT_INPUT_VALUE: {
      await handleEditValueInput(ctx, userId, text);
      break;
    }

    default:
      await ctx.reply('Perintah tidak dikenali dalam langkah ini. Ketik /help untuk bantuan atau /cancel untuk membatalkan.');
      break;
  }
}

/**
 * Menampilkan pertanyaan diameter sesuai mesin FT/FJ
 */
async function showDiameterPrompt(ctx, session, currentCoilData) {
  const currentCoil = session.generatedCoils[session.currentCoilIndex];
  const coilProgress = `[Coil ${session.currentCoilIndex + 1} / ${session.generatedCoils.length}]: \`${currentCoil}\``;
  const promptData = getDiameterPrompt(session.machine);

  const keyboardButtons = promptData.options.map(opt => [
    { text: opt.label, callback_data: `diameter:${opt.value}` }
  ]);
  keyboardButtons.push([{ text: 'Batal', callback_data: 'action:cancel' }]);

  await ctx.reply(`${coilProgress}\n\n${promptData.question}`, {
    reply_markup: { inline_keyboard: keyboardButtons }
  });
}

/**
 * Menangani pemilihan Grade per coil
 */
export async function handleGradeSelection(ctx, userId, grade) {
  const check = validateGrade(grade);
  if (!check.valid) {
    await ctx.reply(check.error);
    return;
  }

  const session = sessions.get(userId);
  const currentCoil = session.generatedCoils[session.currentCoilIndex];
  const currentCoilData = {
    ...session.currentCoilData,
    coilNumber: currentCoil,
    grade: check.value
  };

  sessions.set(userId, {
    currentCoilData,
    step: STEPS.INPUT_COIL_DEFECT
  });

  const coilProgress = `[Coil ${session.currentCoilIndex + 1} / ${session.generatedCoils.length}]: \`${currentCoil}\``;
  const text = `${coilProgress}\nGrade: *${check.value}*\n\nSilakan masukkan Cacat Utama (Main Defect):\n(Contoh: \`B22\`, \`R20\`, \`D02\`, \`C13\`)`;

  const keyboard = {
    inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Menangani tombol Remark Default (-)
 */
export async function handleDefaultRemark(ctx, userId) {
  const session = sessions.get(userId);
  const currentCoilData = { ...session.currentCoilData, remark: '-' };
  sessions.set(userId, {
    currentCoilData,
    step: STEPS.INPUT_COIL_LENGTH
  });

  const currentCoil = session.generatedCoils[session.currentCoilIndex];
  const coilProgress = `[Coil ${session.currentCoilIndex + 1} / ${session.generatedCoils.length}]: \`${currentCoil}\``;
  const text = `${coilProgress}\nRemark: *-\*\n\nSilakan masukkan Panjang gulungan (dalam meter):\n(Contoh: \`955\`)`;

  const keyboard = {
    inline_keyboard: [[{ text: 'Batal', callback_data: 'action:cancel' }]]
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Menangani pemilihan Diameter per coil
 */
export async function handleDiameterSelection(ctx, userId, selection) {
  const session = sessions.get(userId);
  const resolved = resolveDiameter(session.machine, selection);

  const completedCoil = {
    ...session.currentCoilData,
    diameter: resolved.diameter,
    changeDiameter: resolved.changeDiameter
  };

  const inspections = [...session.inspections];
  inspections[session.currentCoilIndex] = completedCoil;

  const nextIndex = session.currentCoilIndex + 1;

  if (nextIndex < session.generatedCoils.length) {
    // Lanjut ke coil berikutnya
    sessions.set(userId, {
      inspections,
      currentCoilIndex: nextIndex,
      currentCoilData: { coilNumber: session.generatedCoils[nextIndex] },
      step: STEPS.INPUT_COIL_GRADE
    });

    const nextCoil = session.generatedCoils[nextIndex];
    const text = `Coil ${session.currentCoilIndex + 1} selesai!\n\nLanjut ke [Coil ${nextIndex + 1} / ${session.generatedCoils.length}]: \`${nextCoil}\`\nSilakan pilih Grade:`;
    const keyboard = {
      inline_keyboard: [
        VALID_GRADES.map(g => ({ text: g, callback_data: `grade:${g}` })),
        [{ text: 'Batal', callback_data: 'action:cancel' }]
      ]
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } else {
    // Semua coil selesai, tampilkan preview seluruh form
    sessions.set(userId, {
      inspections,
      step: STEPS.PREVIEW_FULL_FORM
    });

    await showFullPreview(ctx, userId);
  }
}

/**
 * Menampilkan preview seluruh form sebelum output final
 */
export async function showFullPreview(ctx, userId) {
  const session = sessions.get(userId);
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

  if (ctx.callbackQuery) {
    await ctx.editMessageText(previewText, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(previewText, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Menghasilkan output final format Mandarin workplace QM-YWI
 */
export async function generateFinalOutput(ctx, userId) {
  const session = sessions.get(userId);
  const finalOutput = generateWorkplaceMandarinOutput(session);

  const successMsg = `✅ *FORM BERHASIL DIGENERATE*\n${config.HEADER_TEXT}\n\nSilakan salin teks di bawah ini:`;
  const codeBlock = `\`\`\`text\n${finalOutput}\n\`\`\``;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(successMsg, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(successMsg, { parse_mode: 'Markdown' });
  }

  await ctx.reply(codeBlock, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Buat Form Baru (/new)', callback_data: 'action:new_form' }]
      ]
    }
  });

  // Reset sesi setelah output dibuat
  sessions.clear(userId);
}

/**
 * Menangani pemilihan coil untuk diedit
 */
export async function showEditCoilMenu(ctx, userId) {
  const session = sessions.get(userId);
  sessions.set(userId, { step: STEPS.EDIT_SELECT_COIL });

  const buttons = session.inspections.map((coil, idx) => [
    { text: `Coil ${idx + 1}: ${coil.coilNumber}`, callback_data: `edit_coil:${idx}` }
  ]);
  buttons.push([{ text: 'Kembali ke Preview', callback_data: 'action:back_to_full_preview' }]);

  const text = 'Pilih coil yang ingin diubah datanya:';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
  } else {
    await ctx.reply(text, { reply_markup: { inline_keyboard: buttons } });
  }
}

/**
 * Menampilkan pilihan field yang ingin diedit untuk suatu coil
 */
export async function showEditFieldMenu(ctx, userId, coilIndex) {
  const session = sessions.get(userId);
  const targetCoil = session.inspections[coilIndex];
  sessions.set(userId, {
    step: STEPS.EDIT_SELECT_FIELD,
    editTarget: { coilIndex }
  });

  const text = `Edit data untuk *Coil ${coilIndex + 1} (${targetCoil.coilNumber})*:\nPilih bagian yang ingin diubah:`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: 'Grade', callback_data: `edit_field:grade` },
        { text: 'Cacat Utama', callback_data: `edit_field:defect` }
      ],
      [
        { text: 'Remark', callback_data: `edit_field:remark` },
        { text: 'Panjang', callback_data: `edit_field:length` }
      ],
      [
        { text: 'Diameter', callback_data: `edit_field:diameter` },
        { text: 'Kembali', callback_data: 'action:back_to_full_preview' }
      ]
    ]
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * Meminta input nilai baru untuk edit
 */
export async function promptEditValue(ctx, userId, field) {
  const session = sessions.get(userId);
  const coilIndex = session.editTarget?.coilIndex ?? 0;
  const coil = session.inspections[coilIndex];

  sessions.set(userId, {
    step: STEPS.EDIT_INPUT_VALUE,
    editTarget: { coilIndex, field }
  });

  switch (field) {
    case 'grade': {
      const text = `Pilih Grade baru untuk \`${coil.coilNumber}\`:`;
      const keyboard = {
        inline_keyboard: [
          VALID_GRADES.map(g => ({ text: g, callback_data: `edit_grade_val:${g}` })),
          [{ text: 'Batal Edit', callback_data: 'action:back_to_full_preview' }]
        ]
      };
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
      break;
    }

    case 'diameter': {
      const promptData = getDiameterPrompt(session.machine);
      const keyboard = promptData.options.map(opt => [
        { text: opt.label, callback_data: `edit_diameter_val:${opt.value}` }
      ]);
      keyboard.push([{ text: 'Batal Edit', callback_data: 'action:back_to_full_preview' }]);
      const text = `Ubah diameter untuk \`${coil.coilNumber}\`:\n${promptData.question}`;
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
      } else {
        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
      }
      break;
    }

    case 'defect':
      await ctx.reply(`Masukkan Cacat Utama baru untuk \`${coil.coilNumber}\` (contoh: B22):`, { parse_mode: 'Markdown' });
      break;

    case 'remark':
      await ctx.reply(`Masukkan Remark baru untuk \`${coil.coilNumber}\` (ketik \`-\` jika kosong):`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Tanpa Remark (-)', callback_data: 'edit_remark_val:default' }]]
        }
      });
      break;

    case 'length':
      await ctx.reply(`Masukkan Panjang baru dalam meter untuk \`${coil.coilNumber}\` (contoh: 955):`, { parse_mode: 'Markdown' });
      break;

    case 'specification':
      await ctx.reply(`Masukkan Spesifikasi baru (contoh: 1.24*1524):`, { parse_mode: 'Markdown' });
      break;

    default:
      await showFullPreview(ctx, userId);
      break;
  }
}

/**
 * Memproses input teks nilai hasil edit
 */
async function handleEditValueInput(ctx, userId, text) {
  const session = sessions.get(userId);
  const { coilIndex, field } = session.editTarget || {};

  if (field === 'specification') {
    const check = validateSpecification(text);
    if (!check.valid) {
      await ctx.reply(check.error);
      return;
    }
    sessions.set(userId, { specification: check.value });
    await ctx.reply(`✅ Spesifikasi berhasil diperbarui menjadi \`${check.value}\`.`, { parse_mode: 'Markdown' });
    await showFullPreview(ctx, userId);
    return;
  }

  const inspections = [...session.inspections];
  const target = { ...inspections[coilIndex] };

  if (field === 'defect') {
    const check = validateMainDefect(text);
    if (!check.valid) {
      await ctx.reply(check.error);
      return;
    }
    target.mainDefect = check.value;
  } else if (field === 'remark') {
    const check = validateRemark(text);
    target.remark = check.value;
  } else if (field === 'length') {
    const check = validateLength(text);
    if (!check.valid) {
      await ctx.reply(check.error);
      return;
    }
    target.length = check.value;
  }

  inspections[coilIndex] = target;
  sessions.set(userId, { inspections });

  await ctx.reply(`✅ Data ${field} untuk \`${target.coilNumber}\` berhasil diperbarui.`, { parse_mode: 'Markdown' });
  await showFullPreview(ctx, userId);
}

/**
 * Menangani pemilihan nilai edit via inline button (grade/diameter/remark)
 */
export async function handleEditCallbackValue(ctx, userId, field, value) {
  const session = sessions.get(userId);
  const coilIndex = session.editTarget?.coilIndex ?? 0;
  const inspections = [...session.inspections];
  const target = { ...inspections[coilIndex] };

  if (field === 'grade') {
    target.grade = value;
  } else if (field === 'diameter') {
    const resolved = resolveDiameter(session.machine, value);
    target.diameter = resolved.diameter;
    target.changeDiameter = resolved.changeDiameter;
  } else if (field === 'remark') {
    target.remark = '-';
  }

  inspections[coilIndex] = target;
  sessions.set(userId, { inspections });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'Data berhasil diperbarui!' });
  }

  await showFullPreview(ctx, userId);
}

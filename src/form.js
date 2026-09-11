/**
 * Modul format output Mandarin workplace dan preview form QM-YWI
 */

/**
 * Menghasilkan preview nomor gulungan yang akan dibuat (Section 9 PRD)
 * @param {string[]} coils 
 * @param {string} material 
 * @returns {string}
 */
export function formatNumberingPreview(coils, material) {
  const lines = ['Nomor gulungan yang akan dibuat:\n'];
  coils.forEach((coil, idx) => {
    lines.push(`${idx + 1}. ${coil}`);
  });
  lines.push(`\nMaterial: ${material}`);
  return lines.join('\n');
}

/**
 * Menghasilkan output teks final berstandar Mandarin Workplace QM-YWI (Section 13 PRD)
 * 
 * @param {{
 *   machine: string,
 *   sourceCoil: string,
 *   material: string,
 *   specification: string,
 *   inspections: Array<{
 *     coilNumber: string,
 *     grade: string,
 *     mainDefect: string,
 *     remark: string,
 *     diameter: number,
 *     changeDiameter: string,
 *     length: number
 *   }>
 * }} state 
 * @returns {string}
 */
export function generateWorkplaceMandarinOutput(state) {
  const { machine, sourceCoil, material, specification, inspections } = state;

  const header = [
    `机组：${machine}`,
    `${sourceCoil}`,
    `要生成新卷号`
  ].join('\n');

  const coilBlocks = inspections.map((item) => {
    const remark = item.remark && item.remark.trim().length > 0 ? item.remark.trim() : '-';
    return [
      item.coilNumber,
      material,
      specification,
      `等级: ${item.grade}`,
      `主缺陷: ${item.mainDefect}`,
      `备注: ${remark}`,
      `目前内径: ${item.diameter}`,
      `是否需改内径: ${item.changeDiameter}`,
      `长度: ${item.length}米`
    ].join('\n');
  });

  return `${header}\n\n${coilBlocks.join('\n\n')}`;
}

/**
 * Menghasilkan preview seluruh form dalam Bahasa Indonesia sebelum konfirmasi final (Section 12 PRD)
 * 
 * @param {object} state 
 * @returns {string}
 */
export function formatFullPreview(state) {
  const lines = [
    '📋 *PREVIEW DATA INSPEKSI QM-YWI*',
    '----------------------------------------',
    `*Mesin:* ${state.machine}`,
    `*Gulungan Asal:* \`${state.sourceCoil}\``,
    `*Material:* ${state.material} (${state.materialCode})`,
    `*Spesifikasi:* \`${state.specification}\``,
    `*Jumlah Gulungan:* ${state.count} coil`,
    '----------------------------------------'
  ];

  state.inspections.forEach((item, index) => {
    lines.push(`\n🔹 *Coil ${index + 1}: \`${item.coilNumber}\`*`);
    lines.push(`• Grade: *${item.grade}*`);
    lines.push(`• Cacat Utama: *${item.mainDefect}*`);
    lines.push(`• Remark: *${item.remark || '-'}*`);
    lines.push(`• Diameter Dalam: *${item.diameter}*`);
    lines.push(`• Ubah Diameter: *${item.changeDiameter}*`);
    lines.push(`• Panjang: *${item.length}米*`);
  });

  lines.push('\n----------------------------------------');
  lines.push('Periksa seluruh data di atas. Apakah data sudah benar?');

  return lines.join('\n');
}

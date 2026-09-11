/**
 * Modul aturan diameter FT dan FJ untuk QM-YWI
 */

export const DIAMETER_CONSTANTS = {
  FT_DEFAULT_DIAMETER: 610,
  FT_CHANGE_YES: 'Perlu Ubah Diameter 508',
  FT_CHANGE_NO: 'Tidak Perlu',
  FJ_DEFAULT_CHANGE: 'Tidak Perlu',
  FJ_DIAMETER_CHOICES: [610, 508]
};

/**
 * Mendapatkan konfigurasi prompt diameter berdasarkan mesin
 * @param {'FT'|'FJ'} machine 
 */
export function getDiameterPrompt(machine) {
  if (machine === 'FT') {
    return {
      machine: 'FT',
      question: '目前内径: 610\n\nApakah perlu ubah diameter menjadi 508?',
      options: [
        { label: 'Perlu Ubah Diameter 508', value: DIAMETER_CONSTANTS.FT_CHANGE_YES },
        { label: 'Tidak Perlu', value: DIAMETER_CONSTANTS.FT_CHANGE_NO }
      ]
    };
  }

  if (machine === 'FJ') {
    return {
      machine: 'FJ',
      question: 'Pilih diameter dalam saat ini (目前内径):',
      options: [
        { label: '610', value: 610 },
        { label: '508', value: 508 }
      ]
    };
  }

  throw new Error(`Mesin tidak dikenal: ${machine}`);
}

/**
 * Menyelesaikan nilai diameter dan status ubah diameter berdasarkan mesin dan input
 * @param {'FT'|'FJ'} machine 
 * @param {string|number} selection 
 * @returns {{ diameter: number, changeDiameter: string }}
 */
export function resolveDiameter(machine, selection) {
  if (machine === 'FT') {
    const isChange = String(selection).includes('508') || selection === DIAMETER_CONSTANTS.FT_CHANGE_YES;
    return {
      diameter: DIAMETER_CONSTANTS.FT_DEFAULT_DIAMETER,
      changeDiameter: isChange ? DIAMETER_CONSTANTS.FT_CHANGE_YES : DIAMETER_CONSTANTS.FT_CHANGE_NO
    };
  }

  if (machine === 'FJ') {
    const parsed = parseInt(selection, 10);
    const validDiameter = parsed === 508 ? 508 : 610;
    return {
      diameter: validDiameter,
      changeDiameter: DIAMETER_CONSTANTS.FJ_DEFAULT_CHANGE
    };
  }

  throw new Error(`Mesin tidak dikenal: ${machine}`);
}

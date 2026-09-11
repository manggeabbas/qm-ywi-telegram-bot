import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorkplaceMandarinOutput, formatNumberingPreview } from '../src/form.js';

test('Final Workplace Mandarin Output - Sesuai Contoh PRD Section 13', () => {
  const sampleState = {
    machine: 'FT',
    sourceCoil: 'QH2608K2531HA10',
    materialCode: 'K',
    material: 'S30403',
    specification: '1.24*1524',
    count: 3,
    startDigit: 1,
    generatedCoils: [
      'QH2608K2531HA11',
      'QH2608K2531HA12',
      'QH2608K2531HA13'
    ],
    inspections: [
      {
        coilNumber: 'QH2608K2531HA11',
        grade: 'A1',
        mainDefect: 'B22',
        remark: '-',
        diameter: 610,
        changeDiameter: 'Tidak Perlu',
        length: 955
      },
      {
        coilNumber: 'QH2608K2531HA12',
        grade: 'A1',
        mainDefect: 'B22',
        remark: '-',
        diameter: 610,
        changeDiameter: 'Tidak Perlu',
        length: 955
      },
      {
        coilNumber: 'QH2608K2531HA13',
        grade: 'S',
        mainDefect: 'C13',
        remark: '-',
        diameter: 610,
        changeDiameter: 'Tidak Perlu',
        length: 15
      }
    ]
  };

  const expectedOutput = `机组：FT
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

  const actualOutput = generateWorkplaceMandarinOutput(sampleState);
  assert.equal(actualOutput, expectedOutput);
});

test('Numbering Preview - Sesuai Contoh PRD Section 9', () => {
  const coils = [
    'QH2608K2531HA11',
    'QH2608K2531HA12',
    'QH2608K2531HA13'
  ];
  const material = 'S30403';

  const preview = formatNumberingPreview(coils, material);
  assert.match(preview, /Nomor gulungan yang akan dibuat:/);
  assert.match(preview, /1\. QH2608K2531HA11/);
  assert.match(preview, /2\. QH2608K2531HA12/);
  assert.match(preview, /3\. QH2608K2531HA13/);
  assert.match(preview, /Material: S30403/);
});

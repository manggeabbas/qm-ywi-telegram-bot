import test from 'node:test';
import assert from 'node:assert/strict';
import { sessions } from '../src/state.js';
import {
  STEPS,
  startNewWizard,
  handleMachineSelection,
  handleWizardTextInput,
  handleGradeSelection,
  handleDefaultRemark,
  handleDiameterSelection,
  generateFinalOutput
} from '../src/wizard.js';
import { generateWorkplaceMandarinOutput } from '../src/form.js';

function createMockContext() {
  const sentMessages = [];
  return {
    sentMessages,
    from: { id: 12345, username: 'test_inspector' },
    reply: async (text, options) => {
      sentMessages.push({ type: 'reply', text, options });
    },
    editMessageText: async (text, options) => {
      sentMessages.push({ type: 'edit', text, options });
    },
    answerCallbackQuery: async () => {}
  };
}

test('Wizard End-to-End Flow - Simulasi Alur Lengkap QM-YWI', async () => {
  const ctx = createMockContext();
  const userId = ctx.from.id;

  // 1. Start wizard
  await startNewWizard(ctx, userId);
  assert.equal(sessions.get(userId).step, STEPS.SELECT_MACHINE);

  // 2. Select machine FT
  await handleMachineSelection(ctx, userId, 'FT');
  assert.equal(sessions.get(userId).machine, 'FT');
  assert.equal(sessions.get(userId).step, STEPS.INPUT_SOURCE_COIL);

  // 3. Input source coil
  await handleWizardTextInput(ctx, userId, 'QH2608K2531HA10');
  assert.equal(sessions.get(userId).sourceCoil, 'QH2608K2531HA10');
  assert.equal(sessions.get(userId).materialCode, 'K');
  assert.equal(sessions.get(userId).material, 'S30403');
  assert.equal(sessions.get(userId).step, STEPS.CONFIRM_MATERIAL);

  // 4. Confirm material -> move to input spec
  sessions.set(userId, { step: STEPS.INPUT_SPECIFICATION });
  await handleWizardTextInput(ctx, userId, '1.24*1524');
  assert.equal(sessions.get(userId).specification, '1.24*1524');
  assert.equal(sessions.get(userId).step, STEPS.INPUT_COUNT);

  // 5. Input count: 3
  await handleWizardTextInput(ctx, userId, '3');
  assert.equal(sessions.get(userId).count, 3);
  assert.equal(sessions.get(userId).step, STEPS.INPUT_START_DIGIT);

  // 6. Input start digit: 1
  await handleWizardTextInput(ctx, userId, '1');
  assert.equal(sessions.get(userId).startDigit, 1);
  assert.deepEqual(sessions.get(userId).generatedCoils, [
    'QH2608K2531HA11',
    'QH2608K2531HA12',
    'QH2608K2531HA13'
  ]);
  assert.equal(sessions.get(userId).step, STEPS.PREVIEW_NUMBERING);

  // 7. Confirm numbering -> start per-coil inputs
  sessions.set(userId, {
    step: STEPS.INPUT_COIL_GRADE,
    currentCoilIndex: 0,
    currentCoilData: { coilNumber: 'QH2608K2531HA11' },
    inspections: []
  });

  // --- COIL 1 ---
  await handleGradeSelection(ctx, userId, 'A1');
  assert.equal(sessions.get(userId).step, STEPS.INPUT_COIL_DEFECT);

  await handleWizardTextInput(ctx, userId, 'B22');
  assert.equal(sessions.get(userId).step, STEPS.INPUT_COIL_REMARK);

  await handleDefaultRemark(ctx, userId);
  assert.equal(sessions.get(userId).step, STEPS.INPUT_COIL_LENGTH);

  await handleWizardTextInput(ctx, userId, '955');
  assert.equal(sessions.get(userId).step, STEPS.INPUT_COIL_DIAMETER);

  await handleDiameterSelection(ctx, userId, 'Tidak Perlu');
  assert.equal(sessions.get(userId).currentCoilIndex, 1);
  assert.equal(sessions.get(userId).step, STEPS.INPUT_COIL_GRADE);

  // --- COIL 2 ---
  await handleGradeSelection(ctx, userId, 'A1');
  await handleWizardTextInput(ctx, userId, 'B22');
  await handleDefaultRemark(ctx, userId);
  await handleWizardTextInput(ctx, userId, '955');
  await handleDiameterSelection(ctx, userId, 'Tidak Perlu');
  assert.equal(sessions.get(userId).currentCoilIndex, 2);
  assert.equal(sessions.get(userId).step, STEPS.INPUT_COIL_GRADE);

  // --- COIL 3 ---
  await handleGradeSelection(ctx, userId, 'S');
  await handleWizardTextInput(ctx, userId, 'C13');
  await handleDefaultRemark(ctx, userId);
  await handleWizardTextInput(ctx, userId, '15');
  await handleDiameterSelection(ctx, userId, 'Tidak Perlu');

  // Seluruh coil selesai -> step PREVIEW_FULL_FORM
  assert.equal(sessions.get(userId).step, STEPS.PREVIEW_FULL_FORM);
  assert.equal(sessions.get(userId).inspections.length, 3);

  // Verifikasi output akhir
  const output = generateWorkplaceMandarinOutput(sessions.get(userId));
  assert.match(output, /机组：FT/);
  assert.match(output, /QH2608K2531HA10/);
  assert.match(output, /QH2608K2531HA11\nS30403\n1.24\*1524\n等级: A1\n主缺陷: B22\n备注: -\n目前内径: 610\n是否需改内径: Tidak Perlu\n长度: 955米/);
  assert.match(output, /QH2608K2531HA13\nS30403\n1.24\*1524\n等级: S\n主缺陷: C13\n备注: -\n目前内径: 610\n是否需改内径: Tidak Perlu\n长度: 15米/);
});

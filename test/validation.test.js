import test from 'node:test';
import assert from 'node:assert/strict';
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
} from '../src/validation.js';

test('Validation - Mesin FT/FJ', () => {
  assert.equal(validateMachine('FT').valid, true);
  assert.equal(validateMachine('fj').valid, true);
  assert.equal(validateMachine('XX').valid, false);
  assert.equal(validateMachine('').valid, false);
});

test('Validation - Source Coil & Material', () => {
  const valid = validateSourceCoil('QH2608K2531HA10');
  assert.equal(valid.valid, true);
  assert.equal(valid.materialCode, 'K');
  assert.equal(valid.material, 'S30403');

  const invalid = validateSourceCoil('QH2608X2531HA10');
  assert.equal(invalid.valid, false);
});

test('Validation - Spesifikasi', () => {
  assert.equal(validateSpecification('1.24*1524').valid, true);
  assert.equal(validateSpecification('').valid, false);
  assert.equal(validateSpecification('1').valid, false);
});

test('Validation - Jumlah dan Start Digit', () => {
  assert.equal(validateCount(3).valid, true);
  assert.equal(validateCount(0).valid, false);
  assert.equal(validateCount(-1).valid, false);
  assert.equal(validateCount('abc').valid, false);

  assert.equal(validateStartDigit(1, 3).valid, true);
  assert.equal(validateStartDigit(8, 3).valid, false); // 8 + 3 - 1 = 10 > 9
});

test('Validation - Grade (A1, B, B1, R, S)', () => {
  VALID_GRADES.forEach(g => {
    assert.equal(validateGrade(g).valid, true);
    assert.equal(validateGrade(g.toLowerCase()).valid, true);
  });
  assert.equal(validateGrade('C').valid, false);
  assert.equal(validateGrade('A').valid, false);
  assert.equal(validateGrade('').valid, false);
});

test('Validation - Main Defect', () => {
  assert.equal(validateMainDefect('B22').valid, true);
  assert.equal(validateMainDefect('r20').valid, true);
  assert.equal(validateMainDefect('').valid, false);
});

test('Validation - Remark default -', () => {
  assert.equal(validateRemark('').value, '-');
  assert.equal(validateRemark('-').value, '-');
  assert.equal(validateRemark('Ada cacat tepi').value, 'Ada cacat tepi');
});

test('Validation - Panjang dalam meter', () => {
  assert.equal(validateLength('955').valid, true);
  assert.equal(validateLength(955).value, 955);
  assert.equal(validateLength(0).valid, false);
  assert.equal(validateLength(-10).valid, false);
  assert.equal(validateLength('abc').valid, false);
});

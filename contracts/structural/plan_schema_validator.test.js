'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'structural/plan_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const OWNED = ['shape', 'task_structure', 'required_fields', 'enum_validation', 'no_additional_properties', 'canonicalization_consumption'];
const FORBIDDEN = ['dag_validity', 'invariant_references', 'scheduling'];

test('owned responsibilities and boundary metadata are isolated to structural layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^structural\//);
});

test('accepts valid plan schema fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, loadFixture('plan.valid.minimal'));
});

test('rejects invalid plan schema fixtures with structural failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('plan.invalid.missing_required'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
  await expectFailure(validator, loadFixture('plan.invalid.invalid_enum'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for canonicalized plan inputs', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, loadFixture('plan.valid.minimal'));
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'structural/spec_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const OWNED = ['shape', 'required_fields', 'field_types', 'allowed_values', 'no_additional_properties', 'canonicalization_consumption'];
const FORBIDDEN = ['semantic_validation', 'ledger_checks', 'environment_access'];

test('owned responsibilities and boundary metadata are isolated to structural layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^structural\//);
});

test('accepts valid spec schema fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const input = loadFixture('spec.valid.minimal');
  await expectValidResult(validator, input);
});

test('rejects invalid spec schema fixtures with structural failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('spec.invalid.missing_required'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
  await expectFailure(validator, loadFixture('spec.invalid.additional_property'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for canonicalized spec inputs', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, loadFixture('spec.valid.minimal'));
});

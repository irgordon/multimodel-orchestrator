'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'structural/error_object_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const OWNED = ['error_object_shape', 'required_fields', 'no_additional_properties'];
const FORBIDDEN = ['allowed_error_codes', 'semantic_meaning'];

test('owned responsibilities and boundary metadata are isolated to structural layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^structural\//);
});

test('accepts valid error object fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, loadFixture('error_object.valid.structural'));
});

test('rejects invalid error object fixture with structural failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('error_object.invalid.missing_error_code'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

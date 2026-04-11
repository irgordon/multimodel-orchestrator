'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'semantic/error_code_contract_validator';
const FAILURE_CLASS = 'SEMANTIC_INVALID';
const OWNED = ['allowed_error_codes_by_validator_family', 'validator_id_to_error_code_set_mapping', 'emitted_error_code_membership'];
const FORBIDDEN = ['error_object_shape_validation', 'behavior_determinism_validation'];

function validInput() {
  return {
    error_outputs: [
      loadFixture('error.output.structural'),
      loadFixture('error.output.semantic'),
    ],
    error_code_contract: loadFixture('error.contract'),
  };
}

test('owned responsibilities and boundary metadata are isolated to semantic layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^semantic\//);
});

test('accepts valid error code contract fixtures', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects invalid error code usage fixture with semantic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.error_outputs = [{
    validator_id: 'semantic/plan_dag_validator',
    failure_class: 'SEMANTIC_INVALID',
    error_code: 'NOT_ALLOWED',
    message: 'informational',
    details: {},
  }];
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for error code contract validation', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'structural/log_entry_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const OWNED = ['single_log_entry_shape', 'required_fields', 'optional_task_id', 'no_additional_properties'];
const FORBIDDEN = ['append_only_semantics', 'crash_consistency'];

test('owned responsibilities and boundary metadata are isolated to structural layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^structural\//);
});

test('accepts valid log entry fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, loadFixture('log_entry.valid.minimal'));
});

test('rejects invalid log entry fixture with structural failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('log_entry.invalid.missing_checksum'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

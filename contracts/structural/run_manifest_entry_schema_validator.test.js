'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'structural/run_manifest_entry_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const OWNED = ['single_entry_shape', 'required_fields', 'no_additional_properties'];
const FORBIDDEN = ['append_only_semantics', 'checksum_chain', 'crash_consistency'];

test('owned responsibilities and boundary metadata are isolated to structural layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^structural\//);
});

test('accepts valid run manifest entry fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const validEntries = loadFixture('run_manifest.valid.entries');
  await expectValidResult(validator, validEntries[0]);
});

test('rejects invalid run manifest entry fixture with structural failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalidEntries = loadFixture('run_manifest.invalid.entry_missing_required');
  await expectFailure(validator, invalidEntries[0], { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

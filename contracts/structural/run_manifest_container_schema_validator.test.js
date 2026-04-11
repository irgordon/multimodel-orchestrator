'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'structural/run_manifest_container_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const OWNED = ['container_shape', 'array_container', 'object_entries_only'];
const FORBIDDEN = ['entry_schema_validation', 'append_only_semantics', 'checksum_chain', 'crash_consistency'];

test('owned responsibilities and boundary metadata are isolated to structural layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^structural\//);
});

test('accepts valid run manifest container fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, [
    { sequence_number: 1, event_type: 'run_started' },
    { sequence_number: 2, event_type: 'task_completed' },
  ]);
});

test('rejects invalid run manifest container with structural failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, { entries: [] }, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
  await expectFailure(validator, [{ sequence_number: 1 }, 'invalid'], { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for identical run manifest container inputs', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const input = [{ sequence_number: 1, event_type: 'run_started' }];
  await assertDeterministic(validator, input);
});

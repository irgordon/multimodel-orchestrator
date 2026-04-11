'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'safety/atomic_write_validator';
const FAILURE_CLASS = 'SAFETY_VIOLATION';
const OWNED = ['atomic_write_behavior', 'no_partial_writes_visible', 'crash_simulation_around_write_boundaries'];
const FORBIDDEN = ['schema_validation', 'dag_validation', 'scheduler_output_validation'];

function validInput() {
  return {
    write_sequence: loadFixture('safety.write_sequence.atomic'),
    crash_trace: loadFixture('safety.crash_trace.atomic'),
    workspace: loadFixture('snapshots.workspace.sample'),
  };
}

test('owned responsibilities and boundary metadata are isolated to safety layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^safety\//);
});

test('accepts valid atomic write fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects partial-write-visible fixture with safety failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.crash_trace.expected = 'partial_visible';
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for crash simulation outcomes', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

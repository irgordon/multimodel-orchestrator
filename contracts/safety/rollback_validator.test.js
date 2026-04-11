'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'safety/rollback_validator';
const FAILURE_CLASS = 'SAFETY_VIOLATION';
const OWNED = ['rollback_scope_correctness', 'restore_pre_write_state', 'cleanup_temp_artifacts', 'rollback_idempotence'];
const FORBIDDEN = ['append_only_log_validation', 'predicate_determinism_validation'];

function validInput() {
  return {
    pre_state: loadFixture('safety.rollback.pre_state'),
    post_state: loadFixture('safety.rollback.post_state'),
    workspace: loadFixture('snapshots.workspace.sample'),
  };
}

test('owned responsibilities and boundary metadata are isolated to safety layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^safety\//);
});

test('accepts valid rollback fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects invalid rollback fixture with safety failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.post_state.workspace.files[0].content = 'after';
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for rollback outcomes', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

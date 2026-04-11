'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'safety/log_crash_consistency_validator';
const FAILURE_CLASS = 'SAFETY_VIOLATION';
const OWNED = ['append_only_log_crash_semantics', 'last_entry_committed_or_absent', 'no_partial_entries_accepted'];
const FORBIDDEN = ['log_entry_schema_validation', 'ledger_semantics_validation'];

function validInput() {
  return {
    crash_trace: loadFixture('safety.crash_trace.log'),
    logs: [loadFixture('log_entry.valid.minimal')],
  };
}

test('owned responsibilities and boundary metadata are isolated to safety layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^safety\//);
});

test('accepts valid log crash-consistency fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects partial-log-entry fixture with safety failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.logs = [{ ...loadFixture('log_entry.valid.minimal'), checksum: undefined }];
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for crash simulation outcomes', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

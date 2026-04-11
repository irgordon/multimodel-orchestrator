'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'safety/run_manifest_crash_consistency_validator';
const FAILURE_CLASS = 'SAFETY_VIOLATION';
const OWNED = ['run_manifest_ndjson_crash_semantics', 'last_entry_committed_or_absent', 'no_partial_entries_accepted'];
const FORBIDDEN = ['manifest_entry_schema_validation', 'ledger_semantics_validation'];

function validInput() {
  return {
    crash_trace: loadFixture('safety.crash_trace.run_manifest'),
    run_manifest: loadFixture('run_manifest.valid.entries'),
  };
}

test('owned responsibilities and boundary metadata are isolated to safety layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^safety\//);
});

test('accepts valid run manifest crash-consistency fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects partial-run-manifest-entry fixture with safety failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('run_manifest.invalid.partial_entry'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for crash simulation outcomes', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

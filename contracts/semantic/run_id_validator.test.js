'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'semantic/run_id_validator';
const FAILURE_CLASS = 'SEMANTIC_INVALID';
const OWNED = ['run_id_formula_validation', 'consumes_layer3_snapshot_hash', 'recorded_run_id_verification'];
const FORBIDDEN = ['snapshot_hash_computation', 'scheduler_output_validation'];

function validInput() {
  return {
    normalized_spec: loadFixture('spec.valid.minimal'),
    normalized_plan: loadFixture('plan.valid.minimal'),
    snapshot_hash: loadFixture('snapshots.expected_hash.sample'),
    run_manifest: loadFixture('run_manifest.valid.entries'),
    toolchain_version: '1.0.0',
    model_identifiers_json: ['model-a'],
  };
}

test('owned responsibilities and boundary metadata are isolated to semantic layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^semantic\//);
});

test('accepts valid run_id formula fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects invalid run_id formula fixture with semantic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.run_manifest = [{ sequence_number: 1, payload: { run_id: 'wrong-run-id' } }];
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for run_id formula application', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

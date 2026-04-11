'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'determinism/snapshot_hash_validator';
const FAILURE_CLASS = 'NONDETERMINISTIC_BEHAVIOR';
const OWNED = ['inclusion_exclusion_rules', 'deterministic_directory_walk', 'deterministic_path_normalization', 'deterministic_hashing', 'normalization_rules'];
const FORBIDDEN = ['run_id_formula_validation', 'atomic_write_validation'];

function validInput() {
  return {
    workspace: loadFixture('snapshots.workspace.sample'),
    snapshot_rules: loadFixture('snapshots.rules'),
    expected_hash: loadFixture('snapshots.expected_hash.sample'),
  };
}

test('owned responsibilities and boundary metadata are isolated to determinism layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^determinism\//);
});

test('accepts stable snapshot hash fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects mismatched snapshot hash fixture with nondeterministic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.expected_hash = { snapshot_hash: 'bad', rules_version: '1' };
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for identical logical workspaces', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

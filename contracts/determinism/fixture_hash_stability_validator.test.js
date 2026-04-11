'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture, readIndex } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'determinism/fixture_hash_stability_validator';
const FAILURE_CLASS = 'NONDETERMINISTIC_BEHAVIOR';
const OWNED = ['canonical_fixture_hashing', 'cross_environment_hash_stability'];
const FORBIDDEN = ['fixture_registration_validation', 'test_expectation_validation'];

function validInput() {
  return {
    fixture_index: readIndex(),
    fixture_registry: loadFixture('registry.valid'),
  };
}

test('owned responsibilities and boundary metadata are isolated to determinism layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^determinism\//);
});

test('accepts stable fixture hash fixtures', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects unstable fixture hash fixture with nondeterministic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.fixture_registry.fixtures[0].hash = 'sha256:deadbeef';
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for fixture hash validation', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

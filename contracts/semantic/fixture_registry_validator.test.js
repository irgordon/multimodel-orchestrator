'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'semantic/fixture_registry_validator';
const FAILURE_CLASS = 'SEMANTIC_INVALID';
const OWNED = ['fixture_ids_version_references_hash_presence', 'registration_and_immutability_contract', 'tests_reference_registered_fixtures'];
const FORBIDDEN = ['fixture_hash_computation', 'test_expectation_validation'];

function validInput() {
  return {
    fixtures_index: loadFixture('registry.valid'),
    fixture_paths: loadFixture('registry.valid').fixtures.map((f) => f.path),
    fixture_ids_used_in_tests: ['spec.valid.minimal', 'plan.valid.minimal'],
  };
}

test('owned responsibilities and boundary metadata are isolated to semantic layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^semantic\//);
});

test('accepts valid fixture registry fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects invalid fixture registry fixture with semantic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, {
    fixtures_index: loadFixture('registry.invalid.missing_hash'),
    fixture_paths: ['spec/valid/minimal_spec.json'],
    fixture_ids_used_in_tests: ['spec.valid.minimal'],
  }, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for fixture registry validation', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

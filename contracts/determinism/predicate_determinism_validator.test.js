'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'determinism/predicate_determinism_validator';
const FAILURE_CLASS = 'NONDETERMINISTIC_BEHAVIOR';
const OWNED = ['identical_inputs_identical_outputs', 'no_external_unpinned_data_sources', 'pinned_advisory_dataset_requirement'];
const FORBIDDEN = ['predicate_semantic_validation', 'invariant_correctness_validation'];

function validInput() {
  return {
    predicate_input: loadFixture('predicates.input.stable'),
    expected_output: loadFixture('predicates.output.stable'),
    predicate_definitions: loadFixture('predicates.definitions'),
    predicate_schemas: loadFixture('predicates.schemas'),
  };
}

test('owned responsibilities and boundary metadata are isolated to determinism layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^determinism\//);
});

test('accepts deterministic predicate fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects nondeterministic predicate fixture with nondeterministic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.expected_output = { ...invalid.expected_output, result: false };
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('runs determinism check across repeated executions', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

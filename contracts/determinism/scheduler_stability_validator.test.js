'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'determinism/scheduler_stability_validator';
const FAILURE_CLASS = 'NONDETERMINISTIC_BEHAVIOR';
const OWNED = ['stable_topological_ordering', 'stable_concurrency_batches', 'stable_scheduler_serialization'];
const FORBIDDEN = ['dag_correctness_validation', 'scope_conflict_computation', 'atomicity_validation'];

function validInput() {
  return {
    normalized_plan: loadFixture('scheduler.plan.simple'),
    scope_conflict_map: loadFixture('scheduler.plan.simple').scope_conflict_map,
    expected: loadFixture('scheduler.expected_order.simple'),
  };
}

test('owned responsibilities and boundary metadata are isolated to determinism layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^determinism\//);
});

test('accepts stable scheduler fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects unstable scheduler fixture with nondeterministic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.expected = { batches: [['a'], ['c'], ['b']], serialized: '[["a"],["c"],["b"]]' };
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for identical scheduler inputs', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

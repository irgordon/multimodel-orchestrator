'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'semantic/plan_dag_validator';
const FAILURE_CLASS = 'SEMANTIC_INVALID';
const OWNED = ['acyclic_dag', 'valid_dependency_references', 'no_duplicate_task_ids', 'no_missing_dependencies'];
const FORBIDDEN = ['task_reordering', 'scheduler_output_decision', 'invariant_evaluation'];

test('owned responsibilities and boundary metadata are isolated to semantic layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^semantic\//);
});

test('accepts valid DAG fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, loadFixture('plan.valid.minimal'));
});

test('rejects invalid DAG fixtures with semantic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('plan.invalid.dag_cycle'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
  await expectFailure(validator, loadFixture('plan.invalid.duplicate_task_id'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
  await expectFailure(validator, loadFixture('plan.invalid.missing_dependency'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for DAG validation', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, loadFixture('plan.valid.minimal'));
});

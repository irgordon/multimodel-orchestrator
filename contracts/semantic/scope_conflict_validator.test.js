'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'semantic/scope_conflict_validator';
const FAILURE_CLASS = 'SEMANTIC_INVALID';
const OWNED = ['write_scope_conflicts', 'conflict_map'];
const FORBIDDEN = ['task_scheduling', 'dag_validation'];

test('owned responsibilities and boundary metadata are isolated to semantic layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^semantic\//);
});

test('accepts non-conflicting scope fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, loadFixture('plan.valid.minimal'));
});

test('rejects conflicting scope fixture with semantic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('plan.invalid.scope_conflict'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for conflict map generation', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, loadFixture('plan.invalid.scope_conflict'));
});

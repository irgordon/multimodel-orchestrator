'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'semantic/invariant_reference_validator';
const FAILURE_CLASS = 'SEMANTIC_INVALID';
const OWNED = ['required_invariants_reference_known_predicates', 'predicate_parameter_schema_match'];
const FORBIDDEN = ['predicate_evaluation', 'predicate_determinism_validation'];

test('owned responsibilities and boundary metadata are isolated to semantic layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^semantic\//);
});

test('accepts valid invariant references fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const input = {
    plan: loadFixture('plan.valid.minimal'),
    predicate_definitions: loadFixture('predicates.definitions'),
    predicate_schemas: loadFixture('predicates.schemas'),
  };
  await expectValidResult(validator, input);
});

test('rejects invalid invariant references fixture with semantic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const input = {
    plan: loadFixture('plan.invalid.invariant_reference'),
    predicate_definitions: loadFixture('predicates.definitions'),
    predicate_schemas: loadFixture('predicates.schemas'),
  };
  await expectFailure(validator, input, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for predicate reference lookup', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const input = {
    plan: loadFixture('plan.valid.minimal'),
    predicate_definitions: loadFixture('predicates.definitions'),
    predicate_schemas: loadFixture('predicates.schemas'),
  };
  await assertDeterministic(validator, input);
});

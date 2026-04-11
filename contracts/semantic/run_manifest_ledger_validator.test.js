'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'semantic/run_manifest_ledger_validator';
const FAILURE_CLASS = 'SEMANTIC_INVALID';
const OWNED = ['append_only_semantics', 'monotonic_sequence_numbers', 'checksum_chain_correctness', 'immutable_historical_entries'];
const FORBIDDEN = ['entry_schema_validation', 'crash_consistency_validation'];

test('owned responsibilities and boundary metadata are isolated to semantic layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^semantic\//);
});

test('accepts valid manifest ledger fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, loadFixture('run_manifest.valid.entries'));
});

test('rejects invalid manifest ledger fixtures with semantic failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectFailure(validator, loadFixture('run_manifest.invalid.sequence_non_monotonic'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
  await expectFailure(validator, loadFixture('run_manifest.invalid.checksum_chain'), { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for ledger validation', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, loadFixture('run_manifest.valid.entries'));
});

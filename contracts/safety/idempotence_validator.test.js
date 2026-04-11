'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadFixture } = require('../shared/fixture_loader');
const { assertDeterministic, assertNoForbiddenCoverage, expectFailure, expectValidResult, loadValidator } = require('../shared/test_harness');

const VALIDATOR_ID = 'safety/idempotence_validator';
const FAILURE_CLASS = 'SAFETY_VIOLATION';
const OWNED = ['repeated_execution_identical_observable_results', 'workspace_manifest_verification_artifact_scope', 'exclude_logs_timestamps_temp_paths_debug_traces'];
const FORBIDDEN = ['scheduler_output_validation', 'semantic_correctness_validation'];

function validInput() {
  return {
    execution_a: {
      workspace: loadFixture('snapshots.workspace.sample'),
      run_manifest: loadFixture('run_manifest.valid.entries'),
      verification_artifacts: [loadFixture('snapshots.expected_hash.sample')],
      logs: [{ message: 'first run' }],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      temp_paths: ['/tmp/x'],
    },
    execution_b: {
      workspace: loadFixture('snapshots.workspace.sample'),
      run_manifest: loadFixture('run_manifest.valid.entries'),
      verification_artifacts: [loadFixture('snapshots.expected_hash.sample')],
      logs: [{ message: 'second run' }],
      timestamps: ['2026-01-01T00:00:01.000Z'],
      temp_paths: ['/tmp/y'],
    },
  };
}

test('owned responsibilities and boundary metadata are isolated to safety layer', () => {
  assertNoForbiddenCoverage(OWNED, FORBIDDEN);
  assert.match(VALIDATOR_ID, /^safety\//);
});

test('accepts valid idempotence fixture', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await expectValidResult(validator, validInput());
});

test('rejects non-idempotent observable results with safety failure contract', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  const invalid = validInput();
  invalid.execution_b.workspace.files[0].content = 'changed';
  await expectFailure(validator, invalid, { validatorId: VALIDATOR_ID, failureClass: FAILURE_CLASS });
});

test('is deterministic for repeated idempotence comparisons', async () => {
  const validator = loadValidator(VALIDATOR_ID);
  await assertDeterministic(validator, validInput());
});

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const { getAllowedErrorCodes } = require('./error_codes');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_VALIDATOR_CANDIDATES = Object.freeze([
  path.join(REPO_ROOT, 'validators'),
  path.join(REPO_ROOT, 'orchestration', 'validators'),
  path.join(REPO_ROOT, 'orchestration'),
]);

function loadValidator(validatorId) {
  const relative = `${validatorId}.js`;
  const roots = process.env.CONTRACT_VALIDATOR_ROOT
    ? [process.env.CONTRACT_VALIDATOR_ROOT]
    : DEFAULT_VALIDATOR_CANDIDATES;

  let lastError;
  for (const root of roots) {
    try {
      const mod = require(path.join(root, relative));
      if (typeof mod === 'function') {
        return mod;
      }
      if (mod && typeof mod.validate === 'function') {
        return mod.validate.bind(mod);
      }
      if (mod && typeof mod.default === 'function') {
        return mod.default;
      }
      throw new Error(`Validator module loaded but no callable export for ${validatorId}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to load validator '${validatorId}': ${lastError ? lastError.message : 'no candidates'}`);
}

async function runValidator(validator, input) {
  const out = await validator(input);
  return out;
}

function extractFailure(resultOrError) {
  if (resultOrError && resultOrError.error) {
    return resultOrError.error;
  }
  return resultOrError;
}

async function expectValidResult(validator, input) {
  const result = await runValidator(validator, input);
  if (typeof result === 'boolean') {
    assert.equal(result, true);
    return;
  }
  if (result && typeof result === 'object' && 'ok' in result) {
    assert.equal(result.ok, true);
    return;
  }
  assert.ok(result !== undefined);
}

async function expectFailure(validator, input, expected) {
  let caught;
  try {
    const result = await runValidator(validator, input);
    if (typeof result === 'boolean') {
      assert.equal(result, false, 'Expected validator failure result');
      throw new Error('Validator returned false without structured error');
    }
    if (result && typeof result === 'object' && result.ok === false) {
      caught = extractFailure(result);
    }
  } catch (error) {
    caught = extractFailure(error);
  }

  assert.ok(caught, 'Expected structured validator failure');
  assert.equal(caught.validator_id, expected.validatorId);
  assert.equal(caught.failure_class, expected.failureClass);
  const allowed = getAllowedErrorCodes(expected.validatorId);
  assert.ok(allowed.length > 0, `No allowed error codes configured for ${expected.validatorId}`);
  assert.ok(allowed.includes(caught.error_code), `Unexpected error_code '${caught.error_code}' for ${expected.validatorId}`);
}

async function assertDeterministic(validator, input, normalize = (value) => value) {
  const first = normalize(await runValidator(validator, input));
  const second = normalize(await runValidator(validator, input));
  assert.deepEqual(second, first);
}

function assertNoForbiddenCoverage(ownedResponsibilities, forbiddenResponsibilities) {
  for (const forbidden of forbiddenResponsibilities) {
    assert.ok(!ownedResponsibilities.includes(forbidden), `Forbidden responsibility included in owned list: ${forbidden}`);
  }
}

module.exports = {
  assertDeterministic,
  assertNoForbiddenCoverage,
  expectFailure,
  expectValidResult,
  loadValidator,
  runValidator,
};

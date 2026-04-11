'use strict';

const VALIDATOR_ID = 'structural/run_manifest_container_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const ERROR_CODE = 'STRUCTURAL_SCHEMA_INVALID';

function createFailure(message, details) {
  return {
    ok: false,
    error: {
      validator_id: VALIDATOR_ID,
      failure_class: FAILURE_CLASS,
      error_code: ERROR_CODE,
      message,
      details,
    },
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = function run_manifest_container_schema_validator(input) {
  if (!Array.isArray(input)) {
    return createFailure('Run manifest container must be an array.', {
      reason: 'invalid_root_type',
      expected: 'array<object>',
      received: Array.isArray(input) ? 'array' : typeof input,
    });
  }

  for (let index = 0; index < input.length; index += 1) {
    if (!isPlainObject(input[index])) {
      return createFailure('Run manifest container must contain objects.', {
        reason: 'invalid_array_entry',
        field: 'entries',
        index,
        expected: 'object',
        received: Array.isArray(input[index]) ? 'array' : typeof input[index],
      });
    }
  }

  return {
    ok: true,
    normalized_run_manifest: input,
  };
};

'use strict';

const VALIDATOR_ID = 'structural/run_manifest_container_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const ERROR_CODE = 'STRUCTURAL_SCHEMA_INVALID';

function getType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function isEntryObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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

module.exports = function run_manifest_container_schema_validator(manifestContainer) {
  if (!Array.isArray(manifestContainer)) {
    return createFailure('Run manifest container must be an array.', {
      reason: 'invalid_root_type',
      expected: 'array',
      received: getType(manifestContainer),
    });
  }

  for (let index = 0; index < manifestContainer.length; index += 1) {
    if (!isEntryObject(manifestContainer[index])) {
      return createFailure('Run manifest container entries must be objects.', {
        reason: 'invalid_entry_type',
        index,
        expected: 'object',
        received: getType(manifestContainer[index]),
      });
    }
  }

  return { ok: true };
};

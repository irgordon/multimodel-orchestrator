'use strict';

const VALIDATOR_ID = 'structural/spec_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const ERROR_CODE = 'STRUCTURAL_SCHEMA_INVALID';
const REQUIRED_FIELDS = Object.freeze([
  'goals',
  'constraints',
  'invariants',
  'risk_notes',
  'model_identifiers',
]);

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

function hasOnlyRequiredProperties(spec) {
  const keys = Object.keys(spec);
  if (keys.length !== REQUIRED_FIELDS.length) {
    return false;
  }

  return keys.every((key) => REQUIRED_FIELDS.includes(key));
}

function isArrayOfStrings(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

module.exports = function spec_schema_validator(input) {
  if (!isPlainObject(input)) {
    return createFailure('Spec must be an object.', { reason: 'invalid_root_type' });
  }

  if (!hasOnlyRequiredProperties(input)) {
    return createFailure('Spec contains missing or additional properties.', {
      required_fields: REQUIRED_FIELDS,
      received_fields: Object.keys(input),
      reason: 'invalid_properties',
    });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!isArrayOfStrings(input[field])) {
      return createFailure(`Spec field '${field}' must be an array of strings.`, {
        field,
        reason: 'invalid_field_type',
      });
    }
  }

  return { ok: true };
};

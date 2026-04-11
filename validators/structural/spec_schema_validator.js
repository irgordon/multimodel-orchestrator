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

function getPropertyDrift(spec) {
  const keys = Object.keys(spec);
  const missing = REQUIRED_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(spec, field));
  const additional = keys.filter((key) => !REQUIRED_FIELDS.includes(key));
  return { keys, missing, additional };
}

function validateStringArray(fieldName, value) {
  if (!Array.isArray(value)) {
    return createFailure(`Spec field '${fieldName}' must be an array of strings.`, {
      field: fieldName,
      reason: 'invalid_field_type',
      expected: 'array<string>',
      received: typeof value,
    });
  }

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== 'string' || item.trim().length === 0) {
      return createFailure(`Spec field '${fieldName}' contains an invalid entry.`, {
        field: fieldName,
        index,
        reason: 'invalid_array_entry',
      });
    }
  }

  return null;
}

function buildNormalizedSpec(spec) {
  const normalized = {};
  for (const field of REQUIRED_FIELDS) {
    normalized[field] = spec[field].map((item) => item.trim());
  }
  return normalized;
}

module.exports = function spec_schema_validator(input) {
  if (!isPlainObject(input)) {
    return createFailure('Spec must be an object.', { reason: 'invalid_root_type' });
  }

  const { keys, missing, additional } = getPropertyDrift(input);
  if (missing.length > 0 || additional.length > 0) {
    return createFailure('Spec contains missing or additional properties.', {
      required_fields: REQUIRED_FIELDS,
      received_fields: keys,
      missing_fields: missing,
      additional_fields: additional,
      reason: 'invalid_properties',
    });
  }

  for (const field of REQUIRED_FIELDS) {
    const failure = validateStringArray(field, input[field]);
    if (failure) {
      return failure;
    }
  }

  return {
    ok: true,
    normalized_spec: buildNormalizedSpec(input),
  };
};

'use strict';

const VALIDATOR_ID = 'structural/run_manifest_entry_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const ERROR_CODE = 'STRUCTURAL_SCHEMA_INVALID';

const REQUIRED_FIELDS = Object.freeze([
  'sequence_number',
  'timestamp',
  'event_type',
  'payload',
  'checksum',
]);
const OPTIONAL_FIELDS = Object.freeze(['previous_checksum']);
const ALLOWED_FIELDS = Object.freeze([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

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

function valueType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

module.exports = function run_manifest_entry_schema_validator(entry) {
  if (!isPlainObject(entry)) {
    return createFailure('Run manifest entry must be an object.', {
      reason: 'invalid_entry_type',
      expected: 'object',
      received: valueType(entry),
    });
  }

  const keys = Object.keys(entry);
  const missingFields = REQUIRED_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(entry, field));
  const additionalFields = keys.filter((field) => !ALLOWED_FIELDS.includes(field));
  if (missingFields.length > 0 || additionalFields.length > 0) {
    return createFailure('Run manifest entry has missing or additional properties.', {
      reason: 'invalid_properties',
      missing_fields: missingFields,
      additional_fields: additionalFields,
    });
  }

  if (typeof entry.sequence_number !== 'number') {
    return createFailure('Run manifest entry sequence_number must be a number.', {
      reason: 'invalid_field_type',
      field: 'sequence_number',
      expected: 'number',
      received: valueType(entry.sequence_number),
    });
  }

  if (typeof entry.timestamp !== 'string') {
    return createFailure('Run manifest entry timestamp must be a string.', {
      reason: 'invalid_field_type',
      field: 'timestamp',
      expected: 'string',
      received: valueType(entry.timestamp),
    });
  }

  if (typeof entry.event_type !== 'string') {
    return createFailure('Run manifest entry event_type must be a string.', {
      reason: 'invalid_field_type',
      field: 'event_type',
      expected: 'string',
      received: valueType(entry.event_type),
    });
  }

  if (!isPlainObject(entry.payload)) {
    return createFailure('Run manifest entry payload must be an object.', {
      reason: 'invalid_field_type',
      field: 'payload',
      expected: 'object',
      received: valueType(entry.payload),
    });
  }

  if (typeof entry.checksum !== 'string') {
    return createFailure('Run manifest entry checksum must be a string.', {
      reason: 'invalid_field_type',
      field: 'checksum',
      expected: 'string',
      received: valueType(entry.checksum),
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(entry, 'previous_checksum') &&
    typeof entry.previous_checksum !== 'string'
  ) {
    return createFailure('Run manifest entry previous_checksum must be a string when present.', {
      reason: 'invalid_field_type',
      field: 'previous_checksum',
      expected: 'string',
      received: valueType(entry.previous_checksum),
    });
  }

  return { ok: true };
};

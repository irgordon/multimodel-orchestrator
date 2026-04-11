'use strict';

const VALIDATOR_ID = 'structural/run_manifest_container_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const ERROR_CODE = 'STRUCTURAL_SCHEMA_INVALID';

const REQUIRED_ENTRY_FIELDS = Object.freeze([
  'sequence_number',
  'timestamp',
  'event_type',
  'payload',
  'checksum',
]);
const OPTIONAL_ENTRY_FIELDS = Object.freeze(['previous_checksum']);
const ALLOWED_ENTRY_FIELDS = Object.freeze([...REQUIRED_ENTRY_FIELDS, ...OPTIONAL_ENTRY_FIELDS]);

function getType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function isPlainObject(value) {
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

function getEntryPropertyDrift(entry) {
  const keys = Object.keys(entry);
  const missing = REQUIRED_ENTRY_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(entry, field));
  const additional = keys.filter((key) => !ALLOWED_ENTRY_FIELDS.includes(key));
  return { missing, additional };
}

function validateEntryTypes(entry, index) {
  if (typeof entry.sequence_number !== 'number' || !Number.isFinite(entry.sequence_number)) {
    return createFailure('Run manifest entry has an invalid field type.', {
      reason: 'invalid_field_type',
      entry_index: index,
      field: 'sequence_number',
      expected: 'number',
      received: getType(entry.sequence_number),
    });
  }

  if (typeof entry.timestamp !== 'string') {
    return createFailure('Run manifest entry has an invalid field type.', {
      reason: 'invalid_field_type',
      entry_index: index,
      field: 'timestamp',
      expected: 'string',
      received: getType(entry.timestamp),
    });
  }

  if (typeof entry.event_type !== 'string') {
    return createFailure('Run manifest entry has an invalid field type.', {
      reason: 'invalid_field_type',
      entry_index: index,
      field: 'event_type',
      expected: 'string',
      received: getType(entry.event_type),
    });
  }

  if (!isPlainObject(entry.payload)) {
    return createFailure('Run manifest entry has an invalid field type.', {
      reason: 'invalid_field_type',
      entry_index: index,
      field: 'payload',
      expected: 'object',
      received: getType(entry.payload),
    });
  }

  if (typeof entry.checksum !== 'string') {
    return createFailure('Run manifest entry has an invalid field type.', {
      reason: 'invalid_field_type',
      entry_index: index,
      field: 'checksum',
      expected: 'string',
      received: getType(entry.checksum),
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(entry, 'previous_checksum')
    && typeof entry.previous_checksum !== 'string'
  ) {
    return createFailure('Run manifest entry has an invalid field type.', {
      reason: 'invalid_field_type',
      entry_index: index,
      field: 'previous_checksum',
      expected: 'string',
      received: getType(entry.previous_checksum),
    });
  }

  return null;
}

module.exports = function run_manifest_container_schema_validator(input) {
  if (!Array.isArray(input)) {
    return createFailure('Run manifest container must be an array.', {
      reason: 'invalid_root_type',
      expected: 'array<object>',
      received: getType(input),
    });
  }

  for (let index = 0; index < input.length; index += 1) {
    const entry = input[index];
    if (!isPlainObject(entry)) {
      return createFailure('Run manifest container entries must be objects.', {
        reason: 'invalid_array_entry',
        entry_index: index,
        expected: 'object',
        received: getType(entry),
      });
    }

    const drift = getEntryPropertyDrift(entry);
    if (drift.missing.length > 0 || drift.additional.length > 0) {
      return createFailure('Run manifest entry has missing or additional properties.', {
        reason: 'invalid_entry_properties',
        entry_index: index,
        missing_fields: drift.missing,
        additional_fields: drift.additional,
      });
    }

    const typeFailure = validateEntryTypes(entry, index);
    if (typeFailure) {
      return typeFailure;
    }
  }

  return { ok: true };
};

'use strict';

const ERROR_CODES_BY_VALIDATOR = Object.freeze({
  'structural/spec_schema_validator': Object.freeze(['STRUCTURAL_SCHEMA_INVALID']),
  'structural/plan_schema_validator': Object.freeze(['STRUCTURAL_SCHEMA_INVALID']),
  'structural/run_manifest_container_schema_validator': Object.freeze(['STRUCTURAL_SCHEMA_INVALID']),
  'structural/run_manifest_entry_schema_validator': Object.freeze(['STRUCTURAL_SCHEMA_INVALID']),
  'structural/log_entry_schema_validator': Object.freeze(['STRUCTURAL_SCHEMA_INVALID']),
  'structural/error_object_schema_validator': Object.freeze(['STRUCTURAL_SCHEMA_INVALID']),

  'semantic/plan_dag_validator': Object.freeze(['SEMANTIC_DAG_INVALID']),
  'semantic/scope_conflict_validator': Object.freeze(['SEMANTIC_SCOPE_CONFLICT']),
  'semantic/invariant_reference_validator': Object.freeze(['SEMANTIC_INVARIANT_REFERENCE_INVALID']),
  'semantic/run_manifest_ledger_validator': Object.freeze(['SEMANTIC_LEDGER_INVALID']),
  'semantic/run_id_validator': Object.freeze(['SEMANTIC_RUN_ID_INVALID']),
  'semantic/fixture_registry_validator': Object.freeze(['SEMANTIC_FIXTURE_REGISTRY_INVALID']),
  'semantic/error_code_contract_validator': Object.freeze(['SEMANTIC_ERROR_CODE_INVALID']),

  'determinism/scheduler_stability_validator': Object.freeze(['NONDETERMINISTIC_SCHEDULER_OUTPUT']),
  'determinism/snapshot_hash_validator': Object.freeze(['NONDETERMINISTIC_SNAPSHOT_HASH']),
  'determinism/predicate_determinism_validator': Object.freeze(['NONDETERMINISTIC_PREDICATE_OUTPUT']),
  'determinism/fixture_hash_stability_validator': Object.freeze(['NONDETERMINISTIC_FIXTURE_HASH']),

  'safety/atomic_write_validator': Object.freeze(['SAFETY_ATOMIC_WRITE_VIOLATION']),
  'safety/rollback_validator': Object.freeze(['SAFETY_ROLLBACK_VIOLATION']),
  'safety/idempotence_validator': Object.freeze(['SAFETY_IDEMPOTENCE_VIOLATION']),
  'safety/log_crash_consistency_validator': Object.freeze(['SAFETY_LOG_CRASH_CONSISTENCY_VIOLATION']),
  'safety/run_manifest_crash_consistency_validator': Object.freeze(['SAFETY_RUN_MANIFEST_CRASH_CONSISTENCY_VIOLATION']),
});

function getAllowedErrorCodes(validatorId) {
  return ERROR_CODES_BY_VALIDATOR[validatorId] || [];
}

function isAllowedErrorCode(validatorId, errorCode) {
  return getAllowedErrorCodes(validatorId).includes(errorCode);
}

module.exports = {
  ERROR_CODES_BY_VALIDATOR,
  getAllowedErrorCodes,
  isAllowedErrorCode,
};

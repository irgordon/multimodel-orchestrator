VALIDATOR BOUNDARY MAP (FROZEN)
One validator = one responsibility set = one failure class family.

MANIFEST FORMAT DECISION (FROZEN)
- run_manifest.json is an append-only NDJSON stream.
- Each line is a single JSON object representing one manifest entry.
- There is no outer JSON container object.

SNAPSHOT RULES VERSIONING (FROZEN)
- snapshot_rules.md is an authoritative, versioned contract input.
- Any change to snapshot_rules.md requires a contract-layer version bump.

ERROR MESSAGE STABILITY (FROZEN)
- error_code and failure_class are contract-stable.
- message is human-readable and informational only; it is NOT contract-stable.
- details may be machine-readable but are not required to be stable across versions.

IDEMPOTENCE OBSERVABILITY BOUNDARY (FROZEN)
- “Observable results” for idempotence include:
  - workspace contents (files and directories within the defined snapshot scope)
  - run_manifest entries
  - verification artifacts
- “Observable results” explicitly exclude:
  - logs (they may contain repeated entries)
  - timestamps
  - temp paths
  - internal debug traces

CANONICALIZATION ENFORCEMENT (FROZEN)
- shared/canonicalization output is covered indirectly by:
  - structural validators (which consume normalized_* artifacts)
  - determinism/fixture_hash_stability_validator (which ensures stable hashes)
- No separate validator is required; canonicalization is enforced via its consumers.

================================================================================
LAYER 1 — STRUCTURAL CONTRACTS
================================================================================

VALIDATOR ID: structural/spec_schema_validator
LAYER: 1 (Structural)
OWNS:
  - Validate spec.yaml shape
  - Required fields: goals, constraints, invariants, risk_notes, model_identifiers
  - Field types, enums, allowed values
  - No additional properties
  - Uses shared canonicalization library for YAML → canonical JSON
READS: spec.yaml
WRITES: normalized_spec.json (canonical JSON), validation result
FAILURE CLASS: STRUCTURAL_INVALID
DETERMINISM REQUIREMENTS:
  - Canonical JSON must be byte-stable (via shared canonicalization)
FORBIDDEN:
  - No semantic validation (e.g., cannot check invariant references)
  - No historical or ledger checks
  - No environment access

-------------------------------------------------------------------------------

VALIDATOR ID: structural/plan_schema_validator
LAYER: 1 (Structural)
OWNS:
  - Validate plan.yaml shape
  - Task object structure
  - Required fields: id, phase, scope, dependencies, risk_level
  - Enum validation for phase and risk_level
  - No additional properties
  - Uses shared canonicalization library for YAML → canonical JSON
READS: plan.yaml
WRITES: normalized_plan.json (canonical JSON), validation result
FAILURE CLASS: STRUCTURAL_INVALID
DETERMINISM REQUIREMENTS:
  - Canonical JSON must be byte-stable (via shared canonicalization)
FORBIDDEN:
  - Cannot check DAG validity
  - Cannot check invariant references
  - Cannot check concurrency or scheduling

-------------------------------------------------------------------------------

VALIDATOR ID: structural/run_manifest_entry_schema_validator
LAYER: 1 (Structural)
OWNS:
  - Validate shape of a single manifest entry (one NDJSON line)
  - Required fields: sequence_number, timestamp, event_type, payload, checksum
  - No additional properties
READS: run_manifest.json (line-by-line)
WRITES: manifest_entry_schema_validation.json
FAILURE CLASS: STRUCTURAL_INVALID
DETERMINISM REQUIREMENTS:
  - None beyond schema
FORBIDDEN:
  - Cannot validate append-only semantics
  - Cannot validate checksum chain
  - Cannot validate crash consistency

-------------------------------------------------------------------------------

VALIDATOR ID: structural/log_entry_schema_validator
LAYER: 1 (Structural)
OWNS:
  - Validate shape of a single log entry
  - Required fields: run_id, phase, actor, task_id (optional), input_artifacts,
    output_artifacts, result, timestamp, sequence_number, checksum
  - No additional properties
READS: logs/
WRITES: log_entry_schema_validation.json
FAILURE CLASS: STRUCTURAL_INVALID
DETERMINISM REQUIREMENTS:
  - None beyond schema
FORBIDDEN:
  - Cannot validate append-only semantics
  - Cannot validate crash consistency

-------------------------------------------------------------------------------

VALIDATOR ID: structural/error_object_schema_validator
LAYER: 1 (Structural)
OWNS:
  - Validate shape of error objects emitted by validators
  - Required fields: validator_id, failure_class, error_code, message, details
  - No additional properties
READS: validator error outputs
WRITES: error_object_schema_validation.json
FAILURE CLASS: STRUCTURAL_INVALID
DETERMINISM REQUIREMENTS:
  - None beyond schema
FORBIDDEN:
  - Cannot validate allowed error codes
  - Cannot validate semantic meaning of errors

================================================================================
LAYER 2 — SEMANTIC CONTRACTS
================================================================================

VALIDATOR ID: semantic/plan_dag_validator
LAYER: 2 (Semantic)
OWNS:
  - DAG validity (acyclic)
  - All dependencies reference valid task IDs
  - No duplicate task IDs
  - No missing dependencies
READS: normalized_plan.json
WRITES: dag_validation_result.json
FAILURE CLASS: SEMANTIC_INVALID
DETERMINISM REQUIREMENTS:
  - DAG validation must be deterministic
FORBIDDEN:
  - Cannot reorder tasks
  - Cannot decide scheduler output
  - Cannot evaluate invariants

-------------------------------------------------------------------------------

VALIDATOR ID: semantic/scope_conflict_validator
LAYER: 2 (Semantic)
OWNS:
  - Detect write-scope conflicts between tasks
  - Build conflict map (which tasks cannot run concurrently)
READS: normalized_plan.json
WRITES: scope_conflict_map.json
FAILURE CLASS: SEMANTIC_INVALID
DETERMINISM REQUIREMENTS:
  - Conflict detection must be deterministic
FORBIDDEN:
  - Cannot schedule tasks
  - Cannot validate DAG correctness

-------------------------------------------------------------------------------

VALIDATOR ID: semantic/invariant_reference_validator
LAYER: 2 (Semantic)
OWNS:
  - All required_invariants reference known predicate IDs
  - Predicate parameters match predicate_schemas
READS: normalized_plan.json, predicate_definitions.json, predicate_schemas/
WRITES: invariant_reference_validation.json
FAILURE CLASS: SEMANTIC_INVALID
DETERMINISM REQUIREMENTS:
  - Deterministic predicate lookup
FORBIDDEN:
  - Cannot evaluate predicates
  - Cannot check determinism of predicates

-------------------------------------------------------------------------------

VALIDATOR ID: semantic/run_manifest_ledger_validator
LAYER: 2 (Semantic)
OWNS:
  - Append-only semantics for NDJSON manifest
  - Monotonic sequence numbers
  - Checksum chain correctness
  - No mutation of historical entries
BASELINE:
  - Operates on a single manifest snapshot
  - Guarantees internal consistency only (not external tamper-proofing)
READS: run_manifest.json
WRITES: ledger_validation.json
FAILURE CLASS: SEMANTIC_INVALID
DETERMINISM REQUIREMENTS:
  - Ledger validation must be deterministic
FORBIDDEN:
  - Cannot validate entry schema (Layer 1)
  - Cannot validate crash consistency (Layer 4)

-------------------------------------------------------------------------------

VALIDATOR ID: semantic/run_id_validator
LAYER: 2 (Semantic)
OWNS:
  - Validate that run_id equals:
      SHA256(normalized(spec.yaml) ||
             normalized(plan.yaml) ||
             toolchain_version ||
             model_identifiers_json ||
             snapshot_hash)
  - Consumes canonical snapshot_hash.json from Layer 3
READS: normalized_spec.json, normalized_plan.json, snapshot_hash.json,
       run_manifest.json (for recorded run_id)
WRITES: run_id_validation.json
FAILURE CLASS: SEMANTIC_INVALID
DETERMINISM REQUIREMENTS:
  - Formula application must be deterministic
FORBIDDEN:
  - Cannot compute snapshot hash (Layer 3)
  - Cannot validate scheduler output

-------------------------------------------------------------------------------

VALIDATOR ID: semantic/fixture_registry_validator
LAYER: 2 (Semantic)
OWNS:
  - Fixture IDs, version references, and hash presence
  - Ensure fixtures are registered, versioned, and immutable by contract
  - Validate that tests reference only registered fixtures
READS: fixtures/, fixture_registry.json (if present)
WRITES: fixture_registry_validation.json
FAILURE CLASS: SEMANTIC_INVALID
DETERMINISM REQUIREMENTS:
  - Fixture registry validation must be deterministic
FORBIDDEN:
  - Cannot compute fixture hashes (Layer 3)
  - Cannot validate test expectations

-------------------------------------------------------------------------------

VALIDATOR ID: semantic/error_code_contract_validator
LAYER: 2 (Semantic)
OWNS:
  - Allowed error codes per validator family
  - Mapping from validator_id → allowed error_code set
  - Ensure emitted errors use only allowed codes
  - message is informational; only error_code and failure_class are contract-stable
READS: validator error outputs, error_code_contract.json
WRITES: error_code_contract_validation.json
FAILURE CLASS: SEMANTIC_INVALID
DETERMINISM REQUIREMENTS:
  - Error code validation must be deterministic
FORBIDDEN:
  - Cannot validate error object shape (Layer 1)
  - Cannot validate determinism of behavior

================================================================================
LAYER 3 — DETERMINISM CONTRACTS
================================================================================

VALIDATOR ID: determinism/scheduler_stability_validator
LAYER: 3 (Determinism)
OWNS:
  - Stable topological ordering
  - Stable concurrency batches
  - Stable serialization of scheduler output
  - Consumes scope_conflict_map.json from Layer 2
READS: normalized_plan.json, scope_conflict_map.json
WRITES: scheduler_output.json, scheduler_stability_report.json
FAILURE CLASS: NONDETERMINISTIC_BEHAVIOR
DETERMINISM REQUIREMENTS:
  - Identical inputs → byte-identical outputs
FORBIDDEN:
  - Cannot validate DAG correctness (Layer 2)
  - Cannot compute scope conflicts (Layer 2)
  - Cannot validate atomicity or safety

-------------------------------------------------------------------------------

VALIDATOR ID: determinism/snapshot_hash_validator
LAYER: 3 (Determinism)
OWNS:
  - Snapshot inclusion/exclusion rules
  - Deterministic directory walk
  - Deterministic path normalization
  - Deterministic hashing
  - Symlink, permission, timestamp, line-ending, and case normalization rules
  - snapshot_rules.md is a versioned contract input; changes require contract version bump
READS: workspace/, snapshot_rules.md
WRITES: snapshot_hash.json
FAILURE CLASS: NONDETERMINISTIC_BEHAVIOR
DETERMINISM REQUIREMENTS:
  - Identical logical workspace → identical hash
FORBIDDEN:
  - Cannot validate run_id formula (Layer 2)
  - Cannot validate atomic writes (Layer 4)

-------------------------------------------------------------------------------

VALIDATOR ID: determinism/predicate_determinism_validator
LAYER: 3 (Determinism)
OWNS:
  - Identical predicate inputs → identical outputs
  - No external data sources unless pinned fixtures
  - For no_new_critical_vulnerabilities:
      must use pinned advisory dataset or versioned scanner snapshot fixture
READS: predicate_schemas/, predicate_definitions.json, fixtures/
WRITES: predicate_determinism_report.json
FAILURE CLASS: NONDETERMINISTIC_BEHAVIOR
DETERMINISM REQUIREMENTS:
  - Must run predicates multiple times and compare outputs
FORBIDDEN:
  - Cannot validate predicate semantics (Layer 2)
  - Cannot validate invariant correctness

-------------------------------------------------------------------------------

VALIDATOR ID: determinism/fixture_hash_stability_validator
LAYER: 3 (Determinism)
OWNS:
  - Canonical hashing of fixtures
  - Ensure fixture hashes are stable across runs and environments
READS: fixtures/
WRITES: fixture_hash_stability_report.json
FAILURE CLASS: NONDETERMINISTIC_BEHAVIOR
DETERMINISM REQUIREMENTS:
  - Identical fixture content → identical hash
FORBIDDEN:
  - Cannot validate fixture registration (Layer 2)
  - Cannot validate test expectations

================================================================================
LAYER 4 — SAFETY & DURABILITY CONTRACTS
================================================================================

VALIDATOR ID: safety/atomic_write_validator
LAYER: 4 (Safety)
OWNS:
  - Atomic write behavior
  - No partial writes visible
  - Crash simulation around write boundaries
READS: write traces, temp files, workspace/
WRITES: atomic_write_report.json
FAILURE CLASS: SAFETY_VIOLATION
DETERMINISM REQUIREMENTS:
  - Crash simulation must produce deterministic outcomes
FORBIDDEN:
  - Cannot validate schema or DAG
  - Cannot validate scheduler output

-------------------------------------------------------------------------------

VALIDATOR ID: safety/rollback_validator
LAYER: 4 (Safety)
OWNS:
  - Rollback scope correctness
  - Restore pre-write state for:
      - target files
      - relevant metadata (where defined)
      - temp artifacts
  - Ensure rollback is idempotent
READS: workspace/, rollback traces
WRITES: rollback_report.json
FAILURE CLASS: SAFETY_VIOLATION
DETERMINISM REQUIREMENTS:
  - Rollback behavior must be deterministic
FORBIDDEN:
  - Cannot validate append-only logs
  - Cannot validate predicate determinism

-------------------------------------------------------------------------------

VALIDATOR ID: safety/idempotence_validator
LAYER: 4 (Safety)
OWNS:
  - Repeated execution yields identical observable results
  - Observable results include:
      - workspace contents within snapshot scope
      - run_manifest entries
      - verification artifacts
  - Observable results explicitly exclude:
      - logs, timestamps, temp paths, internal debug traces
READS: workspace/, task execution traces, run_manifest.json, verification outputs
WRITES: idempotence_report.json
FAILURE CLASS: SAFETY_VIOLATION
DETERMINISM REQUIREMENTS:
  - Must compare multiple executions deterministically
FORBIDDEN:
  - Cannot validate scheduler output
  - Cannot validate semantic correctness

-------------------------------------------------------------------------------

VALIDATOR ID: safety/log_crash_consistency_validator
LAYER: 4 (Safety)
OWNS:
  - Append-only log crash semantics
  - Last entry is fully committed or absent
  - No partial entries accepted
READS: logs/
WRITES: log_crash_consistency_report.json
FAILURE CLASS: SAFETY_VIOLATION
DETERMINISM REQUIREMENTS:
  - Crash simulation must be deterministic
FORBIDDEN:
  - Cannot validate log entry schema (Layer 1)
  - Cannot validate ledger semantics (Layer 2)

-------------------------------------------------------------------------------

VALIDATOR ID: safety/run_manifest_crash_consistency_validator
LAYER: 4 (Safety)
OWNS:
  - run_manifest crash semantics for NDJSON stream
  - Last entry is fully committed or absent
  - No partial entries accepted
READS: run_manifest.json
WRITES: run_manifest_crash_consistency_report.json
FAILURE CLASS: SAFETY_VIOLATION
DETERMINISM REQUIREMENTS:
  - Crash simulation must be deterministic
FORBIDDEN:
  - Cannot validate manifest entry schema (Layer 1)
  - Cannot validate ledger semantics (Layer 2)

================================================================================
SHARED CANONICALIZATION SURFACE (NOT A VALIDATOR)
================================================================================

MODULE ID: shared/canonicalization
OWNS:
  - Canonical YAML → JSON conversion
  - Stable key ordering
  - Stable encoding rules
USED BY:
  - structural/spec_schema_validator
  - structural/plan_schema_validator
  - any validator requiring canonical JSON
ENFORCEMENT:
  - Its outputs are indirectly enforced via:
      - structural validators consuming normalized_* artifacts
      - determinism/fixture_hash_stability_validator
FORBIDDEN:
  - Cannot perform validation
  - Cannot emit failure classes

================================================================================
END OF VALIDATOR BOUNDARY MAP (FROZEN)
================================================================================
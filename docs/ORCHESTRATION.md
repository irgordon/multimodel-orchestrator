MULTI‑MODEL ORCHESTRATION SPEC v3
Deterministic • Phase‑Gated • Invariant‑First • Execution‑Safe

──────────────────────────────────────────────────────────────────────────────
1. OBJECTIVE AND SCOPE

Define a deterministic, auditable, concurrency‑safe orchestration model for
multi‑model agent pipelines. The system governs planning, generation, patching,
integration, verification, retries, invariants, and run isolation.

LLMs may plan, generate, and refine. LLMs may not verify. Verification is
performed exclusively by deterministic toolchains.

──────────────────────────────────────────────────────────────────────────────
2. ROLES

Planner (P)
  • Reasoning‑first model
  • Produces spec.yaml and plan.yaml
  • Performs decomposition, constraints, sequencing
  • Emits no code

Generator (G)
  • High‑throughput code generator
  • Writes new files under proposed/
  • Never edits workspace/ directly

Diff Model (D)
  • Diff‑aware assistant
  • Produces minimal patches under patches/
  • Operates only within declared scope

Verifier (V)
  • Non‑LLM toolchain
  • Performs build, tests, static analysis, policy checks
  • Emits verification.json entries

──────────────────────────────────────────────────────────────────────────────
3. RUN IDENTITY, TIME, AND ISOLATION

3.1 Run Identity
run_id = SHA256(
  normalized(spec.yaml) ||
  normalized(plan.yaml) ||
  toolchain_version ||
  model_identifiers_json ||
  workspace_snapshot_hash
)

Normalization:
  • YAML → canonical JSON (sorted keys, stable encoding)
  • UTF‑8 encoding for all strings

model_identifiers_json:
  • Stable JSON: { role: { name, version } }

workspace_snapshot_hash:
  • Deterministic hash of defined snapshot (see §10.1)

3.2 Time Semantics
  • All timestamps in UTC
  • Format: RFC 3339 / ISO 8601
  • Durations use monotonic clocks

3.3 Isolation
  • Each run uses workspace_root/run_id/
  • No cross‑run reads or writes
  • No shared mutable state

──────────────────────────────────────────────────────────────────────────────
4. ARTIFACTS, IMMUTABILITY, APPEND‑ONLY

Artifacts:
  • spec.yaml — immutable after Phase 0
  • plan.yaml — immutable after planning approval
  • proposed/ — versioned per task, never edited in place
  • patches/ — versioned per task, never edited in place
  • verification.json — append‑only
  • run_manifest.json — append‑only
  • logs/ — append‑only structured entries

Append‑Only Enforcement:
  • Files opened only in append mode
  • Each entry has monotonically increasing sequence_number
  • Optional checksum chain:
      checksum_n = SHA256(payload_n || checksum_{n-1})
  • Any truncation or non‑monotonic sequence → FAILED_TERMINAL

──────────────────────────────────────────────────────────────────────────────
5. TASK MODEL, STATES, CONCURRENCY

5.1 Task Definition
Each task in plan.yaml includes:
  • id
  • description
  • phase (generate, patch, refactor, analysis)
  • scope (files/modules)
  • required_invariants[]
  • risk_level (0–3)
  • dependencies[] (task ids)

Risk Levels:
  0 — single file, no interface impact
  1 — multi‑file, same module
  2 — cross‑module interface change
  3 — architectural boundary change

5.2 Task States
  • pending
  • running
  • completed
  • failed
  • blocked
  • skipped

5.3 Cycle Detection
  • Dependency cycles → all tasks in cycle = failed
  • Run transitions to REPLAN_REQUIRED

5.4 Concurrency Control
  • max_parallel_tasks is configurable
  • Tasks may run concurrently only if:
      – dependency subgraphs are disjoint
      – write scopes do not overlap
  • Scheduler must be deterministic:
      – topological order + stable tie‑breaking
  • Workspace writes require path‑level locks

──────────────────────────────────────────────────────────────────────────────
6. PHASES AND ORDERING

Phase 0 — Problem Intake (P)
  • Input: natural language request
  • Output: spec.yaml (goals, constraints, invariants, risk notes)

Phase 1 — Planning (P)
  • Input: spec.yaml
  • Output: plan.yaml (tasks, dependencies, invariants, risk levels)
  • No code emitted

Phase 2 — Generation (G)
  • Input: plan.yaml tasks with phase=generate
  • Output: proposed/ files
  • No workspace/ edits

Phase 3 — Patch / Refactor (D)
  • Input: tasks with phase in {patch, refactor}
  • Output: patches/ diffs
  • Must minimize diff and preserve invariants

Phase 4 — Integration (Orchestrator)
  • Apply proposed/ and patches/ atomically
  • Use dependency graph for ordering
  • Conflicts → failed or blocked tasks

Phase 5 — Verification (V)
  • Input: integrated workspace/
  • Output: verification.json entry
  • Must include:
      – build_status
      – tests_status (including skipped)
      – static_analysis_status
      – policy_checks_status
      – invariant_results[]

Ordering Rule:
  1. Integration completes
  2. Invariant predicates execute
  3. Verification tools run
  4. Completion eligibility evaluated atomically

──────────────────────────────────────────────────────────────────────────────
7. INVARIANTS AS MACHINE‑VERIFIABLE PREDICATES

Invariants must be expressed as predicates implemented in the toolchain.

Examples:
  • public_headers_hash_before == public_headers_hash_after
  • symbol_table_diff == ∅
  • openapi_public_paths_before == openapi_public_paths_after
  • allowed_hosts_superset(before, after) == true

Each invariant in plan.yaml references:
  • predicate_id
  • parameters

Invariant evaluation occurs after integration and before completion eligibility.

──────────────────────────────────────────────────────────────────────────────
8. ROUTING LOGIC

Routing is deterministic and based on phase, risk_level, and invariants.

Use Planner (P) when:
  • phase in {spec, plan, analysis}
  • invariants span multiple modules/layers

Use Generator (G) when:
  • phase == generate
  • surface_frozen == false
  • risk_level <= 1

Use Diff Model (D) when:
  • phase in {patch, refactor}
  • surface_frozen == true
  • risk_level >= 1

LLMs never perform final verification.

──────────────────────────────────────────────────────────────────────────────
9. RETRIES, FAILURE CLASSES, TERMINATION

Limits:
  • max_attempts_per_task
  • max_replan_cycles
  • timeout_per_phase

Failure Classes:
  • Local failure — task‑specific; retry allowed
  • Structural failure — invariants or plan invalid; triggers REPLAN_REQUIRED
  • Infrastructure failure — toolchain crash, resource exhaustion, network timeout;
      retry phase without replanning

Termination:
  • Exceeding max_attempts_per_task or max_replan_cycles → FAILED_TERMINAL
  • FAILED_TERMINAL is a hard stop

──────────────────────────────────────────────────────────────────────────────
10. DETERMINISM: SNAPSHOTS AND IDEMPOTENCE

10.1 Workspace Snapshot
Included:
  • source files
  • configuration files
  • dependency manifests

Excluded:
  • logs
  • temporary files
  • caches
  • build artifacts

Snapshot computed via deterministic directory walk (sorted paths, stable encoding).

10.2 Execution Safety Constraints
  • All task executions must be idempotent
  • All writes must be atomic
  • Partial writes must be rolled back before retry
  • Dependency graphs must be acyclic
  • Task scheduling must be deterministic
  • Completion eligibility evaluated only after verification.json entry is fully written

──────────────────────────────────────────────────────────────────────────────
11. AUDIT LOGGING

Each log entry includes:
  • run_id
  • phase
  • actor
  • task_id (if applicable)
  • input_artifacts
  • output_artifacts
  • result
  • timestamp (UTC, RFC 3339)
  • sequence_number
  • checksum (optional chain)

Logs are append‑only and stored under logs/run_id/.

──────────────────────────────────────────────────────────────────────────────
END OF SPEC v3

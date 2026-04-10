# Multi-Model Orchestration System — v3
## Deterministic • Phase-Gated • Invariant-First • Execution-Safe

---

## 1. Purpose

This directory defines the **orchestration contract** for a deterministic multi-model agent pipeline. It encodes scheduling, artifact immutability, invariant verification, execution safety, and audit logging rules. It does **not** execute tasks; it specifies the complete behavioral contract that execution engines must honour.

---

## 2. Roles

| Role | Symbol | Responsibility |
|---|---|---|
| Planner | P | Produces `spec.yaml` and `plan.yaml`; no code emitted |
| Generator | G | Writes new files under `proposed/`; never edits `workspace/` directly |
| Diff Model | D | Produces minimal patches under `patches/`; operates only within declared scope |
| Verifier | V | Non-LLM toolchain; builds, tests, static analysis, policy checks, invariant evaluation |

LLMs may plan, generate, and refine. LLMs may **not** verify.

---

## 3. Run Identity and Isolation

### 3.1 run_id Derivation

```
run_id = SHA-256(
  canonical_json(spec.yaml) ||
  canonical_json(plan.yaml) ||
  toolchain_version           ||
  model_identifiers_json      ||
  workspace_snapshot_hash
)
```

- YAML is normalised to canonical JSON (sorted keys, UTF-8, no trailing whitespace).
- `model_identifiers_json` = stable JSON `{ "<role>": { "name": "<n>", "version": "<v>" } }`.
- `workspace_snapshot_hash` is derived as described in §10.1 and `snapshots/snapshot_rules.md`.

### 3.2 Time Semantics

- All timestamps **UTC**, formatted as **RFC 3339 / ISO 8601** (e.g., `2026-04-10T23:10:44Z`).
- Duration measurements use monotonic clocks.

### 3.3 Isolation

- Every run operates exclusively under `workspace_root/<run_id>/`.
- No cross-run reads or writes are permitted.
- No shared mutable state exists between runs.

---

## 4. Artifacts and Immutability

| Artifact | Mutability |
|---|---|
| `spec.yaml` | Immutable after Phase 0 |
| `plan.yaml` | Immutable after planning approval (Phase 1) |
| `proposed/` | Versioned per task; never edited in place |
| `patches/` | Versioned per task; never edited in place |
| `verification.json` | Append-only |
| `run_manifest.json` | Append-only |
| `logs/` | Append-only structured entries |

### Append-Only Enforcement

- Files are opened in **append mode only**.
- Each entry carries a **monotonically increasing `sequence_number`**.
- Optional checksum chain: `checksum_n = SHA-256(payload_n || checksum_{n-1})`.
- Any truncation or non-monotonic sequence number transitions the run to **FAILED_TERMINAL**.

---

## 5. Task Model

### 5.1 Task Fields (plan.yaml)

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique task identifier |
| `description` | string | Human-readable summary |
| `phase` | enum | `generate` \| `patch` \| `refactor` \| `analysis` |
| `scope` | string[] | Files or modules the task may write |
| `required_invariants` | object[] | `{ predicate_id, parameters }` |
| `risk_level` | 0–3 | See below |
| `dependencies` | string[] | Task IDs that must complete first |

### 5.2 Risk Levels

| Level | Meaning |
|---|---|
| 0 | Single file, no interface impact |
| 1 | Multi-file, same module |
| 2 | Cross-module interface change |
| 3 | Architectural boundary change |

### 5.3 Task States

`pending` → `running` → `completed` | `failed` | `blocked` | `skipped`

### 5.4 Cycle Detection

Dependency cycles cause all tasks in the cycle to transition to `failed`; the run transitions to `REPLAN_REQUIRED`.

### 5.5 Concurrency Control

- `max_parallel_tasks` is configurable (see `runtime/concurrency_limits.json`).
- Two tasks may run concurrently **only if**:
  1. Their dependency subgraphs are disjoint, **and**
  2. Their declared write scopes do not overlap.
- Scheduler ordering is deterministic: topological sort with stable lexicographic tie-breaking.
- Workspace writes require path-level locks.

---

## 6. Phases and Ordering

| Phase | Name | Actor | Input | Output |
|---|---|---|---|---|
| 0 | Problem Intake | P | Natural language request | `spec.yaml` |
| 1 | Planning | P | `spec.yaml` | `plan.yaml` |
| 2 | Generation | G | `plan.yaml` (phase=generate) | `proposed/` files |
| 3 | Patch / Refactor | D | `plan.yaml` (phase∈{patch,refactor}) | `patches/` diffs |
| 4 | Integration | Orchestrator | `proposed/` + `patches/` | Updated `workspace/` |
| 5 | Verification | V | `workspace/` | `verification.json` entry |

**Completion Eligibility Order** (atomic):
1. Integration completes.
2. Invariant predicates execute.
3. Verification tools run.
4. Completion eligibility evaluated atomically after `verification.json` entry is fully written.

---

## 7. Invariants

All invariants are expressed as **machine-verifiable predicates** defined in `invariants/predicate_definitions.json`. Descriptive invariants are not permitted.

Canonical examples:

- `public_headers_unchanged` — `hash(public_headers_before) == hash(public_headers_after)`
- `symbol_table_stable` — `symbol_table_diff(before, after) == ∅`
- `openapi_surface_stable` — `openapi_public_paths_before == openapi_public_paths_after`
- `allowed_hosts_monotone` — `is_superset(allowed_hosts_after, allowed_hosts_before) == true`
- `no_new_critical_vulnerabilities` — `critical_vuln_count(after) <= critical_vuln_count(before)`

Each reference in `plan.yaml` must include `predicate_id` and `parameters`.

---

## 8. Routing Logic

| Condition | Route to |
|---|---|
| `phase ∈ {spec, plan, analysis}` OR invariants span multiple modules | Planner (P) |
| `phase == generate` AND `surface_frozen == false` AND `risk_level <= 1` | Generator (G) |
| `phase ∈ {patch, refactor}` AND `surface_frozen == true` AND `risk_level >= 1` | Diff Model (D) |

LLMs never perform final verification.

---

## 9. Retries, Failures, Termination

### Limits (runtime/concurrency_limits.json)

- `max_attempts_per_task`
- `max_replan_cycles`
- `timeout_per_phase`

### Failure Classes

| Class | Description | Recovery |
|---|---|---|
| Local | Task-specific failure | Retry task up to `max_attempts_per_task` |
| Structural | Invariant violation or invalid plan | Trigger `REPLAN_REQUIRED` |
| Infrastructure | Toolchain crash, resource exhaustion, network timeout | Retry phase without replanning |

### Termination

- Exceeding `max_attempts_per_task` OR `max_replan_cycles` → **FAILED_TERMINAL** (hard stop).
- `FAILED_TERMINAL` state is irreversible.

---

## 10. Determinism and Execution Safety

### 10.1 Workspace Snapshot

Defined in `snapshots/snapshot_rules.md`. Computed via a deterministic directory walk (sorted paths, stable encoding). Used as input to `run_id` derivation.

### 10.2 Execution Safety Constraints

- All task executions must be **idempotent** (see `runtime/idempotence.md`).
- All writes must be **atomic** (see `runtime/atomic_write.js`).
- Partial writes must be **rolled back** before retry (see `runtime/rollback.js`).
- Dependency graphs must be **acyclic** (enforced by `scheduler/dag_validator.js`).
- Task scheduling must be **deterministic** (`scheduler/scheduler.js`).
- Completion eligibility evaluated only after `verification.json` entry is fully written.

---

## 11. Audit Logging

Log entries are append-only, stored under `logs/<run_id>/`, and structured per `logging/log_entry.schema.json`.

Each entry includes: `run_id`, `phase`, `actor`, `task_id` (if applicable), `input_artifacts`, `output_artifacts`, `result`, `timestamp` (UTC RFC 3339), `sequence_number`, `checksum` (optional chain).

---

## 12. Directory Index

```
orchestration/
├── ORCHESTRATION.md              ← this file
├── spec.schema.json              ← schema for spec.yaml
├── plan.schema.json              ← schema for plan.yaml
├── run_manifest.schema.json      ← schema for run_manifest.json
├── invariants/
│   ├── predicate_definitions.json
│   └── predicate_schemas/        ← per-predicate input/output schemas
├── scheduler/
│   ├── dag_validator.js          ← cycle detection, DAG validation
│   ├── scheduler.js              ← deterministic topological sort
│   └── scope_conflict.js         ← write-scope overlap detection
├── snapshots/
│   ├── snapshot_rules.md         ← included/excluded path rules
│   └── snapshot_hash.js          ← canonical directory walk + hashing
├── logging/
│   ├── log_entry.schema.json     ← structured log entry schema
│   └── append_only_log.js        ← append-only writer with checksums
├── runtime/
│   ├── atomic_write.js           ← atomic file replacement
│   ├── rollback.js               ← rollback rules for partial writes
│   ├── idempotence.md            ← idempotence requirements
│   └── concurrency_limits.json   ← scheduling constraints
└── examples/
    ├── example_spec.yaml
    ├── example_plan.yaml
    └── example_run_manifest.json
```

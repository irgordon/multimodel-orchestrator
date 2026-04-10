# Idempotence Requirements
## Multi-Model Orchestration Spec v3

---

## 1. Definition

A task execution is **idempotent** if running it more than once with the same
inputs produces the same observable outputs and the same final workspace state
as running it exactly once. Idempotence is a hard requirement for all task
executions in this orchestration system.

---

## 2. Why Idempotence Is Required

- Tasks may be retried after a local, structural, or infrastructure failure.
- A task that is retried after a partial execution must produce the same result
  as if it had never run before.
- Without idempotence, retries can corrupt the workspace, produce duplicate
  artefacts, or violate invariants.

---

## 3. Scope of This Requirement

This requirement applies to all task types across all phases:

| Phase | Task Type | Actor |
|---|---|---|
| 2 | `generate` | Generator (G) |
| 3 | `patch` | Diff Model (D) |
| 3 | `refactor` | Diff Model (D) |
| 4 | `integration` | Orchestrator |
| 5 | `verification` | Verifier (V) |

---

## 4. Idempotence Invariants

The following invariants MUST hold for every task execution:

### 4.1 Output Determinism

Given the same `run_id`, `task_id`, `attempt_number`, and workspace snapshot
hash, the task MUST produce byte-identical output artefacts on every execution.

Formally:
```
output_hash(task, inputs, attempt) == output_hash(task, inputs, attempt)
  for all repeated invocations with identical inputs
```

### 4.2 No Duplicate Artefact Creation

Re-running a task that has already produced `proposed/<task_id>/` or
`patches/<task_id>/` MUST overwrite those artefacts atomically — not append to
or duplicate them. The final state after N runs is identical to the state after 1 run.

### 4.3 Append-Only Artefact Safety

For append-only artefacts (`run_manifest.json`, `logs/`), the orchestrator MUST
check the current `sequence_number` before writing. Duplicate entries detected
by a non-advancing sequence_number MUST be rejected and not written.

### 4.4 Workspace State Convergence

After any number of retries of the same task with the same inputs, the workspace
state under `run_id/` MUST converge to the same final state. Tasks MUST NOT
accumulate side effects across attempts.

### 4.5 Rollback Before Retry

Before any retry of a failed task, the orchestrator MUST invoke `rollback.js`
to remove partial write artefacts. A task MUST NOT be retried in a state where
partial outputs from a prior attempt remain.

---

## 5. Implementation Requirements for Each Task Type

### 5.1 Generator (phase=generate)

- The Generator MUST derive its output exclusively from the inputs listed in
  `task.scope` and the contents of `spec.yaml` and `plan.yaml`.
- Model outputs MUST be rendered to `proposed/<task_id>/` using `atomic_write.js`.
- If `proposed/<task_id>/` already exists with the correct content hash, the
  task is considered complete without re-running the model.

### 5.2 Diff Model (phase=patch or phase=refactor)

- The Diff Model MUST derive its patches exclusively from the declared scope
  and the current workspace snapshot hash.
- Patches MUST be written to `patches/<task_id>/` using `atomic_write.js`.
- Re-application of the same patch to the same base state MUST produce the
  same result.

### 5.3 Integration (phase=integration)

- The orchestrator MUST check whether each proposed file or patch has already
  been applied (compare workspace content hash to expected post-integration hash).
- Already-applied artefacts MUST be skipped — not re-applied.
- All file applications MUST use `atomic_write.js`.

### 5.4 Verification (phase=verification)

- The Verifier MUST be a deterministic, stateless toolchain.
- Running the Verifier twice against the same workspace snapshot MUST produce
  byte-identical `verification.json` entries.
- Non-deterministic test infrastructure (e.g., random port selection, wall-clock
  dependent behaviour) MUST be seeded or mocked to ensure determinism.

---

## 6. Detection of Non-Idempotent Executions

The orchestrator SHOULD detect non-idempotent behaviour by:

1. Hashing the workspace snapshot before and after a task's write phase.
2. Comparing the post-execution hash to the expected hash recorded in the
   run manifest.
3. If they differ on a retry, transitioning the task to `failed` with
   `failure_class: structural` and emitting a `REPLAN_REQUIRED` event.

---

## 7. Prohibited Behaviours

The following behaviours are explicitly prohibited because they break idempotence:

- Writing to paths outside the task's declared `scope`.
- Generating random identifiers or timestamps as part of output artefact content.
- Appending to existing files in `proposed/` or `patches/` instead of replacing them.
- Performing network calls whose results are incorporated into output artefacts
  without deterministic caching or pinning.
- Depending on wall-clock time in the content of generated files (timestamps in
  log entries and manifests are exempt — they are metadata, not artefact content).

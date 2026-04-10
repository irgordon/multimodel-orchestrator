# Workspace Snapshot Rules
## Multi-Model Orchestration Spec v3

This document defines the canonical rules for computing a **workspace snapshot**:
the deterministic, content-addressable fingerprint of the project source that is
used as an input to `run_id` derivation and to invariant predicate evaluation.

---

## 1. Purpose

The workspace snapshot hash allows the orchestration system to:

1. Derive a stable `run_id` that encodes the exact state of the source tree.
2. Detect whether any invariant predicate's "before" state has been altered between phases.
3. Provide a tamper-evident record of the workspace at any phase boundary.

---

## 2. Included Paths

The snapshot includes **all** files under the workspace root that match **at least one** of
the following rules, **unless** excluded by §3.

| Rule | Pattern | Rationale |
|---|---|---|
| Source files | All files not otherwise excluded | Core content under version control |
| Configuration files | `*.json`, `*.yaml`, `*.yml`, `*.toml`, `*.ini`, `*.env.example` | Build and tooling configuration |
| Dependency manifests | `package.json`, `package-lock.json`, `yarn.lock`, `Pipfile`, `Pipfile.lock`, `requirements*.txt`, `go.mod`, `go.sum`, `Cargo.toml`, `Cargo.lock`, `pom.xml`, `build.gradle`, `Gemfile`, `Gemfile.lock` | Reproducibility of dependency resolution |
| Inline schemas | `*.schema.json`, `*.schema.yaml` | Contract definitions |

---

## 3. Excluded Paths

The following paths and patterns are **always excluded** from the snapshot, regardless of §2:

| Category | Patterns |
|---|---|
| Build artifacts | `dist/`, `build/`, `out/`, `target/`, `*.o`, `*.a`, `*.so`, `*.dylib`, `*.exe`, `*.class`, `*.pyc`, `__pycache__/` |
| Caches | `.cache/`, `node_modules/.cache/`, `.mypy_cache/`, `.pytest_cache/`, `.tox/`, `.gradle/`, `.m2/` |
| Dependency install dirs | `node_modules/`, `vendor/`, `.venv/`, `venv/`, `env/`, `.bundle/` |
| Temporary files | `tmp/`, `temp/`, `*.tmp`, `*.temp`, `*.swp`, `*.bak` |
| Orchestration run artifacts | `logs/`, `run_manifest.json`, `proposed/`, `patches/`, `verification.json` |
| IDE/editor metadata | `.idea/`, `.vscode/`, `*.iml` |
| OS metadata | `.DS_Store`, `Thumbs.db` |
| Git internals | `.git/` |

---

## 4. Directory Walk Rules

The snapshot walk MUST be **deterministic** and **reproducible**:

1. **Root**: Begin at `workspace_root` (the value recorded in `run_id_seed`).
2. **Traversal order**: Entries in each directory are sorted by filename using **byte-order (lexicographic) comparison** on the UTF-8 encoded filename. Directories are traversed recursively after their contents are sorted.
3. **Symlinks**: Followed for regular files. Symlink loops are detected and cause an error — they do not silently produce incorrect output.
4. **Empty directories**: Excluded from the hash (they contribute no bytes).
5. **File encoding**: Files are read as raw bytes. No line-ending normalisation is applied.
6. **Metadata**: Only file **content** is hashed. Permissions, timestamps, and ownership are excluded.

---

## 5. Hash Algorithm

All hashing uses **SHA-256** (hex-encoded, lower-case).

### Per-file entry

```
file_entry = SHA-256(relative_path_utf8 || NUL || file_content_bytes)
```

- `relative_path_utf8`: The file's path relative to `workspace_root`, with `/` as separator.
- `NUL`: A single zero byte (`\x00`) used as delimiter.
- `file_content_bytes`: Raw bytes of the file.

### Directory hash aggregation

After collecting all `file_entry` values (in sorted path order):

```
snapshot_hash = SHA-256(
  file_entry_0 || file_entry_1 || ... || file_entry_N
)
```

Each `file_entry` is the 32-byte (256-bit) binary SHA-256 digest — not the hex string — so the outer SHA-256 operates on `32 * N` bytes.

If the snapshot contains zero files, the `snapshot_hash` is:

```
snapshot_hash = SHA-256("")   # empty input
```

---

## 6. Output Format

The snapshot computation returns:

```json
{
  "snapshot_hash": "<64 hex chars>",
  "file_count": 42,
  "computed_at": "2026-04-10T23:10:44Z"
}
```

The `snapshot_hash` value is used directly in `run_id` derivation and in predicate inputs.

---

## 7. Implementation Reference

See `snapshot_hash.js` for the canonical Node.js implementation of these rules.

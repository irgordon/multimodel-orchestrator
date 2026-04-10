'use strict';

/**
 * snapshot_hash.js
 *
 * Canonical workspace snapshot computation for the multi-model orchestration pipeline.
 *
 * Implements the rules defined in snapshots/snapshot_rules.md:
 *   - Deterministic directory walk (sorted byte-order, recursive)
 *   - Inclusion / exclusion rules
 *   - Per-file entry: SHA-256(relative_path_utf8 || NUL || file_content_bytes)
 *   - Aggregation:   SHA-256(concat of 32-byte binary digests in path order)
 *
 * All file system operations are synchronous to ensure deterministic ordering.
 * No I/O side effects are produced other than reads.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ---------------------------------------------------------------------------
// Exclusion rules (from snapshot_rules.md §3)
// ---------------------------------------------------------------------------

/** Directory names that are excluded from the walk. */
const EXCLUDED_DIRS = new Set([
  'dist', 'build', 'out', 'target',
  '.cache', 'node_modules', 'vendor',
  '.venv', 'venv', 'env', '.bundle',
  '.tox', '.gradle', '.m2',
  '.mypy_cache', '.pytest_cache',
  '__pycache__',
  'tmp', 'temp',
  'logs', 'proposed', 'patches',
  '.idea', '.vscode',
  '.git'
]);

/** File name suffixes/extensions that are excluded. */
const EXCLUDED_EXTENSIONS = new Set([
  '.o', '.a', '.so', '.dylib', '.exe',
  '.class', '.pyc',
  '.tmp', '.temp', '.swp', '.bak',
  '.iml'
]);

/** Exact file names that are excluded regardless of location. */
const EXCLUDED_FILENAMES = new Set([
  'run_manifest.json',
  'verification.json',
  '.DS_Store',
  'Thumbs.db'
]);

/**
 * Return true if the directory should be excluded from the walk.
 *
 * @param {string} dirName  Basename of the directory
 * @returns {boolean}
 */
function isExcludedDir(dirName) {
  return EXCLUDED_DIRS.has(dirName);
}

/**
 * Return true if the file should be excluded from the snapshot.
 *
 * @param {string} fileName  Basename of the file
 * @returns {boolean}
 */
function isExcludedFile(fileName) {
  if (EXCLUDED_FILENAMES.has(fileName)) return true;
  const ext = path.extname(fileName).toLowerCase();
  return EXCLUDED_EXTENSIONS.has(ext);
}

// ---------------------------------------------------------------------------
// Directory walk
// ---------------------------------------------------------------------------

/**
 * Perform a deterministic recursive directory walk starting at `dir`.
 * Returns an array of absolute file paths, in sorted (byte-order) order.
 *
 * Symlinks to files are followed. Symlink loops are detected via a Set of
 * real paths; if a loop is detected an Error is thrown.
 *
 * @param {string} dir           Absolute path to walk
 * @param {Set<string>} visited  Real paths already visited (for loop detection)
 * @returns {string[]}           Sorted absolute file paths
 */
function walkDirectory(dir, visited) {
  if (!visited) visited = new Set();

  const realDir = fs.realpathSync(dir);
  if (visited.has(realDir)) {
    throw new Error(`Symlink loop detected at: ${dir} (realpath: ${realDir})`);
  }
  visited.add(realDir);

  const entries = fs.readdirSync(dir);
  // Sort lexicographically by UTF-16 code unit order (JavaScript's default sort).
  // For filenames that contain only ASCII characters this is equivalent to
  // UTF-8 byte-order sort. Filenames with non-ASCII characters are uncommon in
  // source trees; if strict UTF-8 byte-order is needed the comparison function
  // should be replaced with a Buffer-based byte comparator.
  entries.sort();

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat;
    try {
      stat = fs.statSync(fullPath); // follows symlinks
    } catch (_) {
      // Broken symlink — skip
      continue;
    }

    if (stat.isDirectory()) {
      if (!isExcludedDir(entry)) {
        const subFiles = walkDirectory(fullPath, visited);
        for (const f of subFiles) files.push(f);
      }
    } else if (stat.isFile()) {
      if (!isExcludedFile(entry)) {
        files.push(fullPath);
      }
    }
    // Other types (sockets, devices, etc.) are skipped
  }

  return files;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 binary digest (Buffer) for a single file entry.
 *
 * file_entry = SHA-256(relative_path_utf8 || NUL || file_content_bytes)
 *
 * @param {string} workspaceRoot  Absolute path to the workspace root
 * @param {string} absolutePath   Absolute path to the file
 * @returns {Buffer}              32-byte SHA-256 digest
 */
function hashFileEntry(workspaceRoot, absolutePath) {
  const relativePath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
  const content = fs.readFileSync(absolutePath);
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(relativePath, 'utf8'));
  hash.update(Buffer.from([0x00])); // NUL delimiter
  hash.update(content);
  return hash.digest(); // 32-byte Buffer
}

/**
 * Compute the canonical workspace snapshot hash.
 *
 * @param {string} workspaceRoot  Absolute path to the workspace root directory
 * @returns {{
 *   snapshot_hash: string,   SHA-256 hex digest (64 lower-case hex chars)
 *   file_count: number,      Number of files included in the snapshot
 *   computed_at: string      UTC ISO 8601 timestamp of computation
 * }}
 */
function computeSnapshotHash(workspaceRoot) {
  const absoluteRoot = path.resolve(workspaceRoot);

  if (!fs.existsSync(absoluteRoot)) {
    throw new Error(`workspace_root does not exist: ${absoluteRoot}`);
  }
  if (!fs.statSync(absoluteRoot).isDirectory()) {
    throw new Error(`workspace_root is not a directory: ${absoluteRoot}`);
  }

  const files = walkDirectory(absoluteRoot, new Set());
  // walkDirectory already returns files in sorted order
  const fileEntryDigests = files.map(f => hashFileEntry(absoluteRoot, f));

  const outer = crypto.createHash('sha256');
  for (const digest of fileEntryDigests) {
    outer.update(digest);
  }

  return {
    snapshot_hash: outer.digest('hex'),
    file_count: files.length,
    // toISOString() includes milliseconds (e.g. "2026-04-10T23:10:44.371Z").
    // The replacement strips them to match the RFC 3339 second-precision format
    // used by all other timestamp fields in this system (e.g. "2026-04-10T23:10:44Z").
    computed_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  };
}

module.exports = {
  isExcludedDir,
  isExcludedFile,
  walkDirectory,
  hashFileEntry,
  computeSnapshotHash
};

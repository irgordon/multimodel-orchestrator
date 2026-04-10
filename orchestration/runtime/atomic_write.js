'use strict';

/**
 * atomic_write.js
 *
 * Atomic file replacement for the multi-model orchestration pipeline.
 *
 * Strategy:
 *   1. Write content to a temporary file in the same directory as the target.
 *      Using the same directory ensures the rename is on the same filesystem
 *      (required for atomic rename(2) / fs.renameSync).
 *   2. Sync the temporary file to disk (fsync).
 *   3. Rename the temporary file to the target path.
 *      On POSIX systems, rename(2) is atomic with respect to other processes
 *      reading the target — readers always see either the old or the new content.
 *   4. Sync the parent directory to persist the rename.
 *
 * If any step fails, the temporary file is removed (best-effort) and the
 * original target is left untouched.
 *
 * Limitations:
 *   - On Windows, rename is not atomic if the target exists in some scenarios.
 *     This implementation does not add Windows-specific mitigations.
 *   - This module does not provide cross-process locking. Callers must ensure
 *     only one writer operates on a given target path at a time.
 *
 * All exported functions are synchronous.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

/**
 * Generate a unique temporary file path in the same directory as `targetPath`.
 *
 * @param {string} targetPath
 * @returns {string}
 */
function tempPathFor(targetPath) {
  const dir  = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const rand = crypto.randomBytes(8).toString('hex');
  return path.join(dir, `.${base}.${rand}.tmp`);
}

/**
 * Atomically write `content` to `targetPath`.
 *
 * @param {string}          targetPath  Absolute path to the destination file
 * @param {Buffer|string}   content     Data to write; strings are encoded as UTF-8
 * @param {object}          [options]
 * @param {string}          [options.encoding='utf8']  Encoding when content is a string
 * @returns {void}
 * @throws {Error}  If the write, sync, or rename fails
 */
function atomicWrite(targetPath, content, options = {}) {
  const encoding = options.encoding || 'utf8';
  const absTarget = path.resolve(targetPath);
  const tmpPath   = tempPathFor(absTarget);

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(absTarget), { recursive: true });

  let fd;
  try {
    fd = fs.openSync(tmpPath, 'w');
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, encoding);
    let written = 0;
    while (written < buf.length) {
      written += fs.writeSync(fd, buf, written, buf.length - written);
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;

    fs.renameSync(tmpPath, absTarget);

    // Sync the parent directory so the rename is durable
    syncDirectory(path.dirname(absTarget));
  } catch (err) {
    // Close fd if still open
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_) {}
    }
    // Remove temp file (best-effort)
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    throw err;
  }
}

/**
 * Atomically write a canonical JSON value to `targetPath`.
 *
 * Keys are sorted recursively before serialisation for deterministic output.
 *
 * @param {string}  targetPath
 * @param {*}       value       JSON-serialisable value
 * @returns {void}
 */
function atomicWriteJson(targetPath, value) {
  atomicWrite(targetPath, canonicalJsonString(value) + '\n', { encoding: 'utf8' });
}

/**
 * Produce a canonical JSON string (sorted keys, no extra whitespace).
 *
 * @param {*} value
 * @returns {string}
 */
function canonicalJsonString(value) {
  return JSON.stringify(deepSortKeys(value));
}

/**
 * Recursively sort object keys.
 *
 * @param {*} value
 * @returns {*}
 */
function deepSortKeys(value) {
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const k of Object.keys(value).sort()) {
      sorted[k] = deepSortKeys(value[k]);
    }
    return sorted;
  }
  return value;
}

/**
 * Attempt to fsync a directory file descriptor.
 * On platforms or file systems where this is not supported, the error is
 * swallowed — the rename is already durable on most modern file systems.
 *
 * @param {string} dirPath
 */
function syncDirectory(dirPath) {
  let dfd;
  try {
    dfd = fs.openSync(dirPath, 'r');
    fs.fsyncSync(dfd);
  } catch (_) {
    // Non-fatal: not all platforms support fsync on directories
  } finally {
    if (dfd !== undefined) {
      try { fs.closeSync(dfd); } catch (_) {}
    }
  }
}

module.exports = {
  atomicWrite,
  atomicWriteJson,
  canonicalJsonString,
  deepSortKeys,
  tempPathFor
};

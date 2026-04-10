'use strict';

/**
 * append_only_log.js
 *
 * Append-only structured log writer for the multi-model orchestration pipeline.
 *
 * Contract:
 *   - Log files are opened exclusively in append mode ('a' flag).
 *   - Each entry is written as a single line of canonical JSON followed by '\n'.
 *   - sequence_number is maintained in memory and incremented monotonically.
 *   - An optional SHA-256 checksum chain is maintained:
 *       checksum_n = SHA-256(canonical_json(payload_n) || checksum_{n-1})
 *     where checksum_0 (the seed) is the 64-char hex string of SHA-256("").
 *   - Any write failure throws an error — partial writes are not silently swallowed.
 *   - The writer is NOT suitable for concurrent use from multiple processes on the
 *     same file; use a per-process writer and rely on OS append atomicity only for
 *     single-write entries <= PIPE_BUF (typically 4096 bytes on Linux).
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

/** SHA-256 of empty string — used as the initial checksum seed. */
const INITIAL_CHECKSUM = crypto.createHash('sha256').update('').digest('hex');

/**
 * Produce a canonical JSON string (sorted keys, no extra whitespace).
 * Ensures deterministic serialisation for checksum computation.
 *
 * @param {object} obj
 * @returns {string}
 */
function canonicalJson(obj) {
  return JSON.stringify(sortedKeys(obj));
}

/**
 * Recursively sort object keys for canonical JSON serialisation.
 *
 * @param {*} value
 * @returns {*}
 */
function sortedKeys(value) {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortedKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Compute SHA-256(canonical_json(payload) || previousChecksum).
 *
 * @param {object} payload
 * @param {string} previousChecksum  64-char hex string
 * @returns {string}                 64-char hex string
 */
function computeChecksum(payload, previousChecksum) {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(canonicalJson(payload), 'utf8'));
  hash.update(Buffer.from(previousChecksum, 'utf8'));
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// AppendOnlyLog class
// ---------------------------------------------------------------------------

class AppendOnlyLog {
  /**
   * @param {string}  filePath          Absolute path to the log file
   * @param {object}  options
   * @param {boolean} [options.enableChecksum=true]  Whether to compute checksum chain
   * @param {number}  [options.initialSequence=1]    Starting sequence number
   */
  constructor(filePath, options = {}) {
    this._filePath         = path.resolve(filePath);
    this._enableChecksum   = options.enableChecksum !== false;
    this._sequence         = typeof options.initialSequence === 'number'
                               ? options.initialSequence
                               : 1;
    this._previousChecksum = INITIAL_CHECKSUM;
    this._closed           = false;

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(this._filePath), { recursive: true });

    // Open the file in append mode; create if it does not exist.
    // Using 'a' ensures OS-level append semantics.
    this._fd = fs.openSync(this._filePath, 'a');
  }

  /**
   * Append a structured log entry.
   *
   * @param {object} entryFields  Fields as defined by log_entry.schema.json,
   *                              EXCLUDING sequence_number and checksum (added here).
   * @returns {object}            The complete entry as written.
   * @throws {Error}              If the log is closed or the write fails.
   */
  append(entryFields) {
    if (this._closed) {
      throw new Error('AppendOnlyLog: attempt to write to a closed log');
    }

    const sequenceNumber = this._sequence;

    // Build the entry without checksum first (for checksum computation)
    const entryWithoutChecksum = Object.assign({}, entryFields, {
      sequence_number: sequenceNumber
    });

    let checksum;
    if (this._enableChecksum) {
      checksum = computeChecksum(entryWithoutChecksum, this._previousChecksum);
    }

    const fullEntry = this._enableChecksum
      ? Object.assign({}, entryWithoutChecksum, { checksum })
      : entryWithoutChecksum;

    const line = canonicalJson(fullEntry) + '\n';
    const buf  = Buffer.from(line, 'utf8');

    // Write synchronously to the file descriptor opened in append mode.
    let written = 0;
    while (written < buf.length) {
      written += fs.writeSync(this._fd, buf, written, buf.length - written);
    }

    // Advance state only after a successful write
    this._sequence         = sequenceNumber + 1;
    if (this._enableChecksum) {
      this._previousChecksum = checksum;
    }

    return fullEntry;
  }

  /**
   * Flush and close the underlying file descriptor.
   * After calling close(), append() will throw.
   */
  close() {
    if (!this._closed) {
      fs.closeSync(this._fd);
      this._closed = true;
    }
  }

  /** Current sequence number that will be assigned to the next entry. */
  get nextSequenceNumber() { return this._sequence; }

  /** Most recent checksum in the chain (or the initial seed if no entries yet). */
  get previousChecksum() { return this._previousChecksum; }
}

module.exports = {
  AppendOnlyLog,
  canonicalJson,
  computeChecksum,
  INITIAL_CHECKSUM
};

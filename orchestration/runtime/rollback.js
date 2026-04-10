'use strict';

/**
 * rollback.js
 *
 * Rollback rules and utilities for the multi-model orchestration pipeline.
 *
 * Rollback is triggered whenever a task's write phase terminates abnormally
 * (exception, timeout, invariant failure) before its output has been committed
 * atomically to the workspace.
 *
 * Rules (from spec §10.2):
 *   - All writes must be atomic (see atomic_write.js).
 *   - Partial writes must be rolled back before a retry is attempted.
 *   - A task may not be retried while any of its in-progress write artefacts
 *     remain in an intermediate state.
 *
 * Strategy:
 *   1. Before a task's write phase begins, the orchestrator registers an
 *      RollbackContext containing the list of target paths the task intends
 *      to write.
 *   2. The write phase uses atomic_write.js for all writes (write to temp,
 *      rename). This means any incomplete write leaves only a temp file, never
 *      a corrupt target.
 *   3. On failure, rollback() is called with the RollbackContext:
 *        a. All temp files matching the pattern used by atomic_write are removed.
 *        b. Any target file that was fully written (renamed) during this attempt
 *           is removed if it was not present before the attempt started.
 *   4. Pre-existing files (present before the task started) are restored from
 *      their recorded pre-write snapshot path if one was provided; otherwise
 *      they are left as-is (a partial overwrite was prevented by atomicity).
 *
 * This module does NOT perform I/O beyond file removal and restoration.
 * It does NOT interact with the run_manifest or logs — the caller is responsible
 * for recording rollback events.
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// RollbackContext
// ---------------------------------------------------------------------------

/**
 * Tracks the artefacts associated with one task execution attempt so that they
 * can be cleaned up on failure.
 */
class RollbackContext {
  /**
   * @param {string} taskId   ID of the task being tracked
   * @param {string} runId    run_id for logging / isolation checks
   */
  constructor(taskId, runId) {
    this.taskId   = taskId;
    this.runId    = runId;
    /** @type {Array<{targetPath: string, backupPath: string|null, existed: boolean}>} */
    this._entries = [];
    this._committed = false;
  }

  /**
   * Register a target path that the task intends to write.
   *
   * @param {string}      targetPath   Absolute path of the file to be written
   * @param {string|null} backupPath   Path to a backup copy of the original file,
   *                                   or null if no backup is available
   */
  register(targetPath, backupPath) {
    const absTarget = path.resolve(targetPath);
    const existed   = fs.existsSync(absTarget);
    this._entries.push({
      targetPath: absTarget,
      backupPath: backupPath ? path.resolve(backupPath) : null,
      existed
    });
  }

  /**
   * Mark this context as successfully committed.
   * After commit, rollback() is a no-op.
   */
  commit() {
    this._committed = true;
  }

  /** Return true if this context has been committed (task succeeded). */
  get isCommitted() { return this._committed; }

  /** Read-only snapshot of registered entries. */
  get entries() { return this._entries.slice(); }
}

// ---------------------------------------------------------------------------
// Temp-file cleanup
// ---------------------------------------------------------------------------

/**
 * Remove any temp files left behind by atomic_write.js in the same directory
 * as each registered target path.
 *
 * Temp files match the pattern: `.<basename>.<16 hex chars>.tmp`
 *
 * @param {RollbackContext} ctx
 * @returns {string[]}  Paths of temp files that were removed
 */
function cleanupTempFiles(ctx) {
  const removed = [];
  const dirsChecked = new Set();

  for (const { targetPath } of ctx.entries) {
    const dir      = path.dirname(targetPath);
    const basename = path.basename(targetPath);

    if (dirsChecked.has(dir)) continue;
    dirsChecked.add(dir);

    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch (_) {
      continue; // directory doesn't exist — nothing to clean up
    }

    const tempPattern = new RegExp(`^\\.${escapeRegExp(basename)}\\.[0-9a-f]{16}\\.tmp$`);
    for (const entry of entries) {
      if (tempPattern.test(entry)) {
        const fullPath = path.join(dir, entry);
        try {
          fs.unlinkSync(fullPath);
          removed.push(fullPath);
        } catch (_) {
          // Best-effort: log externally if needed
        }
      }
    }
  }

  return removed;
}

// ---------------------------------------------------------------------------
// Target-file rollback
// ---------------------------------------------------------------------------

/**
 * Roll back written target files.
 *
 * For each registered entry:
 *   - If a backupPath is provided and the original file existed: restore the
 *     backup to the target path using an atomic rename.
 *   - If no backup and the file did NOT exist before the attempt: remove the
 *     file created during this attempt.
 *   - If no backup and the file DID exist before the attempt: leave as-is.
 *     (The write was atomic, so the file is either the old content or was
 *     never replaced — partial corruption cannot occur.)
 *
 * @param {RollbackContext} ctx
 * @returns {Array<{path: string, action: string}>}  Audit log of actions taken
 */
function rollbackTargets(ctx) {
  const actions = [];

  for (const { targetPath, backupPath, existed } of ctx.entries) {
    if (backupPath && fs.existsSync(backupPath)) {
      // Restore original from backup (atomic)
      try {
        fs.renameSync(backupPath, targetPath);
        actions.push({ path: targetPath, action: 'restored_from_backup' });
      } catch (err) {
        actions.push({ path: targetPath, action: 'restore_failed', error: err.message });
      }
    } else if (!existed && fs.existsSync(targetPath)) {
      // File was created during this attempt — remove it
      try {
        fs.unlinkSync(targetPath);
        actions.push({ path: targetPath, action: 'removed_new_file' });
      } catch (err) {
        actions.push({ path: targetPath, action: 'remove_failed', error: err.message });
      }
    } else {
      actions.push({ path: targetPath, action: 'no_action_required' });
    }
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Main rollback entry point
// ---------------------------------------------------------------------------

/**
 * Execute a full rollback for a failed task attempt.
 *
 * Steps:
 *   1. Clean up any temp files left by atomic_write.
 *   2. Roll back any fully-written target files.
 *
 * @param {RollbackContext} ctx
 * @returns {{
 *   taskId: string,
 *   runId: string,
 *   tempFilesRemoved: string[],
 *   targetActions: Array<{path: string, action: string}>
 * }}
 */
function rollback(ctx) {
  if (ctx.isCommitted) {
    return {
      taskId: ctx.taskId,
      runId: ctx.runId,
      tempFilesRemoved: [],
      targetActions: []
    };
  }

  const tempFilesRemoved = cleanupTempFiles(ctx);
  const targetActions    = rollbackTargets(ctx);

  return {
    taskId: ctx.taskId,
    runId: ctx.runId,
    tempFilesRemoved,
    targetActions
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  RollbackContext,
  cleanupTempFiles,
  rollbackTargets,
  rollback
};

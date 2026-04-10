'use strict';

/**
 * scope_conflict.js
 *
 * Write-scope overlap detection for the orchestration scheduler.
 *
 * Two tasks have a scope conflict if their declared write-scope path sets
 * have a non-empty intersection. Conflicting tasks MUST NOT run concurrently.
 *
 * Path comparison is case-sensitive and uses exact string equality.
 * Paths are normalised by removing trailing slashes (except root "/").
 *
 * All exported functions are pure and deterministic. No I/O is performed.
 */

/**
 * Normalise a single path string for comparison.
 * Removes trailing slashes unless the path is exactly "/".
 *
 * @param {string} p
 * @returns {string}
 */
function normalisePath(p) {
  if (p === '/') return p;
  return p.replace(/\/+$/, '');
}

/**
 * Normalise an array of path strings.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
function normalisePaths(paths) {
  return paths.map(normalisePath);
}

/**
 * Determine whether two scope path arrays overlap.
 *
 * @param {string[]} scopeA  Write-scope paths for task A
 * @param {string[]} scopeB  Write-scope paths for task B
 * @returns {{ conflicts: boolean, overlappingPaths: string[] }}
 */
function detectScopeOverlap(scopeA, scopeB) {
  const setA = new Set(normalisePaths(scopeA));
  const overlappingPaths = normalisePaths(scopeB).filter(p => setA.has(p));
  overlappingPaths.sort();
  return {
    conflicts: overlappingPaths.length > 0,
    overlappingPaths
  };
}

/**
 * Compute all pairwise scope conflicts for a list of tasks.
 * Only pairs (i < j) are checked to avoid duplicates.
 *
 * @param {Array<{id: string, scope: string[]}>} tasks
 * @returns {Array<{ taskA: string, taskB: string, overlappingPaths: string[] }>}
 *   Sorted by [taskA, taskB] lexicographically.
 */
function findAllScopeConflicts(tasks) {
  const results = [];

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      const { conflicts, overlappingPaths } = detectScopeOverlap(a.scope, b.scope);
      if (conflicts) {
        results.push({
          taskA: a.id,
          taskB: b.id,
          overlappingPaths
        });
      }
    }
  }

  // Stable sort by taskA then taskB for deterministic output
  results.sort((x, y) => {
    if (x.taskA < y.taskA) return -1;
    if (x.taskA > y.taskA) return  1;
    if (x.taskB < y.taskB) return -1;
    if (x.taskB > y.taskB) return  1;
    return 0;
  });

  return results;
}

/**
 * Build a conflict adjacency set for efficient lookup during scheduling.
 * Returns a Map from task ID to the Set of task IDs it conflicts with.
 *
 * @param {Array<{id: string, scope: string[]}>} tasks
 * @returns {Map<string, Set<string>>}
 */
function buildConflictMap(tasks) {
  const conflicts = findAllScopeConflicts(tasks);
  const map = new Map();
  for (const task of tasks) map.set(task.id, new Set());
  for (const { taskA, taskB } of conflicts) {
    map.get(taskA).add(taskB);
    map.get(taskB).add(taskA);
  }
  return map;
}

/**
 * Determine whether a candidate task conflicts with any currently running task.
 *
 * @param {string} candidateId
 * @param {string[]} runningIds     Task IDs currently in running state
 * @param {Map<string, Set<string>>} conflictMap  Built by buildConflictMap
 * @returns {{ blocked: boolean, blockedBy: string[] }}
 */
function isBlockedByRunning(candidateId, runningIds, conflictMap) {
  const conflictsForCandidate = conflictMap.get(candidateId) || new Set();
  const blockedBy = runningIds.filter(id => conflictsForCandidate.has(id)).sort();
  return {
    blocked: blockedBy.length > 0,
    blockedBy
  };
}

module.exports = {
  normalisePath,
  normalisePaths,
  detectScopeOverlap,
  findAllScopeConflicts,
  buildConflictMap,
  isBlockedByRunning
};

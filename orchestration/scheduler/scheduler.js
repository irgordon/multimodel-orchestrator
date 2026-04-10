'use strict';

/**
 * scheduler.js
 *
 * Deterministic topological scheduler for the multi-model orchestration pipeline.
 *
 * Produces a stable execution order from a validated task DAG using Kahn's
 * algorithm with lexicographic tie-breaking on task IDs. The result is fully
 * deterministic: the same input always produces the same output regardless of
 * insertion order or JavaScript engine version.
 *
 * All exported functions are pure and deterministic. No I/O is performed.
 */

/**
 * Compute the in-degree of each node and the reverse adjacency list
 * (successor map: dep → [tasks that depend on dep]).
 *
 * @param {Array<{id: string, dependencies: string[]}>} tasks
 * @returns {{ inDegree: Map<string, number>, successors: Map<string, string[]> }}
 */
function buildGraphMeta(tasks) {
  const inDegree = new Map();
  const successors = new Map();

  for (const task of tasks) {
    if (!inDegree.has(task.id)) inDegree.set(task.id, 0);
    if (!successors.has(task.id)) successors.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      // task depends on dep → dep is a predecessor of task
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      if (!successors.has(dep)) successors.set(dep, []);
      successors.get(dep).push(task.id);
    }
  }

  return { inDegree, successors };
}

/**
 * Produce a deterministic topological ordering of tasks using Kahn's algorithm
 * with stable lexicographic tie-breaking.
 *
 * Preconditions:
 *   - tasks is a valid DAG (no cycles, no undeclared dependencies).
 *   - Use dag_validator.validateDAG before calling this function.
 *
 * @param {Array<{id: string, dependencies: string[]}>} tasks
 * @returns {{
 *   order: string[],          // Task IDs in deterministic execution order
 *   batches: string[][]       // Groups of tasks that may run concurrently
 * }}
 */
function computeTopologicalOrder(tasks) {
  const { inDegree, successors } = buildGraphMeta(tasks);

  // Ready queue: tasks with in-degree 0, sorted lexicographically for determinism
  const ready = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) ready.push(id);
  }
  ready.sort();

  const order = [];
  const batches = [];

  while (ready.length > 0) {
    // All tasks currently in ready can run concurrently (subject to scope + concurrency limits)
    const batch = ready.slice().sort(); // defensive sort — already sorted
    batches.push(batch);

    const nextReady = [];

    for (const id of batch) {
      order.push(id);
      for (const successor of (successors.get(id) || [])) {
        const newDegree = inDegree.get(successor) - 1;
        inDegree.set(successor, newDegree);
        if (newDegree === 0) {
          nextReady.push(successor);
        }
      }
    }

    // Stable sort the next wave for determinism
    nextReady.sort();
    ready.length = 0;
    for (const id of nextReady) ready.push(id);
  }

  return { order, batches };
}

/**
 * Filter a batch of ready tasks down to at most `maxParallel` tasks,
 * respecting write-scope disjointness and the configured parallel limit.
 * Tie-breaking is lexicographic on task ID.
 *
 * @param {string[]} batch                         Candidate task IDs (sorted)
 * @param {Map<string, string[]>} scopeMap         task id → write scope paths
 * @param {number} maxParallel                     Maximum tasks to schedule at once
 * @returns {{ scheduled: string[], deferred: string[] }}
 */
function selectConcurrentBatch(batch, scopeMap, maxParallel) {
  const scheduled = [];
  const usedPaths = new Set();

  for (const id of batch) {
    if (scheduled.length >= maxParallel) break;
    const paths = scopeMap.get(id) || [];
    const hasConflict = paths.some(p => usedPaths.has(p));
    if (!hasConflict) {
      for (const p of paths) usedPaths.add(p);
      scheduled.push(id);
    }
  }

  const scheduledSet = new Set(scheduled);
  const deferred = batch.filter(id => !scheduledSet.has(id));

  return { scheduled, deferred };
}

module.exports = {
  buildGraphMeta,
  computeTopologicalOrder,
  selectConcurrentBatch
};

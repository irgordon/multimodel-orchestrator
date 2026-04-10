'use strict';

/**
 * dag_validator.js
 *
 * Validates that a task dependency graph is a Directed Acyclic Graph (DAG).
 * Detects cycles using an iterative depth-first search with a three-color
 * marking scheme (WHITE=0, GRAY=1, BLACK=2).
 *
 * All exported functions are pure and deterministic. No I/O is performed.
 */

const WHITE = 0; // not yet visited
const GRAY  = 1; // in current DFS path (cycle candidate)
const BLACK = 2; // fully processed

/**
 * Build an adjacency list from an array of task objects.
 *
 * @param {Array<{id: string, dependencies: string[]}>} tasks
 * @returns {Map<string, string[]>} adjacency list (task id → [dependency ids])
 */
function buildAdjacencyList(tasks) {
  const adj = new Map();
  for (const task of tasks) {
    if (!adj.has(task.id)) {
      adj.set(task.id, []);
    }
    for (const dep of task.dependencies) {
      if (!adj.has(dep)) {
        adj.set(dep, []);
      }
      // Edge: task.id depends on dep (dep must finish before task.id starts)
      adj.get(task.id).push(dep);
    }
  }
  return adj;
}

/**
 * Detect cycles in the dependency graph using iterative DFS.
 *
 * @param {Map<string, string[]>} adj  Adjacency list built by buildAdjacencyList
 * @returns {{ hasCycle: boolean, cycleNodes: string[] }}
 *   hasCycle  — true if any cycle exists
 *   cycleNodes — sorted list of all node IDs that participate in at least one cycle
 */
function detectCycles(adj) {
  const color = new Map();
  for (const id of adj.keys()) {
    color.set(id, WHITE);
  }

  const cycleNodes = new Set();

  for (const start of adj.keys()) {
    if (color.get(start) !== WHITE) continue;

    // Iterative DFS: stack entries are [nodeId, iteratorIndex]
    const stack = [[start, 0]];
    const path = [];      // current DFS path (for cycle tracing)
    const pathSet = new Set();

    color.set(start, GRAY);
    path.push(start);
    pathSet.add(start);

    while (stack.length > 0) {
      const [node, idx] = stack[stack.length - 1];
      const neighbors = adj.get(node) || [];

      if (idx >= neighbors.length) {
        // All neighbors processed — backtrack
        color.set(node, BLACK);
        stack.pop();
        path.pop();
        pathSet.delete(node);
        continue;
      }

      // Advance iterator
      stack[stack.length - 1][1] = idx + 1;
      const neighbor = neighbors[idx];

      if (color.get(neighbor) === GRAY) {
        // Back edge detected — cycle found
        // Collect all nodes from the cycle segment in path
        const cycleStart = path.indexOf(neighbor);
        for (let i = cycleStart; i < path.length; i++) {
          cycleNodes.add(path[i]);
        }
        cycleNodes.add(neighbor);
      } else if (color.get(neighbor) === WHITE) {
        color.set(neighbor, GRAY);
        stack.push([neighbor, 0]);
        path.push(neighbor);
        pathSet.add(neighbor);
      }
      // BLACK neighbors are already fully processed — skip
    }
  }

  return {
    hasCycle: cycleNodes.size > 0,
    cycleNodes: Array.from(cycleNodes).sort()
  };
}

/**
 * Validate that every dependency referenced in tasks is declared as a task id.
 *
 * @param {Array<{id: string, dependencies: string[]}>} tasks
 * @returns {{ valid: boolean, undeclaredDependencies: Array<{taskId: string, missingDep: string}> }}
 */
function validateDependenciesDeclared(tasks) {
  const ids = new Set(tasks.map(t => t.id));
  const undeclaredDependencies = [];

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!ids.has(dep)) {
        undeclaredDependencies.push({ taskId: task.id, missingDep: dep });
      }
    }
  }

  return {
    valid: undeclaredDependencies.length === 0,
    undeclaredDependencies
  };
}

/**
 * Validate that all task IDs in the plan are unique.
 *
 * @param {Array<{id: string}>} tasks
 * @returns {{ valid: boolean, duplicateIds: string[] }}
 */
function validateUniqueIds(tasks) {
  const seen = new Set();
  const duplicateIds = new Set();
  for (const task of tasks) {
    if (seen.has(task.id)) {
      duplicateIds.add(task.id);
    }
    seen.add(task.id);
  }
  return {
    valid: duplicateIds.size === 0,
    duplicateIds: Array.from(duplicateIds).sort()
  };
}

/**
 * Full DAG validation: checks unique IDs, declared dependencies, and acyclicity.
 *
 * @param {Array<{id: string, dependencies: string[]}>} tasks
 * @returns {{
 *   valid: boolean,
 *   uniqueIds: { valid: boolean, duplicateIds: string[] },
 *   declaredDeps: { valid: boolean, undeclaredDependencies: Array<{taskId: string, missingDep: string}> },
 *   acyclicity: { hasCycle: boolean, cycleNodes: string[] }
 * }}
 */
function validateDAG(tasks) {
  const uniqueIds = validateUniqueIds(tasks);
  const declaredDeps = validateDependenciesDeclared(tasks);
  const adj = buildAdjacencyList(tasks);
  const acyclicity = detectCycles(adj);

  return {
    valid: uniqueIds.valid && declaredDeps.valid && !acyclicity.hasCycle,
    uniqueIds,
    declaredDeps,
    acyclicity
  };
}

module.exports = {
  buildAdjacencyList,
  detectCycles,
  validateDependenciesDeclared,
  validateUniqueIds,
  validateDAG
};

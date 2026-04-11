'use strict';

const VALIDATOR_ID = 'structural/plan_schema_validator';
const FAILURE_CLASS = 'STRUCTURAL_INVALID';
const ERROR_CODE = 'STRUCTURAL_SCHEMA_INVALID';

const ROOT_REQUIRED_FIELDS = Object.freeze(['tasks']);
const TASK_REQUIRED_FIELDS = Object.freeze(['id', 'phase', 'scope', 'dependencies', 'risk_level']);
const TASK_OPTIONAL_FIELDS = Object.freeze(['required_invariants']);
const TASK_ALLOWED_FIELDS = Object.freeze([...TASK_REQUIRED_FIELDS, ...TASK_OPTIONAL_FIELDS]);

const PHASE_ENUM = Object.freeze(['plan', 'execute']);
const RISK_LEVEL_ENUM = Object.freeze(['low', 'medium', 'high']);

const SCOPE_REQUIRED_FIELDS = Object.freeze(['writes', 'reads']);

function createFailure(message, details) {
  return {
    ok: false,
    error: {
      validator_id: VALIDATOR_ID,
      failure_class: FAILURE_CLASS,
      error_code: ERROR_CODE,
      message,
      details,
    },
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPropertyDrift(value, requiredFields, allowedFields) {
  const keys = Object.keys(value);
  const missing = requiredFields.filter((field) => !Object.prototype.hasOwnProperty.call(value, field));
  const additional = keys.filter((key) => !allowedFields.includes(key));
  return { keys, missing, additional };
}

function validateStringArray(value, detailsPrefix) {
  if (!Array.isArray(value)) {
    return createFailure('Plan contains an invalid field type.', {
      ...detailsPrefix,
      reason: 'invalid_field_type',
      expected: 'array<string>',
      received: typeof value,
    });
  }

  for (let index = 0; index < value.length; index += 1) {
    if (typeof value[index] !== 'string') {
      return createFailure('Plan contains an invalid array entry type.', {
        ...detailsPrefix,
        reason: 'invalid_array_entry',
        index,
        expected: 'string',
        received: typeof value[index],
      });
    }
  }

  return null;
}

function validateScope(scope, taskIndex) {
  if (!isPlainObject(scope)) {
    return createFailure('Plan task scope must be an object.', {
      reason: 'invalid_scope_type',
      task_index: taskIndex,
      expected: 'object',
      received: Array.isArray(scope) ? 'array' : typeof scope,
    });
  }

  const scopeDrift = getPropertyDrift(scope, SCOPE_REQUIRED_FIELDS, SCOPE_REQUIRED_FIELDS);
  if (scopeDrift.missing.length > 0 || scopeDrift.additional.length > 0) {
    return createFailure('Plan task scope has missing or additional properties.', {
      reason: 'invalid_scope_properties',
      task_index: taskIndex,
      missing_fields: scopeDrift.missing,
      additional_fields: scopeDrift.additional,
    });
  }

  const writesFailure = validateStringArray(scope.writes, { task_index: taskIndex, field: 'scope.writes' });
  if (writesFailure) {
    return writesFailure;
  }

  const readsFailure = validateStringArray(scope.reads, { task_index: taskIndex, field: 'scope.reads' });
  if (readsFailure) {
    return readsFailure;
  }

  return null;
}

function validateRequiredInvariants(requiredInvariants, taskIndex) {
  if (requiredInvariants === undefined) {
    return null;
  }

  if (!Array.isArray(requiredInvariants)) {
    return createFailure('Plan task required_invariants must be an array.', {
      reason: 'invalid_field_type',
      task_index: taskIndex,
      field: 'required_invariants',
      expected: 'array<object>',
      received: typeof requiredInvariants,
    });
  }

  for (let invariantIndex = 0; invariantIndex < requiredInvariants.length; invariantIndex += 1) {
    if (!isPlainObject(requiredInvariants[invariantIndex])) {
      return createFailure('Plan task required_invariants contains an invalid entry.', {
        reason: 'invalid_array_entry',
        task_index: taskIndex,
        field: 'required_invariants',
        index: invariantIndex,
        expected: 'object',
        received: Array.isArray(requiredInvariants[invariantIndex]) ? 'array' : typeof requiredInvariants[invariantIndex],
      });
    }
  }

  return null;
}

module.exports = function plan_schema_validator(input) {
  if (!isPlainObject(input)) {
    return createFailure('Plan must be an object.', {
      reason: 'invalid_root_type',
      expected: 'object',
      received: Array.isArray(input) ? 'array' : typeof input,
    });
  }

  const rootDrift = getPropertyDrift(input, ROOT_REQUIRED_FIELDS, ROOT_REQUIRED_FIELDS);
  if (rootDrift.missing.length > 0 || rootDrift.additional.length > 0) {
    return createFailure('Plan has missing or additional properties.', {
      reason: 'invalid_properties',
      missing_fields: rootDrift.missing,
      additional_fields: rootDrift.additional,
    });
  }

  if (!Array.isArray(input.tasks)) {
    return createFailure('Plan tasks must be an array.', {
      reason: 'invalid_field_type',
      field: 'tasks',
      expected: 'array<object>',
      received: typeof input.tasks,
    });
  }

  for (let taskIndex = 0; taskIndex < input.tasks.length; taskIndex += 1) {
    const task = input.tasks[taskIndex];
    if (!isPlainObject(task)) {
      return createFailure('Plan tasks must contain objects.', {
        reason: 'invalid_array_entry',
        field: 'tasks',
        index: taskIndex,
        expected: 'object',
        received: Array.isArray(task) ? 'array' : typeof task,
      });
    }

    const taskDrift = getPropertyDrift(task, TASK_REQUIRED_FIELDS, TASK_ALLOWED_FIELDS);
    if (taskDrift.missing.length > 0 || taskDrift.additional.length > 0) {
      return createFailure('Plan task has missing or additional properties.', {
        reason: 'invalid_task_properties',
        task_index: taskIndex,
        missing_fields: taskDrift.missing,
        additional_fields: taskDrift.additional,
      });
    }

    if (typeof task.id !== 'string') {
      return createFailure('Plan task id must be a string.', {
        reason: 'invalid_field_type',
        task_index: taskIndex,
        field: 'id',
        expected: 'string',
        received: typeof task.id,
      });
    }

    if (!PHASE_ENUM.includes(task.phase)) {
      return createFailure('Plan task phase is not allowed.', {
        reason: 'invalid_enum',
        task_index: taskIndex,
        field: 'phase',
        allowed_values: PHASE_ENUM,
        received: task.phase,
      });
    }

    const scopeFailure = validateScope(task.scope, taskIndex);
    if (scopeFailure) {
      return scopeFailure;
    }

    const dependenciesFailure = validateStringArray(task.dependencies, { task_index: taskIndex, field: 'dependencies' });
    if (dependenciesFailure) {
      return dependenciesFailure;
    }

    if (!RISK_LEVEL_ENUM.includes(task.risk_level)) {
      return createFailure('Plan task risk_level is not allowed.', {
        reason: 'invalid_enum',
        task_index: taskIndex,
        field: 'risk_level',
        allowed_values: RISK_LEVEL_ENUM,
        received: task.risk_level,
      });
    }

    const requiredInvariantsFailure = validateRequiredInvariants(task.required_invariants, taskIndex);
    if (requiredInvariantsFailure) {
      return requiredInvariantsFailure;
    }
  }

  return {
    ok: true,
    normalized_plan: input,
  };
};

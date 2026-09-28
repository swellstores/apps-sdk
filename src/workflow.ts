import { SwellError } from './error.js';

function paramsError(code: string, message: string): SwellError {
  return new SwellError({ error: { code, message, status: 400, retryable: false } }, { code, status: 400 });
}

function validateValue(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value !== 'object' || value === null || seen.has(value) || Object.getOwnPropertySymbols(value).length) {
    throw paramsError('workflow_params_unserializable', 'Workflow params must be JSON-safe values');
  }
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.some(key => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) {
      throw paramsError('workflow_params_unserializable', 'Workflow params must be JSON-safe values');
    }
    for (let index = 0; index < value.length; index++) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) throw paramsError('workflow_params_unserializable', 'Workflow params must be JSON-safe values');
    }
  } else if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw paramsError('workflow_params_unserializable', 'Workflow params must be JSON-safe values');
  }
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) validateValue(item, seen);
  seen.delete(value);
}

export function validateWorkflowParams(params: unknown): unknown {
  validateValue(params, new Set());
  if (new TextEncoder().encode(JSON.stringify(params)).length > 128 * 1024) {
    throw paramsError('workflow_params_too_large', 'Workflow params are too large; pass identifiers and re-fetch data inside the workflow');
  }
  return params;
}

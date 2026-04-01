import { AsyncLocalStorage } from 'node:async_hooks'

const DEFAULT_BUDGET = 1

export class ProviderCallBudgetExceededError extends Error {
  constructor(message = 'provider_call_budget_exceeded') {
    super(message)
    this.name = 'ProviderCallBudgetExceededError'
  }
}

const storage = new AsyncLocalStorage()

const sanitizeStage = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const sanitizeMethod = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : 'unknown'

const cloneTrace = (trace = null) => {
  if (!trace || typeof trace !== 'object') {
    return {
      budget: DEFAULT_BUDGET,
      count: 0,
      calls: [],
      blocked: [],
    }
  }

  return {
    budget:
      Number.isInteger(trace.budget) && trace.budget > 0
        ? trace.budget
        : DEFAULT_BUDGET,
    count:
      Number.isInteger(trace.count) && trace.count >= 0 ? trace.count : 0,
    calls: Array.isArray(trace.calls) ? trace.calls.map((entry) => ({ ...entry })) : [],
    blocked: Array.isArray(trace.blocked)
      ? trace.blocked.map((entry) => ({ ...entry }))
      : [],
  }
}

export const runWithProviderCallTrace = async (trace = {}, callback) => {
  const initialTrace = cloneTrace(trace)
  return storage.run(initialTrace, callback)
}

export const getProviderCallTrace = () => cloneTrace(storage.getStore())

export const hasProviderCallTrace = () => Boolean(storage.getStore())

export const recordProviderCall = ({
  method = 'unknown',
  stage = null,
  provider = null,
  model = null,
} = {}) => {
  const trace = storage.getStore()
  if (!trace) {
    return {
      allowed: true,
      count: 0,
      budget: DEFAULT_BUDGET,
      stage: sanitizeStage(stage),
      method: sanitizeMethod(method),
    }
  }

  const normalizedMethod = sanitizeMethod(method)
  const normalizedStage = sanitizeStage(stage)
  const budget =
    Number.isInteger(trace.budget) && trace.budget > 0
      ? trace.budget
      : DEFAULT_BUDGET

  if (trace.count >= budget) {
    trace.blocked.push({
      method: normalizedMethod,
      stage: normalizedStage,
      provider: typeof provider === 'string' ? provider : null,
      model: typeof model === 'string' ? model : null,
      attemptedAt: new Date().toISOString(),
      reason: 'provider_call_budget_exceeded',
    })
    throw new ProviderCallBudgetExceededError()
  }

  trace.count += 1
  trace.calls.push({
    index: trace.count,
    method: normalizedMethod,
    stage: normalizedStage,
    provider: typeof provider === 'string' ? provider : null,
    model: typeof model === 'string' ? model : null,
    createdAt: new Date().toISOString(),
  })

  return {
    allowed: true,
    count: trace.count,
    budget,
    stage: normalizedStage,
    method: normalizedMethod,
  }
}

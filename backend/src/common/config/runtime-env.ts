const isNonProductionRuntime = () => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').trim().toLowerCase()
  return nodeEnv === 'development' || nodeEnv === 'test'
}

const normalize = (name: string) => {
  const value = process.env[name]
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export const resolveRequiredEnv = (
  name: string,
  options?: {
    developmentFallback?: string
  },
) => {
  const configured = normalize(name)
  if (configured) {
    return configured
  }

  if (isNonProductionRuntime() && options?.developmentFallback) {
    return options.developmentFallback
  }

  throw new Error(`${name} must be configured before starting the application.`)
}

export const resolveOptionalEnv = (name: string) => normalize(name)

const DEFAULT_SESSION_TTL_HOURS = 24 * 7
const MAX_SESSION_TTL_HOURS = 24 * 30

const resolveNumericEnv = (value: string | undefined): number | null => {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const resolvedHours = (() => {
  const candidate = resolveNumericEnv(process.env.SESSION_TTL_HOURS)
  if (candidate && candidate > 0) {
    return Math.min(candidate, MAX_SESSION_TTL_HOURS)
  }
  return DEFAULT_SESSION_TTL_HOURS
})()

export const SESSION_TTL_HOURS = resolvedHours
export const SESSION_TTL_SECONDS = Math.max(1, Math.round(SESSION_TTL_HOURS * 60 * 60))
export const SESSION_TTL_MILLISECONDS = SESSION_TTL_SECONDS * 1000

export const DEFAULT_OTP_LENGTH = Number(process.env.AUTH_OTP_LENGTH ?? 4)
export const DEFAULT_OTP_TTL_MS = Number(process.env.AUTH_OTP_TTL_MS ?? 5 * 60 * 1000)
export const DEFAULT_OTP_MAX_ATTEMPTS = Number(process.env.AUTH_OTP_MAX_ATTEMPTS ?? 5)
export const DEFAULT_OTP_10M_LIMIT = Number(process.env.AUTH_OTP_PER_WINDOW_LIMIT ?? 3)
export const DEFAULT_OTP_DAILY_LIMIT = Number(process.env.AUTH_OTP_DAILY_LIMIT ?? 10)
export const DEFAULT_OTP_WINDOW_MS = 10 * 60 * 1000


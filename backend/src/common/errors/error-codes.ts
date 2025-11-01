export enum ErrorCode {
  BACKEND_TIMEOUT = 'BACKEND.TIMEOUT',
  DB_CONNECTION = 'DB.CONNECTION',
  DB_CONFLICT = 'DB.CONFLICT',
  DB_PANIC = 'DB.PANIC',
  DB_TIMEOUT = 'DB.TIMEOUT',
  AUTH_UNAUTHORIZED = 'AUTH.UNAUTHORIZED',
  AUTH_FORBIDDEN = 'AUTH.FORBIDDEN',
  VALIDATION_FAILED = 'VALIDATION.FAILED',
  RATE_LIMITED = 'RATE.LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNKNOWN = 'UNKNOWN',
}

export interface StandardError {
  code: ErrorCode
  httpStatus: number
  message: string
  details?: Record<string, unknown> | null | unknown
  correlationId: string
  timestamp: string
}

export interface StandardErrorEnvelope {
  ok: false
  error: StandardError
}

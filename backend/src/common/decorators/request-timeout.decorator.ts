import { SetMetadata } from '@nestjs/common'

export const REQUEST_TIMEOUT_METADATA_KEY = 'request-timeout:ms'

/**
 * Overrides the default request timeout imposed by {@link TimeoutInterceptor}.
 * Pass `null` to disable the timeout for the decorated handler.
 */
export const RequestTimeout = (timeoutMs: number | null) =>
  SetMetadata(REQUEST_TIMEOUT_METADATA_KEY, timeoutMs)

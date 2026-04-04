export function createAbortError(reason?: unknown) {
  const message =
    typeof reason === 'string' && reason.trim().length > 0
      ? reason.trim()
      : 'Operation aborted.';
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) {
    throw createAbortError(signal.reason);
  }
}

export function isAbortError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  ) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message === 'The operation was aborted.')
  );
}

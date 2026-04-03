const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4100';

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'demo-tenant',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

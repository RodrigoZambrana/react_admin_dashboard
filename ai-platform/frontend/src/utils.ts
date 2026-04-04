export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function toPrettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

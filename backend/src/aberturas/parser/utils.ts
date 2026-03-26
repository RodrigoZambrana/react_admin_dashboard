export function normalizeAberturasToken(value?: string | null) {
  return (
    value
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim() || ''
  )
}

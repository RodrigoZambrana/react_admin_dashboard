const INJECTION_PATTERNS = [
  /ignora(?:r)?\s+instrucciones?/i,
  /omiti(?:r)?\s+instrucciones?/i,
  /act[uú]a\s+como\s+admin/i,
  /act[uú]a\s+como\s+superadmin/i,
  /muestra(?:me)?\s+(?:tu|el)\s+prompt/i,
  /muestra(?:me)?\s+(?:el\s+)?(?:system prompt|prompt del sistema|mensaje de sistema)/i,
  /muestra(?:me)?\s+(?:tools|herramientas)\s+internas?/i,
  /revela(?:r)?\s+(?:tools|herramientas|datos internos|configuraci[oó]n|prompt|system prompt)/i,
  /eleva(?:r)?\s+(?:mis\s+)?permisos?/i,
]

export function sanitizeUserInput(input) {
  const original = String(input || '')
  let sanitized = original
  let injectionDetected = false

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      injectionDetected = true
      sanitized = sanitized.replace(pattern, '[contenido filtrado]')
    }
  }

  return {
    original,
    sanitized: sanitized.trim(),
    injectionDetected,
  }
}

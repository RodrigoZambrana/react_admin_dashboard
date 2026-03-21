const resolveStateSignatureKey = () => {
    const configured = import.meta.env.VITE_STATE_SIGNATURE_KEY?.trim()
    if (configured) {
        return configured
    }

    if (import.meta.env.DEV) {
        return 'local-dev-state-signature-change-me'
    }

    throw new Error(
        'VITE_STATE_SIGNATURE_KEY must be configured before building the admin frontend.',
    )
}

export const STATE_SIGNATURE_KEY = resolveStateSignatureKey()

export const INJECTION_PATTERNS = [
    /('|")\s*or\s+(\d+|true|false|null)/i,
    /\bUNION\b\s+\bSELECT\b/i,
    /\bDROP\b\s+\bTABLE\b/i,
    /\bTRUNCATE\b\s+\bTABLE\b/i,
    /\bALTER\b\s+\bTABLE\b/i,
    /\bEXEC(UTE)?\b/i,
    /\bINSERT\b\s+\bINTO\b/i,
    /\bDELETE\b\s+\bFROM\b/i,
    /\bUPDATE\b\s+\bSET\b/i,
    /--/,
    /\/\*/,
    /\*\//,
    /<[^>]+>/,
] as const

export const PASSWORD_COMPLEXITY_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/

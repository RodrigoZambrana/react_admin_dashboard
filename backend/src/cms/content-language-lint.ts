type AnalyticalSeverity = 'borderline' | 'invalid'

type AnalyticalIssue = {
  path: string
  phrase: string
  match: string
  severity: AnalyticalSeverity
}

type AnalyticalLanguageReport = {
  score: number
  issues: AnalyticalIssue[]
  blocked: boolean
}

type Rule = {
  phrase: string
  pattern: RegExp
  severity: AnalyticalSeverity
  score: number
}

const rules: Rule[] = [
  { phrase: 'intención de búsqueda', pattern: /\bintención de búsqueda\b/gi, severity: 'invalid', score: 40 },
  { phrase: 'según intención seo', pattern: /\bsegún intención seo\b/gi, severity: 'invalid', score: 40 },
  { phrase: 'esta página', pattern: /\besta página\b/gi, severity: 'invalid', score: 35 },
  { phrase: 'este contenido', pattern: /\beste contenido\b/gi, severity: 'invalid', score: 35 },
  { phrase: 'esta sección', pattern: /\besta sección\b/gi, severity: 'borderline', score: 12 },
  { phrase: 'esta página responde', pattern: /\besta página responde\b/gi, severity: 'invalid', score: 45 },
  { phrase: 'esta página hace', pattern: /\besta página hace\b/gi, severity: 'invalid', score: 45 },
  { phrase: 'análisis', pattern: /\banálisis\b/gi, severity: 'invalid', score: 35 },
  { phrase: 'datos muestran', pattern: /\bdatos muestran\b/gi, severity: 'invalid', score: 35 },
  { phrase: 'captura demanda', pattern: /\bcaptura demanda\b/gi, severity: 'invalid', score: 35 },
  { phrase: 'ordena necesidades', pattern: /\bordena (?:esas )?(?:tres )?necesidades\b/gi, severity: 'invalid', score: 35 },
  { phrase: 'responde la intención', pattern: /\bresponde la intención\b/gi, severity: 'invalid', score: 30 },
  { phrase: 'lleva a la decisión', pattern: /\blleva a la decisión\b/gi, severity: 'invalid', score: 30 },
  { phrase: 'el análisis', pattern: /\bel análisis\b/gi, severity: 'invalid', score: 30 },
]

const stringLike = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const visit = (value: unknown, path: string, issues: AnalyticalIssue[]) => {
  if (stringLike(value)) {
    const text = value
    for (const rule of rules) {
      rule.pattern.lastIndex = 0
      const match = rule.pattern.exec(text)
      if (match) {
        issues.push({
          path,
          phrase: rule.phrase,
          match: match[0],
          severity: rule.severity,
        })
      }
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, `${path}[${index}]`, issues))
    return
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      visit(entry, path ? `${path}.${key}` : key, issues)
    }
  }
}

export const detectAnalyticalLanguage = (value: unknown): AnalyticalLanguageReport => {
  const issues: AnalyticalIssue[] = []
  visit(value, '', issues)
  const score = Math.min(
    100,
    issues.reduce((total, issue) => total + (issue.severity === 'invalid' ? 15 : 5), 0),
  )

  return {
    score,
    issues,
    blocked: issues.some((issue) => issue.severity === 'invalid'),
  }
}

export const formatAnalyticalLanguageIssues = (report: AnalyticalLanguageReport) =>
  report.issues.map((issue) => `${issue.severity}:${issue.path || '<root>'}:${issue.phrase}`)


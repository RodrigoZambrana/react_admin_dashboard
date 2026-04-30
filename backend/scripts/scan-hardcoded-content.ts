import { readdir, readFile, stat } from 'node:fs/promises'
import * as path from 'node:path'

type Finding = {
  file: string
  line: number
  length: number
  text: string
}

const DEFAULT_DIRS = ['src', '../ecommerce/src']
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const STRING_LITERAL_RE = /(['"`])([^'"`]{120,}?)\1/g
const NATURAL_LANGUAGE_RE = /[A-Za-zÀ-ÿ]{3,}\s+[A-Za-zÀ-ÿ]{3,}/

const shouldInspect = (filePath: string) => TARGET_EXTENSIONS.has(path.extname(filePath))

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue
      }
      files.push(...(await walk(resolved)))
      continue
    }
    if (entry.isFile() && shouldInspect(resolved)) {
      files.push(resolved)
    }
  }
  return files
}

function collectFindings(filePath: string, source: string): Finding[] {
  const findings: Finding[] = []
  const lines = source.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line || line.length < 120) {
      continue
    }

    let match: RegExpExecArray | null
    STRING_LITERAL_RE.lastIndex = 0
    while ((match = STRING_LITERAL_RE.exec(line))) {
      const literal = match[2].trim()
      if (literal.length < 120) {
        continue
      }
      if (!NATURAL_LANGUAGE_RE.test(literal)) {
        continue
      }
      findings.push({
        file: filePath,
        line: index + 1,
        length: literal.length,
        text: literal.slice(0, 180),
      })
    }
  }

  return findings
}

async function main() {
  const roots = process.argv.slice(2).filter((argument) => !argument.startsWith('-'))
  const scanRoots = roots.length > 0 ? roots : DEFAULT_DIRS
  const baseDir = process.cwd()
  const findings: Finding[] = []

  for (const root of scanRoots) {
    const resolvedRoot = path.resolve(baseDir, root)
    const stats = await stat(resolvedRoot)
    if (!stats.isDirectory()) {
      continue
    }

    const files = await walk(resolvedRoot)
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      findings.push(...collectFindings(path.relative(baseDir, file), source))
    }
  }

  if (!findings.length) {
    console.log('No possible hardcoded content detected.')
    return
  }

  console.log('Possible hardcoded content detected:')
  for (const finding of findings.slice(0, 200)) {
    console.log(
      JSON.stringify({
        file: finding.file,
        line: finding.line,
        length: finding.length,
        text: finding.text,
      }),
    )
  }

  process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { loadEnvFromBackendRoot } from './script-safety'

const VALID_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.mp4',
  '.mov',
  '.m4v',
  '.webm',
  '.ogv',
])

type MediaFile = {
  absolutePath: string
  relativePath: string
  size: number
  depth: number
}

type DuplicateGroup = {
  hash: string
  canonical: MediaFile
  duplicates: MediaFile[]
}

const parseArgs = (argv: string[]) => {
  const readValue = (name: string) => {
    const match = argv.find((entry) => entry === `--${name}` || entry.startsWith(`--${name}=`))
    if (!match) {
      return null
    }
    const separatorIndex = match.indexOf('=')
    return separatorIndex === -1 ? '' : match.slice(separatorIndex + 1)
  }

  return {
    root: readValue('root') || readValue('source') || process.env.MEDIA_SOURCE_ROOT || process.cwd(),
    quarantineRoot: readValue('quarantine') || null,
    dryRun: argv.includes('--dry-run') || !argv.includes('--confirm'),
    confirm: argv.includes('--confirm'),
  }
}

const isMediaFile = (filename: string) => VALID_EXTENSIONS.has(extname(filename).toLowerCase())

const hashFile = async (filePath: string) => {
  const hash = createHash('sha1')
  const stream = createReadStream(filePath)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

const walkFiles = async (root: string): Promise<string[]> => {
  const result: string[] = []
  const stack = [root]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      if (entry.isFile() && isMediaFile(entry.name)) {
        result.push(fullPath)
      }
    }
  }

  return result.sort((left, right) => left.localeCompare(right))
}

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const chooseCanonical = (left: MediaFile, right: MediaFile) => {
  if (left.depth !== right.depth) {
    return left.depth - right.depth
  }
  const leftStem = basename(left.absolutePath, extname(left.absolutePath))
  const rightStem = basename(right.absolutePath, extname(right.absolutePath))
  if (leftStem.length !== rightStem.length) {
    return leftStem.length - rightStem.length
  }
  return left.relativePath.localeCompare(right.relativePath)
}

const ensureDirFor = async (filePath: string) => {
  await mkdir(dirname(filePath), { recursive: true })
}

const moveFileSafely = async (source: string, destination: string, dryRun: boolean) => {
  if (dryRun) {
    return
  }

  await ensureDirFor(destination)
  try {
    await rename(source, destination)
  } catch {
    await copyFile(source, destination)
    await unlink(source)
  }
}

const ensureUniqueQuarantinePath = async (targetPath: string) => {
  if (!existsSync(targetPath)) {
    return targetPath
  }

  const ext = extname(targetPath)
  const stem = basename(targetPath, ext)
  const dir = dirname(targetPath)
  let counter = 2
  let candidate = join(dir, `${stem}-${counter}${ext}`)

  while (existsSync(candidate)) {
    counter += 1
    candidate = join(dir, `${stem}-${counter}${ext}`)
  }

  return candidate
}

const collectMediaFiles = async (root: string) => {
  const absoluteRoot = resolve(root.trim())
  if (!existsSync(absoluteRoot)) {
    throw new Error(`[media:dedupe] root not found: ${absoluteRoot}`)
  }

  const entries = await walkFiles(absoluteRoot)
  const files: MediaFile[] = []
  for (const batch of chunk(entries, 40)) {
    const batchFiles = await Promise.all(
      batch.map(async (absolutePath) => {
        const stats = await stat(absolutePath)
        const relativePath = relative(absoluteRoot, absolutePath).replace(/\\/g, '/')
        return {
          absolutePath,
          relativePath,
          size: stats.size,
          depth: relativePath.split(/[\\/]/).filter(Boolean).length,
        } satisfies MediaFile
      }),
    )
    files.push(...batchFiles)
  }

  return {
    absoluteRoot,
    files,
  }
}

const buildDuplicateGroups = async (files: MediaFile[]) => {
  const groupsBySize = new Map<number, MediaFile[]>()
  for (const file of files) {
    const list = groupsBySize.get(file.size) ?? []
    list.push(file)
    groupsBySize.set(file.size, list)
  }

  const groups = new Map<string, DuplicateGroup>()
  for (const [size, group] of groupsBySize.entries()) {
    if (group.length < 2) {
      continue
    }

    const hashedBuckets = new Map<string, MediaFile[]>()
    for (const batch of chunk(group, 12)) {
      const hashed = await Promise.all(
        batch.map(async (file) => ({
          file,
          hash: await hashFile(file.absolutePath),
        })),
      )
      for (const { file, hash } of hashed) {
        const bucket = hashedBuckets.get(hash) ?? []
        bucket.push(file)
        hashedBuckets.set(hash, bucket)
      }
    }

    console.log(`[media:dedupe] size ${size} bytes -> ${group.length} candidates`)

    for (const [hash, bucket] of hashedBuckets.entries()) {
      if (bucket.length < 2) {
        continue
      }

      const sorted = [...bucket].sort(chooseCanonical)
      groups.set(`${size}:${hash}`, {
        hash,
        canonical: sorted[0],
        duplicates: sorted.slice(1),
      })
    }
  }

  return Array.from(groups.values()).filter((group) => group.duplicates.length > 0)
}

const main = async () => {
  loadEnvFromBackendRoot()
  const cli = parseArgs(process.argv.slice(2))

  const { absoluteRoot, files } = await collectMediaFiles(cli.root)
  console.log(`[media:dedupe] scanned ${files.length} media files in ${absoluteRoot}`)
  const groups = await buildDuplicateGroups(files)
  const quarantineRoot = resolve(
    cli.quarantineRoot || join(absoluteRoot, '_duplicates'),
  )

  const summary = {
    root: absoluteRoot,
    quarantineRoot,
    totalFiles: files.length,
    duplicateGroups: groups.length,
    duplicateFiles: groups.reduce((total, group) => total + group.duplicates.length, 0),
    groups: groups.map((group) => ({
      hash: group.hash,
      canonical: group.canonical.relativePath,
      duplicates: group.duplicates.map((item) => item.relativePath),
    })),
  }

  console.log(JSON.stringify(summary, null, 2))

  if (cli.dryRun) {
    console.log('[media:dedupe] dry-run complete. No files were moved.')
    return
  }

  for (const group of groups) {
    for (const duplicate of group.duplicates) {
      const targetPath = await ensureUniqueQuarantinePath(
        join(quarantineRoot, duplicate.relativePath),
      )
      await moveFileSafely(duplicate.absolutePath, targetPath, false)
    }
  }

  console.log(
    `[media:dedupe] completed: moved ${summary.duplicateFiles} duplicate files into ${quarantineRoot}`,
  )
}

main().catch((error) => {
  console.error('[media:dedupe] failed', error)
  process.exitCode = 1
})

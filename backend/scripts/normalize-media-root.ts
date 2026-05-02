import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir } from 'fs/promises'
import { basename, join, parse, resolve } from 'path'
import { loadEnvFromBackendRoot } from './script-safety'

type MediaKind = 'image' | 'video'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v'])

const resolveMediaRoot = () => resolve((process.env.MEDIA_ROOT || join(process.cwd(), 'media')).trim())

const isMediaFile = (filename: string) => {
  const ext = parse(filename).ext.toLowerCase()
  return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)
}

const inferKind = (filename: string): MediaKind | null => {
  const ext = parse(filename).ext.toLowerCase()
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return null
}

const hashFile = async (filePath: string) => {
  const hash = createHash('sha1')
  const stream = await import('fs').then((fs) => fs.createReadStream(filePath))
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

  return result
}

const ensureUniqueTarget = async (targetDir: string, filename: string, sourcePath: string) => {
  const ext = parse(filename).ext
  const stem = basename(filename, ext)
  let candidate = join(targetDir, filename)
  let counter = 2

  while (existsSync(candidate)) {
    const [sourceHash, targetHash] = await Promise.all([hashFile(sourcePath), hashFile(candidate)])
    if (sourceHash === targetHash) {
      return candidate
    }

    candidate = join(targetDir, `${stem}-${counter}${ext}`)
    counter += 1
  }

  return candidate
}

const normalizeProducts = async (mediaRoot: string) => {
  const productsRoot = join(mediaRoot, 'products')
  if (!existsSync(productsRoot)) {
    console.warn(`[media] products root missing: ${productsRoot}`)
    return
  }

  const products = (await readdir(productsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory())
  for (const product of products) {
    const productPath = join(productsRoot, product.name)
    for (const kind of ['images', 'videos'] as const) {
      const kindPath = join(productPath, kind)
      if (!existsSync(kindPath)) continue

      const files = await walkFiles(kindPath)
      let copied = 0
      let skipped = 0

      for (const sourcePath of files) {
        const inferred = inferKind(sourcePath)
        if (!inferred) continue
        if (inferred === 'image' && kind !== 'images') continue
        if (inferred === 'video' && kind !== 'videos') continue

        const filename = basename(sourcePath)
        const targetPath = await ensureUniqueTarget(kindPath, filename, sourcePath)
        if (targetPath === sourcePath) {
          skipped += 1
          continue
        }

        await mkdir(kindPath, { recursive: true })
        await copyFile(sourcePath, targetPath)
        copied += 1
      }

      console.log(`[media] ${product.name}/${kind}: copied ${copied}, skipped ${skipped}`)
    }
  }
}

const normalizeStories = async (mediaRoot: string) => {
  const storiesRoot = join(mediaRoot, 'stories')
  if (!existsSync(storiesRoot)) {
    return
  }

  const stories = (await readdir(storiesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory())
  for (const story of stories) {
    const storyPath = join(storiesRoot, story.name)
    const files = await walkFiles(storyPath)
    let copied = 0
    let skipped = 0

    for (const sourcePath of files) {
      const filename = basename(sourcePath)
      const targetPath = await ensureUniqueTarget(storyPath, filename, sourcePath)
      if (targetPath === sourcePath) {
        skipped += 1
        continue
      }

      await mkdir(storyPath, { recursive: true })
      await copyFile(sourcePath, targetPath)
      copied += 1
    }

    console.log(`[media] stories/${story.name}: copied ${copied}, skipped ${skipped}`)
  }
}

const main = async () => {
  loadEnvFromBackendRoot()
  const mediaRoot = resolveMediaRoot()
  console.log(`[media] normalizing root: ${mediaRoot}`)
  await normalizeProducts(mediaRoot)
  await normalizeStories(mediaRoot)
}

main().catch((error) => {
  console.error('[media] normalization failed', error)
  process.exitCode = 1
})

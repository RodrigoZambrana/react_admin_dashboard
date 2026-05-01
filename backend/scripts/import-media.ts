import { PrismaClient } from '@prisma/client'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { assertMaintenanceScriptSafety, loadEnvFromBackendRoot } from './script-safety'
import {
  applyChanges,
  buildDesiredMediaFromManifest,
  diffMedia,
  getProductMedia,
  loadProducts,
  resolveProduct,
  resolveMediaRoot,
} from '../src/common/media/sync-core'
import type { MediaExportManifest } from '../src/common/media/sync-core'

const prisma = new PrismaClient()
const SCRIPT_NAME = 'import-media'

const parseArgs = (argv: string[]) => {
  const readValue = (name: string) => {
    const match = argv.find((entry) => entry === `--${name}` || entry.startsWith(`--${name}=`))
    if (!match) return null
    const separatorIndex = match.indexOf('=')
    return separatorIndex === -1 ? '' : match.slice(separatorIndex + 1)
  }

  return {
    source: readValue('source') || './media-export',
    mode: ((readValue('mode') || 'safe').toLowerCase() === 'strict' ? 'strict' : 'safe') as 'safe' | 'strict',
    dryRun: argv.includes('--dry-run'),
  }
}

async function main() {
  loadEnvFromBackendRoot()
  const cli = parseArgs(process.argv.slice(2))
  const guard = assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    argv: process.argv.slice(2),
    destructive: true,
  })

  const mediaRoot = resolveMediaRoot()
  const sourceRoot = resolve(process.cwd(), cli.source)
  const manifestPath = join(sourceRoot, 'manifest.json')
  const filesRoot = join(sourceRoot, 'files')

  if (!existsSync(manifestPath)) {
    throw new Error(`[${SCRIPT_NAME}] manifest not found: ${manifestPath}`)
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as MediaExportManifest
  const products = await loadProducts(prisma)

  const result: Array<{
    slug: string
    state: string
    files: number
    created: number
    updated: number
    copied: number
    deleted: number
    unchanged: number
  }> = []

  for (const productEntry of manifest.products) {
    const product = resolveProduct(products, productEntry.slug)
    if (!product) {
      console.warn(`[${SCRIPT_NAME}] product not found: ${productEntry.slug}`)
      continue
    }

    const desired = buildDesiredMediaFromManifest({
      productId: product.id,
      manifestMedia: productEntry.media,
      sourceFilesRoot: filesRoot,
    }).filter((entry) => {
      if (!existsSync(entry.sourcePath || '')) {
        console.warn(`[${SCRIPT_NAME}] missing source file: ${entry.sourcePath}`)
        return false
      }
      return true
    })

    const current = await getProductMedia(prisma, product.id, product.slug)
    const diff = await diffMedia({
      desired,
      current,
      mediaRoot,
      mode: cli.mode,
    })
    const stats = await applyChanges(prisma, diff, {
      mediaRoot,
      dryRun: cli.dryRun,
      mode: cli.mode,
    })

    result.push({
      slug: productEntry.slug,
      state: stats.created || stats.updated || stats.deleted ? 'diff aplicado' : 'OK',
      files: desired.length,
      created: stats.created,
      updated: stats.updated,
      copied: stats.copied,
      deleted: stats.deleted,
      unchanged: diff.unchanged.length,
    })

    console.log(
      `[${SCRIPT_NAME}] product imported: ${productEntry.slug} (+${stats.created} ~${stats.updated} -${stats.deleted})`,
    )
  }

  console.log(
    JSON.stringify(
      {
        dryRun: cli.dryRun,
        mode: cli.mode,
        databaseHost: guard.databaseHost,
        sourceRoot,
        mediaRoot,
        products: result.length,
        result,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

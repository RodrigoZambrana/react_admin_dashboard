import { PrismaClient } from '@prisma/client'
import { existsSync } from 'fs'
import { assertMaintenanceScriptSafety, loadEnvFromBackendRoot } from './script-safety'
import {
  applyChanges,
  buildDesiredMediaFromFilesystem,
  diffMedia,
  getProductMedia,
  loadProducts,
  resolveMediaRoot,
  resolveProduct,
  scanFilesystem,
  validateMediaStructure,
} from '../src/common/media/sync-core'

const prisma = new PrismaClient()
const SCRIPT_NAME = 'sync-product-media'

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
    mediaRoot: readValue('media-root') || readValue('source') || null,
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
    allowRemoteWithFlag: true,
  })

  const mediaRoot = cli.mediaRoot ? cli.mediaRoot : resolveMediaRoot()
  if (!existsSync(mediaRoot)) {
    throw new Error(`[${SCRIPT_NAME}] MEDIA_ROOT not found: ${mediaRoot}`)
  }

  const products = await loadProducts(prisma)
  const summary: Array<{
    slug: string
    path: string
    state: string
    images: number
    videos: number
    created: number
    updated: number
    copied: number
    deleted: number
    unchanged: number
  }> = []

  for (const product of products) {
    const structure = await validateMediaStructure(product.slug)
    if (!structure.productExists) {
      console.warn(`[${SCRIPT_NAME}] Producto: ${product.slug} | Ruta: ${structure.productPath} | ⚠ no se encontró carpeta`)
      summary.push({
        slug: product.slug,
        path: structure.productPath,
        state: 'no encontrada ⚠️',
        images: 0,
        videos: 0,
        created: 0,
        updated: 0,
        copied: 0,
        deleted: 0,
        unchanged: 0,
      })
      continue
    }

    const files = await scanFilesystem({ productSlug: product.slug })
    const images = files.filter((file) => file.kind === 'image').length
    const videos = files.filter((file) => file.kind === 'video').length
    if (!structure.hasAnyMedia) {
      console.warn(`[${SCRIPT_NAME}] Producto: ${product.slug} | Ruta: ${structure.productPath} | ⚠ sin media`)
    }

    const current = await getProductMedia(prisma, product.id, product.slug)
    const desired = buildDesiredMediaFromFilesystem(product, files)
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

    summary.push({
      slug: product.slug,
      path: structure.productPath,
      state: stats.created || stats.updated || stats.deleted ? 'diff aplicado' : 'OK',
      images,
      videos,
      created: stats.created,
      updated: stats.updated,
      copied: stats.copied,
      deleted: stats.deleted,
      unchanged: diff.unchanged.length,
    })

    console.log(
      `[${SCRIPT_NAME}] Producto: ${product.slug} | Ruta: ${structure.productPath} | ✔ images: ${images} | ✔ videos: ${videos}`,
    )
  }

  console.log(
    JSON.stringify(
      {
        dryRun: cli.dryRun,
        mode: cli.mode,
        mediaRoot,
        databaseHost: guard.databaseHost,
        products: summary.length,
        summary,
      },
      null,
      2,
    ),
  )

  if (cli.dryRun) {
    console.log(`[${SCRIPT_NAME}] dry-run complete. No files or rows were modified.`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

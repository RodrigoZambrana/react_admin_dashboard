import { PrismaClient } from '@prisma/client'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { assertMaintenanceScriptSafety, loadEnvFromBackendRoot } from './script-safety'
import {
  copyMediaFile,
  getProductMedia,
  loadProducts,
  resolveMediaAbsolutePath,
  resolveMediaRoot,
  buildExportManifest,
} from '../src/common/media/sync-core'

const prisma = new PrismaClient()
const SCRIPT_NAME = 'export-media'

const parseArgs = (argv: string[]) => {
  const readValue = (name: string) => {
    const match = argv.find((entry) => entry === `--${name}` || entry.startsWith(`--${name}=`))
    if (!match) return null
    const separatorIndex = match.indexOf('=')
    return separatorIndex === -1 ? '' : match.slice(separatorIndex + 1)
  }

  return {
    out: readValue('out') || './media-export',
    product: readValue('product') || null,
  }
}

async function main() {
  loadEnvFromBackendRoot()
  const cli = parseArgs(process.argv.slice(2))
  assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    argv: process.argv.slice(2),
    destructive: false,
  })

  const mediaRoot = resolveMediaRoot()
  const outRoot = resolve(process.cwd(), cli.out)
  const filesRoot = join(outRoot, 'files')
  await mkdir(filesRoot, { recursive: true })

  const products = await loadProducts(prisma)
  const selectedProducts = cli.product
    ? products.filter((product) => product.slug === cli.product)
    : products

  if (cli.product && selectedProducts.length === 0) {
    throw new Error(`[${SCRIPT_NAME}] product not found: ${cli.product}`)
  }

  const manifestProducts: Array<{
    id: number
    slug: string
    media: Awaited<ReturnType<typeof getProductMedia>>
  }> = []

  for (const product of selectedProducts) {
    const media = await getProductMedia(prisma, product.id, product.slug)
    let copiedCount = 0

    for (const item of media) {
      const sourcePath = resolveMediaAbsolutePath(item.img, mediaRoot)
      if (!existsSync(sourcePath)) {
        console.warn(`[${SCRIPT_NAME}] missing file for product=${product.slug} path=${item.img}`)
        continue
      }

      const relativePath = item.img.replace(/^\/media\//, '')
      const targetPath = join(filesRoot, relativePath)
      await copyMediaFile(sourcePath, targetPath)
      copiedCount += 1
    }

    manifestProducts.push({
      id: product.id,
      slug: product.slug,
      media,
    })

    console.log(`[${SCRIPT_NAME}] product exported: ${product.slug} (${copiedCount} files)`)
  }

  const manifest = buildExportManifest(
    manifestProducts.map((product) => ({
      id: product.id,
      slug: product.slug,
      media: product.media,
    })),
  )

  await writeFile(join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`[${SCRIPT_NAME}] manifest written: ${join(outRoot, 'manifest.json')}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

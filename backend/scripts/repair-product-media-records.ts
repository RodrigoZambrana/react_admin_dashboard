import { PrismaClient } from '@prisma/client'
import { basename } from 'path'
import { loadEnvFromBackendRoot } from './script-safety'
import {
  isLocalMediaReference,
  resolveExistingLocalMediaReference,
  resolveMediaRoot,
} from '../src/common/media/sync-core'
import { buildProductSlug } from '../src/storefront/utils'

type ProductImageRecord = {
  id: number
  productId: number
  variantId: number | null
  img: string
  publicId: string | null
  name: string | null
  alt: string | null
  version: number
  sortOrder: number
}

const prisma = new PrismaClient()

const normalizeAlt = (value: string, fallbackPublicId: string) => {
  const trimmed = value.trim()
  if (!trimmed || /\(\d+\)/u.test(trimmed)) {
    return basename(fallbackPublicId).replace(/\.[^.]+$/, '')
  }
  return trimmed
}

const canonicalizeRecord = (record: ProductImageRecord) => {
  const reference = record.publicId?.trim() || record.img?.trim() || ''
  if (!reference || !isLocalMediaReference(reference)) {
    return {
      canonicalPublicId: record.publicId?.trim() ?? null,
      canonicalImg: record.img?.trim() ?? null,
      shouldDelete: false,
    }
  }

  const canonical = resolveExistingLocalMediaReference(reference)
  if (!canonical) {
    return {
      canonicalPublicId: null,
      canonicalImg: null,
      shouldDelete: true,
    }
  }

  return {
    canonicalPublicId: canonical,
    canonicalImg: `/media/${canonical}`,
    shouldDelete: false,
  }
}

const main = async () => {
  loadEnvFromBackendRoot()
  const mediaRoot = resolveMediaRoot()
  console.log(`[media-repair] media root: ${mediaRoot}`)

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      productCode: true,
    },
  })
  const productLookup = new Map(
    products.map((product) => [
      product.id,
      {
        slug: buildProductSlug(product.id, product.name, product.productCode ?? undefined),
        name: product.name,
      },
    ]),
  )

  const records = (await prisma.productImage.findMany({
    select: {
      id: true,
      productId: true,
      variantId: true,
      img: true,
      publicId: true,
      name: true,
      alt: true,
      version: true,
      sortOrder: true,
    },
    orderBy: [{ productId: 'asc' }, { variantId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  })) as ProductImageRecord[]

  const grouped = new Map<string, ProductImageRecord[]>()
  for (const record of records) {
    const canonical = canonicalizeRecord(record)
    const canonicalPublicId = canonical.canonicalPublicId ?? '__delete__'
    const groupKey = `${record.productId}:${record.variantId ?? 'null'}:${canonicalPublicId}`
    const list = grouped.get(groupKey) ?? []
    list.push(record)
    grouped.set(groupKey, list)
  }

  let updated = 0
  let deleted = 0
  let skipped = 0

  for (const [groupKey, list] of grouped.entries()) {
    const [productIdRaw, variantIdRaw] = groupKey.split(':')
    const productId = Number(productIdRaw)
    const variantId = variantIdRaw === 'null' ? null : Number(variantIdRaw)
    const keepers: ProductImageRecord[] = []
    const deletions: ProductImageRecord[] = []

    for (const record of list) {
      const canonical = canonicalizeRecord(record)
      if (canonical.shouldDelete || !canonical.canonicalPublicId || !canonical.canonicalImg) {
        deletions.push(record)
        continue
      }

      if (!keepers.length) {
        keepers.push(record)
        const nextAlt = record.alt ? normalizeAlt(record.alt, canonical.canonicalPublicId) : basename(canonical.canonicalPublicId).replace(/\.[^.]+$/, '')
        const changes: Partial<ProductImageRecord> = {}
        if (record.publicId !== canonical.canonicalPublicId) {
          changes.publicId = canonical.canonicalPublicId
        }
        if (record.img !== canonical.canonicalImg) {
          changes.img = canonical.canonicalImg
        }
        if (record.alt !== nextAlt) {
          changes.alt = nextAlt
        }

        if (Object.keys(changes).length > 0) {
          await prisma.productImage.update({
            where: { id: record.id },
            data: changes,
          })
          updated += 1
          const productMeta = productLookup.get(productId)
          console.log(
            `[media-repair] updated product=${productMeta?.slug ?? productId} variant=${variantId ?? 'base'} id=${record.id}`,
          )
        } else {
          skipped += 1
        }
        continue
      }

      deletions.push(record)
    }

    for (const record of deletions) {
      await prisma.productImage.delete({ where: { id: record.id } })
      deleted += 1
      const productMeta = productLookup.get(productId)
      console.log(
        `[media-repair] deleted duplicate/invalid product=${productMeta?.slug ?? productId} variant=${variantId ?? 'base'} id=${record.id}`,
      )
    }
  }

  console.log(
    `[media-repair] done: updated=${updated} deleted=${deleted} skipped=${skipped} records=${records.length}`,
  )
}

main()
  .catch((error) => {
    console.error('[media-repair] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

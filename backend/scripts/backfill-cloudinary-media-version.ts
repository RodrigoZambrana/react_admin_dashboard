import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLOUDINARY_HOST = 'res.cloudinary.com'
const DEFAULT_VERSION = 1

const parseCloudinaryMediaReference = (value?: string | null): { publicId: string; version: number } | null => {
  if (!value) {
    return null
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(value)
  } catch {
    return null
  }

  if (parsedUrl.hostname !== CLOUDINARY_HOST && !parsedUrl.hostname.endsWith(`.${CLOUDINARY_HOST}`)) {
    return null
  }

  const uploadMarker = '/upload/'
  const uploadIndex = parsedUrl.pathname.indexOf(uploadMarker)
  if (uploadIndex === -1) {
    return null
  }

  const tail = parsedUrl.pathname
    .slice(uploadIndex + uploadMarker.length)
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  if (!tail.length) {
    return null
  }

  const versionIndex = tail.findIndex((segment) => /^v\d+$/i.test(segment))
  const version =
    versionIndex >= 0 ? Number.parseInt(tail[versionIndex].slice(1), 10) || DEFAULT_VERSION : DEFAULT_VERSION
  const publicIdSegments = versionIndex >= 0 ? tail.slice(versionIndex + 1) : tail

  if (!publicIdSegments.length) {
    return null
  }

  return {
    publicId: publicIdSegments.map((segment) => decodeURIComponent(segment)).join('/'),
    version,
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const [productImages, cmsAssets] = await Promise.all([
    prisma.productImage.findMany({
      select: {
        id: true,
        img: true,
        publicId: true,
        version: true,
      },
    }),
    prisma.cmsEntryAsset.findMany({
      select: {
        id: true,
        mediaUrl: true,
        publicId: true,
        version: true,
      },
    }),
  ])

  const productUpdates = productImages
    .map((image) => {
      const parsed = image.publicId ? { publicId: image.publicId, version: image.version ?? DEFAULT_VERSION } : parseCloudinaryMediaReference(image.img)
      if (!parsed) {
        return null
      }
      return {
        id: image.id,
        publicId: parsed.publicId,
        version: parsed.version,
      }
    })
    .filter((value): value is { id: number; publicId: string; version: number } => Boolean(value))

  const assetUpdates = cmsAssets
    .map((asset) => {
      const parsed = asset.publicId ? { publicId: asset.publicId, version: asset.version ?? DEFAULT_VERSION } : parseCloudinaryMediaReference(asset.mediaUrl)
      if (!parsed) {
        return null
      }
      return {
        id: asset.id,
        publicId: parsed.publicId,
        version: parsed.version,
      }
    })
    .filter((value): value is { id: number; publicId: string; version: number } => Boolean(value))

  if (dryRun) {
    console.log(JSON.stringify({ productUpdates, assetUpdates }, null, 2))
    return
  }

  for (const update of productUpdates) {
    await prisma.productImage.update({
      where: { id: update.id },
      data: {
        publicId: update.publicId,
        version: update.version,
      },
    })
  }

  for (const update of assetUpdates) {
    await prisma.cmsEntryAsset.update({
      where: { id: update.id },
      data: {
        publicId: update.publicId,
        version: update.version,
      },
    })
  }

  console.log(
    JSON.stringify(
      {
        productImagesUpdated: productUpdates.length,
        cmsAssetsUpdated: assetUpdates.length,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

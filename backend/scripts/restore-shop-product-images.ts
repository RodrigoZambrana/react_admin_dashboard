import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const IMAGE_UPDATES: Array<{ productCode: string; img: string; seoImageUrl: string }> = [
  {
    productCode: 'cortinas-roller',
    img: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
  },
  {
    productCode: 'cortinas-tradicionales',
    img: '/uploads/cms/legacy-assets/img/portfolio/tradicionales/tradicionales_1.jpeg',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/tradicionales/tradicionales_1.jpeg',
  },
  {
    productCode: 'cortinas-de-enrollar-pvc',
    img: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
  },
  {
    productCode: 'cortinas-de-enrollar-aluminio',
    img: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
  },
]

async function main() {
  for (const update of IMAGE_UPDATES) {
    const product = await prisma.product.findFirst({
      where: { productCode: update.productCode },
      select: { id: true, img: true, seoImageUrl: true },
    })

    if (!product) {
      console.warn(`[shop-images] product not found: ${update.productCode}`)
      continue
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        img: update.img,
        seoImageUrl: update.seoImageUrl,
      },
    })

    console.log(`[shop-images] updated ${update.productCode}`)
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

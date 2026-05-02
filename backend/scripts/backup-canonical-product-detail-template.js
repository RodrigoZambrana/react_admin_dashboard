const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const OUTPUT_FILE = path.resolve(
  __dirname,
  '..',
  'prisma',
  'page-snapshots',
  'products',
  'canonical-product-detail-template.json',
);

async function main() {
  const page = await prisma.cmsPage.findFirst({
    where: { path: 'productos/cortinas-roller.html' },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
            include: {
              media: true,
            },
          },
        },
      },
    },
  });

  if (!page) {
    throw new Error('Could not locate productos/cortinas-roller.html to capture the canonical detail template.');
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

  const backup = {
    capturedAt: new Date().toISOString(),
    sourcePagePath: page.path,
    sourcePageTitle: page.title,
    sourcePageSummary: page.summary,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    seoImageUrl: page.seoImageUrl,
    legacySource: page.legacySource,
    layoutKey: page.layoutKey,
    updatedAt: page.updatedAt,
    sections: page.sections,
  };

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
  console.log(`[backup] canonical product detail template written to ${OUTPUT_FILE}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

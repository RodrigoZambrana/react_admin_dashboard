import { disconnectCmsPageEnhancerRunner, runCmsPageEnhancerById } from './apply-cms-page-enhancer'

async function main() {
  await runCmsPageEnhancerById('roller-product-page')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
}).finally(async () => {
  await disconnectCmsPageEnhancerRunner()
})

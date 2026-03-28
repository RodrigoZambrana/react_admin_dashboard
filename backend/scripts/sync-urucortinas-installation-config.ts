import {
  InstallationChargeScope,
  InstallationPricePresentationMode,
  InstallationResolutionMode,
  PrismaClient,
  ProductType,
  SalesUnit,
} from '@prisma/client'
import {
  assertMaintenanceScriptSafety,
  loadEnvFromBackendRoot,
} from './script-safety'

type CategoryPlan = {
  categoryName: string
  serviceName: string
  productCode: string
  description: string
  salePrice: number
  currency: string
  mode: InstallationResolutionMode
  chargeScope: InstallationChargeScope
  pricePresentationMode: InstallationPricePresentationMode
}

type ProductOverridePlan = {
  productName: string
  useCategoryServiceFrom: string
  mode: InstallationResolutionMode
  chargeScope: InstallationChargeScope
  pricePresentationMode: InstallationPricePresentationMode
}

const SCRIPT_NAME = 'sync-urucortinas-installation-config'
const DEFAULT_SERVICE_PRICE = 150
const DEFAULT_CURRENCY = 'USD'

const CATEGORY_PLANS: CategoryPlan[] = [
  {
    categoryName: 'Cortinas',
    serviceName: 'Instalación cortinas',
    productCode: 'SVC-INST-CORTINAS',
    description:
      'Servicio de instalación para cortinas interiores como roller y venecianas.',
    salePrice: DEFAULT_SERVICE_PRICE,
    currency: DEFAULT_CURRENCY,
    mode: InstallationResolutionMode.OPTIONAL_ADD_ON,
    chargeScope: InstallationChargeScope.PER_QUOTE,
    pricePresentationMode: InstallationPricePresentationMode.HIDDEN,
  },
  {
    categoryName: 'Cortinas de enrollar',
    serviceName: 'Instalación persianas',
    productCode: 'SVC-INST-PERSIANAS',
    description:
      'Servicio de instalación para persianas y cortinas de enrollar.',
    salePrice: DEFAULT_SERVICE_PRICE,
    currency: DEFAULT_CURRENCY,
    mode: InstallationResolutionMode.OPTIONAL_ADD_ON,
    chargeScope: InstallationChargeScope.PER_QUOTE,
    pricePresentationMode: InstallationPricePresentationMode.HIDDEN,
  },
  {
    categoryName: 'Cortinas de enrollar en aluminio',
    serviceName: 'Instalación persianas aluminio',
    productCode: 'SVC-INST-PERS-ALU',
    description:
      'Servicio de instalación para persianas o cortinas de enrollar en aluminio.',
    salePrice: DEFAULT_SERVICE_PRICE,
    currency: DEFAULT_CURRENCY,
    mode: InstallationResolutionMode.OPTIONAL_ADD_ON,
    chargeScope: InstallationChargeScope.PER_QUOTE,
    pricePresentationMode: InstallationPricePresentationMode.HIDDEN,
  },
  {
    categoryName: 'Cortinas de enrollar en PVC',
    serviceName: 'Instalación persianas PVC',
    productCode: 'SVC-INST-PERS-PVC',
    description:
      'Servicio de instalación para persianas o cortinas de enrollar en PVC.',
    salePrice: DEFAULT_SERVICE_PRICE,
    currency: DEFAULT_CURRENCY,
    mode: InstallationResolutionMode.OPTIONAL_ADD_ON,
    chargeScope: InstallationChargeScope.PER_QUOTE,
    pricePresentationMode: InstallationPricePresentationMode.HIDDEN,
  },
]

const PRODUCT_OVERRIDE_PLANS: ProductOverridePlan[] = [
  {
    productName: 'Cortina de Bandas Verticales',
    useCategoryServiceFrom: 'Cortinas',
    mode: InstallationResolutionMode.OPTIONAL_ADD_ON,
    chargeScope: InstallationChargeScope.PER_QUOTE,
    pricePresentationMode: InstallationPricePresentationMode.HIDDEN,
  },
]

const summarize = (label: string, payload: Record<string, unknown>) => {
  console.log(`[${SCRIPT_NAME}] ${label}: ${JSON.stringify(payload, null, 2)}`)
}

async function syncCategoryPlan(
  prisma: PrismaClient,
  plan: CategoryPlan,
  dryRun: boolean,
) {
  const category = await prisma.productCategory.findUnique({
    where: { name: plan.categoryName },
    include: { installServiceProduct: true },
  })

  if (!category) {
    summarize('category_missing', { categoryName: plan.categoryName })
    return null
  }

  summarize('category_target', {
    id: category.id,
    name: category.name,
    currentServiceProductId: category.installServiceProductId,
    nextMode: plan.mode,
    nextChargeScope: plan.chargeScope,
    nextPricePresentationMode: plan.pricePresentationMode,
  })

  if (dryRun) {
    return {
      categoryId: category.id,
      categoryName: category.name,
      serviceProductId: category.installServiceProductId ?? category.id * -1,
    }
  }

  const serviceProduct = category.installServiceProductId
    ? await prisma.product.update({
        where: { id: category.installServiceProductId },
        data: {
          name: plan.serviceName,
          productCode: plan.productCode,
          description: plan.description,
          salePrice: plan.salePrice,
          costPrice: 0,
          currency: plan.currency,
          unitOfMeasure: SalesUnit.UNIT,
          productType: ProductType.SERVICE,
          published: true,
          stock: 0,
          permanentStock: false,
          status: 0,
          category: { connect: { id: category.id } },
        },
      })
    : await prisma.product.create({
        data: {
          name: plan.serviceName,
          productCode: plan.productCode,
          description: plan.description,
          salePrice: plan.salePrice,
          costPrice: 0,
          currency: plan.currency,
          unitOfMeasure: SalesUnit.UNIT,
          productType: ProductType.SERVICE,
          published: true,
          stock: 0,
          permanentStock: false,
          status: 0,
          category: { connect: { id: category.id } },
        },
      })

  await prisma.productCategory.update({
    where: { id: category.id },
    data: {
      installationResolutionMode: plan.mode,
      installationChargeScope: plan.chargeScope,
      installationPricePresentationMode: plan.pricePresentationMode,
      installServiceProductId: serviceProduct.id,
    },
  })

  summarize('category_synced', {
    categoryId: category.id,
    categoryName: category.name,
    serviceProductId: serviceProduct.id,
    serviceProductName: serviceProduct.name,
  })

  return {
    categoryId: category.id,
    categoryName: category.name,
    serviceProductId: serviceProduct.id,
  }
}

async function syncProductOverride(
  prisma: PrismaClient,
  plan: ProductOverridePlan,
  categoryServiceMap: Map<string, number>,
  dryRun: boolean,
) {
  const product = await prisma.product.findFirst({
    where: { name: plan.productName, published: true },
    select: {
      id: true,
      name: true,
      categoryId: true,
      installServiceProductId: true,
      installationResolutionMode: true,
      installationChargeScope: true,
    },
  })

  if (!product) {
    summarize('product_override_missing', { productName: plan.productName })
    return
  }

  const sharedServiceProductId = categoryServiceMap.get(plan.useCategoryServiceFrom) || null
  if (!sharedServiceProductId) {
    summarize('product_override_service_missing', {
      productName: plan.productName,
      useCategoryServiceFrom: plan.useCategoryServiceFrom,
    })
    return
  }

  summarize('product_override_target', {
    productId: product.id,
    productName: product.name,
    sharedServiceProductId,
    nextMode: plan.mode,
    nextChargeScope: plan.chargeScope,
    nextPricePresentationMode: plan.pricePresentationMode,
  })

  if (dryRun) {
    return
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      installationResolutionMode: plan.mode,
      installationChargeScope: plan.chargeScope,
      installationPricePresentationMode: plan.pricePresentationMode,
      installServiceProductId: sharedServiceProductId,
    },
  })

  summarize('product_override_synced', {
    productId: product.id,
    productName: product.name,
    installServiceProductId: sharedServiceProductId,
  })
}

async function main() {
  loadEnvFromBackendRoot()
  const safety = assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    argv: process.argv.slice(2),
    destructive: true,
    defaultDryRun: true,
  })
  const prisma = new PrismaClient()

  try {
    summarize('start', {
      dryRun: safety.dryRun,
      databaseHost: safety.databaseHost,
    })

    const categoryServiceMap = new Map<string, number>()
    for (const plan of CATEGORY_PLANS) {
      const result = await syncCategoryPlan(prisma, plan, safety.dryRun)
      if (result?.serviceProductId) {
        categoryServiceMap.set(result.categoryName, result.serviceProductId)
      }
    }

    for (const plan of PRODUCT_OVERRIDE_PLANS) {
      await syncProductOverride(prisma, plan, categoryServiceMap, safety.dryRun)
    }

    summarize('done', {
      dryRun: safety.dryRun,
      categoriesPlanned: CATEGORY_PLANS.length,
      productOverridesPlanned: PRODUCT_OVERRIDE_PLANS.length,
    })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`[${SCRIPT_NAME}] failed`, error)
  process.exitCode = 1
})

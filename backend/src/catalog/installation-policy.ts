import {
  InstallationChargeScope,
  InstallationPricePresentationMode,
  InstallationResolutionMode,
  type Product,
  type ProductCategory,
} from '@prisma/client'

type ProductLike = Pick<
  Product,
  'id' | 'name' | 'productCode' | 'salePrice' | 'currency' | 'unitOfMeasure'
> | null

type CategoryPolicyLike = Pick<
  ProductCategory,
  | 'installationResolutionMode'
  | 'installationChargeScope'
  | 'installationPricePresentationMode'
> & {
  installServiceProduct?: ProductLike
} | null

type ProductPolicyLike = {
  installationResolutionMode?: InstallationResolutionMode | null
  installationChargeScope?: InstallationChargeScope | null
  installationPricePresentationMode?: InstallationPricePresentationMode | null
  installServiceProduct?: ProductLike
  category?: CategoryPolicyLike
} | null

export const DEFAULT_INSTALLATION_RESOLUTION_MODE =
  InstallationResolutionMode.UNKNOWN

export const DEFAULT_INSTALLATION_CHARGE_SCOPE =
  InstallationChargeScope.PER_QUOTE

export const DEFAULT_INSTALLATION_PRICE_PRESENTATION_MODE =
  InstallationPricePresentationMode.HIDDEN

export const normalizeInstallationResolutionMode = (
  value: unknown,
): InstallationResolutionMode | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

  const match = (Object.values(InstallationResolutionMode) as string[]).find(
    (entry) => entry === normalized,
  )

  return (match as InstallationResolutionMode | undefined) ?? null
}

export const normalizeInstallationPricePresentationMode = (
  value: unknown,
): InstallationPricePresentationMode | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

  const match = (Object.values(InstallationPricePresentationMode) as string[]).find(
    (entry) => entry === normalized,
  )

  return (match as InstallationPricePresentationMode | undefined) ?? null
}

export const resolveEffectiveInstallationPolicy = (product: ProductPolicyLike) => {
  const category = product?.category ?? null
  const serviceProduct = product?.installServiceProduct ?? category?.installServiceProduct ?? null

  const explicitProductMode = normalizeInstallationResolutionMode(
    product?.installationResolutionMode,
  )
  const explicitCategoryMode = normalizeInstallationResolutionMode(
    category?.installationResolutionMode,
  )
  const explicitProductChargeScope =
    product?.installationChargeScope ?? null
  const explicitCategoryChargeScope =
    category?.installationChargeScope ?? null
  const explicitProductPricePresentationMode =
    product?.installationPricePresentationMode ?? null
  const explicitCategoryPricePresentationMode =
    category?.installationPricePresentationMode ?? null

  const mode =
    explicitProductMode ??
    explicitCategoryMode ??
    (serviceProduct
      ? InstallationResolutionMode.OPTIONAL_ADD_ON
      : DEFAULT_INSTALLATION_RESOLUTION_MODE)

  const source = explicitProductMode
    ? 'product'
    : explicitCategoryMode
      ? 'category'
      : serviceProduct
        ? 'service_product_fallback'
        : 'none'

  return {
    mode,
    chargeScope:
      explicitProductChargeScope ??
      explicitCategoryChargeScope ??
      DEFAULT_INSTALLATION_CHARGE_SCOPE,
    pricePresentationMode:
      explicitProductPricePresentationMode ??
      explicitCategoryPricePresentationMode ??
      DEFAULT_INSTALLATION_PRICE_PRESENTATION_MODE,
    source,
    serviceProduct,
    hasServiceProduct: Boolean(serviceProduct),
  }
}

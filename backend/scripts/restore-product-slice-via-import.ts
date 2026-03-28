import { createGunzip } from 'node:zlib'
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import * as readline from 'node:readline'
import {
  assertMaintenanceScriptSafety,
  loadEnvFromBackendRoot,
} from './script-safety'

type BackupCategory = {
  oldId: number
  name: string
  parentOldId: number | null
}

type BackupProduct = {
  oldId: number
  name: string
  productCode: string | null
  description: string | null
  specifications: string | null
  categoryOldId: number | null
  mode: string | null
  salePrice: number | null
  costPrice: number | null
  currency: string | null
  unitOfMeasure: string | null
  stock: number | null
  permanentStock: boolean | null
  brand: string | null
  vendor: string | null
  published: boolean | null
}

type BackupMatrixRow = {
  oldProductId: number
  familyId: string
  serie: string
  material: string | null
  color: string
  vidrio: string
  widthMm: number
  heightMm: number
  hasMosquitero: boolean
  hasShutterMonoblock: boolean
  shutterSystem: string | null
  priceBase: number | null
  priceMosquitero: number | null
  priceMonoblock: number | null
  priceMonoblockMosquitero: number | null
  currency: string | null
  detailSnapshot: string | null
  source: string | null
  referenceDate: string | null
}

type RestoreArgs = {
  backupPath: string
  parametricCsvPath: string | null
  outputDir: string
  apiBaseUrl: string
  adminEmail: string
  adminPassword: string
  dryRun: boolean
}

type ParametricCsvRow = {
  product_code: string
  category_id: string | number
  description: string
  published: boolean
  family_id: string
  serie: string
  material: string
  color: string
  vidrio: string
  width_mm: number
  height_mm: number
  has_mosquitero: boolean
  has_shutter_monoblock: boolean
  shutter_system: string
  price_base: number | string
  price_mosquitero: number | string
  price_mb: number | string
  price_mb_c_mosq: number | string
  currency: string
  source: string
  reference_date: string
  specifications: string
}

type CurrentCategory = {
  id: number
  name: string
  parentId: number | null
}

const SCRIPT_NAME = 'restore-product-slice-via-import'
const DEFAULT_BACKUP_PATH =
  '/Users/rodrigo/git/personal/react_admin_dashboard/backups/db/react_admin_dashboard_20260327_170039_postgres-local-pre-recovery.sql.gz'
const DEFAULT_PARAMETRIC_REFERENCE_CSV =
  '/Users/rodrigo/Personal/Proyectos/urucortinas/costows/costos_lidasur_20_06_25/csv_finales_prod/cotizaciones_18_11_25.csv'
const DEFAULT_OUTPUT_DIR = resolve(process.cwd(), '.generated', 'catalog-restore')
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4000/api'
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!Local'

const CATEGORY_NAMES_TO_SKIP = new Set([''])

function parseArgs(argv: string[], dryRun: boolean): RestoreArgs {
  const readFlag = (name: string) => {
    const index = argv.findIndex((entry) => entry === name)
    if (index === -1) {
      return null
    }
    return argv[index + 1] || null
  }

  const backupPath = resolve(readFlag('--backup') || DEFAULT_BACKUP_PATH)
  const parametricCsvRaw = readFlag('--parametric-csv')
  const outputDir = resolve(readFlag('--out-dir') || DEFAULT_OUTPUT_DIR)
  const apiBaseUrl = (readFlag('--api-base') || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
  const adminEmail = readFlag('--email') || DEFAULT_ADMIN_EMAIL
  const adminPassword = readFlag('--password') || DEFAULT_ADMIN_PASSWORD

  return {
    backupPath,
    parametricCsvPath: parametricCsvRaw ? resolve(parametricCsvRaw) : null,
    outputDir,
    apiBaseUrl,
    adminEmail,
    adminPassword,
    dryRun,
  }
}

function decodeCopyValue(raw: string | undefined): string | null {
  if (raw === undefined || raw === '\\N') {
    return null
  }
  return raw
    .replace(/\\\\/g, '\\')
    .replace(/\\t/g, '\t')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
}

function parseInteger(raw: string | null): number | null {
  if (!raw) return null
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null
}

function parseDecimal(raw: string | null): number | null {
  if (!raw) return null
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : null
}

function parseBoolean(raw: string | null): boolean | null {
  if (!raw) return null
  return raw === 't' || raw === 'true' || raw === '1'
}

function normalizeName(value: string | null | undefined): string {
  return String(value || '').trim()
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function deterministicSimpleProductCode(product: BackupProduct): string {
  if (product.productCode?.trim()) {
    return product.productCode.trim()
  }
  return `legacy-sqm-${slugify(product.name)}-${product.oldId}`
}

function deterministicParametricProductCode(product: BackupProduct): string {
  if (product.productCode?.trim()) {
    return product.productCode.trim()
  }
  return `legacy-parametric-${slugify(product.name)}-${product.oldId}`
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function writeCsvFile(
  outputPath: string,
  rows: Array<Record<string, unknown>>,
  preferredOrder?: string[],
) {
  if (!rows.length) {
    writeFileSync(outputPath, '', 'utf8')
    return
  }
  const header = preferredOrder?.length
    ? preferredOrder
    : Object.keys(rows[0])
  const lines = [
    header.join(','),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(',')),
  ]
  writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')
}

async function parseBackupDump(backupPath: string) {
  const categoriesByOldId = new Map<number, BackupCategory>()
  const productsByOldId = new Map<number, BackupProduct>()
  const matrixRows: BackupMatrixRow[] = []

  let currentSection: 'ProductCategory' | 'Product' | 'Matrix' | null = null
  let currentColumns: string[] = []
  const copyLinePattern = /^COPY\s+public\.(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+\((.*)\)\s+FROM\s+stdin;$/i

  const stream = createReadStream(backupPath).pipe(createGunzip())
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  for await (const line of rl) {
    const copyMatch = line.match(copyLinePattern)
    if (copyMatch) {
      const tableName = copyMatch[1] || copyMatch[2]
      currentColumns = copyMatch[3]
        .split(',')
        .map((entry) => entry.trim().replace(/^"|"$/g, ''))
      currentSection =
        tableName === 'ProductCategory'
          ? 'ProductCategory'
          : tableName === 'Product'
          ? 'Product'
          : tableName === 'dimension_price_matrix'
          ? 'Matrix'
          : null
      continue
    }

    if (!currentSection) {
      continue
    }

    if (line === '\\.') {
      currentSection = null
      currentColumns = []
      continue
    }

    const rawValues = line.split('\t')
    const row = Object.create(null) as Record<string, string | null>
    currentColumns.forEach((column, index) => {
      row[column] = decodeCopyValue(rawValues[index])
    })

    if (currentSection === 'ProductCategory') {
      const oldId = parseInteger(row.id)
      const name = normalizeName(row.name)
      if (!oldId || !name) continue
      categoriesByOldId.set(oldId, {
        oldId,
        name,
        parentOldId: parseInteger(row.parentId),
      })
      continue
    }

    if (currentSection === 'Product') {
      const oldId = parseInteger(row.id)
      const name = normalizeName(row.name)
      if (!oldId || !name) continue
      productsByOldId.set(oldId, {
        oldId,
        name,
        productCode: row.productCode,
        description: row.description,
        specifications: row.specifications,
        categoryOldId: parseInteger(row.categoryId),
        mode: row.mode,
        salePrice: parseDecimal(row.precio_venta),
        costPrice: parseDecimal(row.precio_costo),
        currency: row.currency,
        unitOfMeasure: row.unitOfMeasure,
        stock: parseInteger(row.stock),
        permanentStock: parseBoolean(row.permanentStock),
        brand: row.brand,
        vendor: row.vendor,
        published: parseBoolean(row.published),
      })
      continue
    }

    if (currentSection === 'Matrix') {
      const oldProductId = parseInteger(row.productId)
      if (!oldProductId) continue
      matrixRows.push({
        oldProductId,
        familyId: normalizeName(row.familyId),
        serie: normalizeName(row.serie),
        material: row.material,
        color: normalizeName(row.color),
        vidrio: normalizeName(row.vidrio),
        widthMm: parseInteger(row.widthMm) || 0,
        heightMm: parseInteger(row.heightMm) || 0,
        hasMosquitero: Boolean(parseBoolean(row.hasMosquitero)),
        hasShutterMonoblock: Boolean(parseBoolean(row.hasShutterMonoblock)),
        shutterSystem: row.shutterSystem,
        priceBase: parseDecimal(row.priceBase),
        priceMosquitero: parseDecimal(row.priceMosquitero),
        priceMonoblock: parseDecimal(row.priceMonoblock),
        priceMonoblockMosquitero: parseDecimal(row.priceMonoblockMosquitero),
        currency: row.currency,
        detailSnapshot: row.detailSnapshot,
        source: row.source,
        referenceDate: row.reference_date,
      })
    }
  }

  return {
    categoriesByOldId,
    productsByOldId,
    matrixRows,
  }
}

function collectCategoryClosure(
  targetProducts: BackupProduct[],
  categoriesByOldId: Map<number, BackupCategory>,
) {
  const needed = new Set<number>()

  const visit = (oldId: number | null) => {
    if (!oldId || needed.has(oldId)) return
    needed.add(oldId)
    const category = categoriesByOldId.get(oldId)
    if (category?.parentOldId) {
      visit(category.parentOldId)
    }
  }

  targetProducts.forEach((product) => visit(product.categoryOldId))

  const ordered = Array.from(needed)
    .map((oldId) => categoriesByOldId.get(oldId))
    .filter((category): category is BackupCategory => Boolean(category))
    .filter((category) => !CATEGORY_NAMES_TO_SKIP.has(category.name))
    .sort((left, right) => {
      const leftDepth = computeCategoryDepth(left, categoriesByOldId)
      const rightDepth = computeCategoryDepth(right, categoriesByOldId)
      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth
      }
      return left.name.localeCompare(right.name)
    })

  return ordered
}

function computeCategoryDepth(
  category: BackupCategory,
  categoriesByOldId: Map<number, BackupCategory>,
): number {
  let depth = 0
  let current = category
  while (current.parentOldId) {
    const parent = categoriesByOldId.get(current.parentOldId)
    if (!parent) break
    depth += 1
    current = parent
  }
  return depth
}

function buildSimpleProductRows(
  simpleProducts: BackupProduct[],
  categoriesByOldId: Map<number, BackupCategory>,
) {
  return simpleProducts.map((product) => ({
    name: product.name,
    productCode: deterministicSimpleProductCode(product),
    description: product.description || '',
    specifications: product.specifications || '',
    category: categoriesByOldId.get(product.categoryOldId || 0)?.name || '',
    salePrice: product.salePrice ?? '',
    costPrice: product.costPrice ?? '',
    currency: product.currency || 'USD',
    unitOfMeasure: product.unitOfMeasure || 'UNIT',
    stock: product.stock ?? 0,
    permanentStock: product.permanentStock ?? true,
    published: product.published ?? true,
    mode: 'SIMPLE',
    brand: product.brand || '',
    vendor: product.vendor || '',
  }))
}

function buildParametricRows(
  parametricProducts: BackupProduct[],
  categoriesByOldId: Map<number, BackupCategory>,
  currentCategoryIdsByName: Map<string, number>,
  matrixRows: BackupMatrixRow[],
) {
  const targetIds = new Set(parametricProducts.map((product) => product.oldId))
  const productsByOldId = new Map(parametricProducts.map((product) => [product.oldId, product]))

  return matrixRows
    .filter((row) => targetIds.has(row.oldProductId))
    .map((row) => {
      const product = productsByOldId.get(row.oldProductId)
      if (!product) {
        return null
      }
      const categoryName = categoriesByOldId.get(product.categoryOldId || 0)?.name || ''
      const currentCategoryId = currentCategoryIdsByName.get(categoryName.toLowerCase()) || ''
      return {
        product_code: deterministicParametricProductCode(product),
        category_id: currentCategoryId,
        description: product.description || '',
        published: product.published ?? true,
        family_id: row.familyId,
        serie: row.serie,
        material: row.material || '',
        color: row.color,
        vidrio: row.vidrio,
        width_mm: row.widthMm,
        height_mm: row.heightMm,
        has_mosquitero: row.hasMosquitero,
        has_shutter_monoblock: row.hasShutterMonoblock,
        shutter_system: row.shutterSystem || '',
        price_base: row.priceBase ?? '',
        price_mosquitero: row.priceMosquitero ?? '',
        price_mb: row.priceMonoblock ?? '',
        price_mb_c_mosq: row.priceMonoblockMosquitero ?? '',
        currency: row.currency || product.currency || 'USD',
        source: row.source || '',
        reference_date: row.referenceDate || '',
        specifications: row.detailSnapshot || product.specifications || '',
      }
    })
    .filter(Boolean) as ParametricCsvRow[]
}

async function apiJson<T>(
  url: string,
  options?: {
    method?: string
    token?: string
    body?: unknown
  },
): Promise<T> {
  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`API ${options?.method || 'GET'} ${url} failed: ${response.status} ${await response.text()}`)
  }

  return (await response.json()) as T
}

async function apiMultipart<T>(
  url: string,
  token: string,
  fieldName: string,
  filename: string,
  content: Buffer,
): Promise<T> {
  const formData = new FormData()
  formData.append(fieldName, new Blob([new Uint8Array(content)]), filename)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`API POST ${url} failed: ${response.status} ${await response.text()}`)
  }

  return (await response.json()) as T
}

async function signIn(apiBaseUrl: string, email: string, password: string) {
  const response = await apiJson<{ token: string }>(`${apiBaseUrl}/sign-in`, {
    method: 'POST',
    body: { email, password },
  })
  if (!response?.token) {
    throw new Error('Sign-in did not return a token.')
  }
  return response.token
}

async function fetchCurrentCategories(apiBaseUrl: string, token: string) {
  const rows = await apiJson<CurrentCategory[]>(`${apiBaseUrl}/settings/product-categories`, {
    token,
  })
  return rows
}

async function ensureCategories(
  apiBaseUrl: string,
  token: string,
  backupCategories: BackupCategory[],
) {
  let current = await fetchCurrentCategories(apiBaseUrl, token)
  const byName = () =>
    new Map(current.map((category) => [category.name.trim().toLowerCase(), category]))

  for (const backupCategory of backupCategories) {
    const currentMap = byName()
    const existing = currentMap.get(backupCategory.name.toLowerCase())
    if (existing) {
      continue
    }

    const parentName =
      backupCategory.parentOldId !== null
        ? backupCategories.find((category) => category.oldId === backupCategory.parentOldId)?.name || null
        : null
    const parentId = parentName ? currentMap.get(parentName.toLowerCase())?.id || null : null

    await apiJson<boolean>(`${apiBaseUrl}/settings/product-categories/create`, {
      method: 'POST',
      token,
      body: {
        name: backupCategory.name,
        parentId,
      },
    })
    current = await fetchCurrentCategories(apiBaseUrl, token)
  }

  return current
}

function summarize<T>(label: string, rows: T[]) {
  console.log(`${label}: ${rows.length}`)
}

async function main() {
  loadEnvFromBackendRoot()
  const guard = assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    argv: process.argv.slice(2),
    destructive: true,
    defaultDryRun: true,
  })
  const args = parseArgs(process.argv.slice(2), guard.dryRun)

  if (!existsSync(args.backupPath)) {
    throw new Error(`Backup not found: ${args.backupPath}`)
  }
  if (args.parametricCsvPath && !existsSync(args.parametricCsvPath)) {
    throw new Error(`Parametric CSV not found: ${args.parametricCsvPath}`)
  }
  if (!args.adminPassword.trim()) {
    throw new Error('An admin password is required. Pass --password or set DEFAULT_ADMIN_PASSWORD.')
  }

  mkdirSync(args.outputDir, { recursive: true })

  const parsed = await parseBackupDump(args.backupPath)
  const allProducts = Array.from(parsed.productsByOldId.values())
  const simpleProducts = allProducts.filter(
    (product) => product.mode === 'SIMPLE' && product.unitOfMeasure === 'SQUARE_METER',
  )
  const parametricProducts = allProducts.filter((product) => product.mode === 'PARAMETRIC')
  const relevantProducts = [...simpleProducts, ...parametricProducts]
  const relevantCategories = collectCategoryClosure(relevantProducts, parsed.categoriesByOldId)

  const simpleRows = buildSimpleProductRows(simpleProducts, parsed.categoriesByOldId)
  const simpleCsvPath = join(args.outputDir, 'products-square-meter-restore.csv')
  writeCsvFile(simpleCsvPath, simpleRows, [
    'name',
    'productCode',
    'description',
    'specifications',
    'category',
    'salePrice',
    'costPrice',
    'currency',
    'unitOfMeasure',
    'stock',
    'permanentStock',
    'published',
    'mode',
    'brand',
    'vendor',
  ])

  console.log(`[${SCRIPT_NAME}] backup: ${basename(args.backupPath)}`)
  summarize('Simple products (m2)', simpleProducts)
  summarize('Parametric products', parametricProducts)
  summarize('Matrix rows', parsed.matrixRows.filter((row) => parsed.productsByOldId.get(row.oldProductId)?.mode === 'PARAMETRIC'))
  summarize('Categories in slice', relevantCategories)
  console.log(`[${SCRIPT_NAME}] generated: ${simpleCsvPath}`)
  if (existsSync(DEFAULT_PARAMETRIC_REFERENCE_CSV)) {
    console.log(`[${SCRIPT_NAME}] parametric CSV reference available: ${DEFAULT_PARAMETRIC_REFERENCE_CSV}`)
  }

  const previewParametricCsvPath =
    args.parametricCsvPath || join(args.outputDir, 'parametric-products-restore.csv')
  if (!args.parametricCsvPath) {
    const previewParametricRows = buildParametricRows(
      parametricProducts,
      parsed.categoriesByOldId,
      new Map(),
      parsed.matrixRows,
    )
    writeCsvFile(previewParametricCsvPath, previewParametricRows, [
      'product_code',
      'category_id',
      'description',
      'published',
      'family_id',
      'serie',
      'material',
      'color',
      'vidrio',
      'width_mm',
      'height_mm',
      'has_mosquitero',
      'has_shutter_monoblock',
      'shutter_system',
      'price_base',
      'price_mosquitero',
      'price_mb',
      'price_mb_c_mosq',
      'currency',
      'source',
      'reference_date',
      'specifications',
    ])
  }
  console.log(`[${SCRIPT_NAME}] generated: ${previewParametricCsvPath}`)

  if (args.dryRun) {
    console.log(`[${SCRIPT_NAME}] dry-run complete. No API imports were executed.`)
    return
  }

  const token = await signIn(args.apiBaseUrl, args.adminEmail, args.adminPassword)
  const currentCategories = await ensureCategories(args.apiBaseUrl, token, relevantCategories)
  const currentCategoryIdsByName = new Map(
    currentCategories.map((category) => [category.name.trim().toLowerCase(), category.id]),
  )

  const parametricCsvPath = previewParametricCsvPath
  if (!args.parametricCsvPath) {
    const parametricRows = buildParametricRows(
      parametricProducts,
      parsed.categoriesByOldId,
      currentCategoryIdsByName,
      parsed.matrixRows,
    )
    writeCsvFile(parametricCsvPath, parametricRows, [
      'product_code',
      'category_id',
      'description',
      'published',
      'family_id',
      'serie',
      'material',
      'color',
      'vidrio',
      'width_mm',
      'height_mm',
      'has_mosquitero',
      'has_shutter_monoblock',
      'shutter_system',
      'price_base',
      'price_mosquitero',
      'price_mb',
      'price_mb_c_mosq',
      'currency',
      'source',
      'reference_date',
      'specifications',
    ])
  }

  console.log(`[${SCRIPT_NAME}] generated: ${parametricCsvPath}`)

  const simpleImport = await apiMultipart<{
    created: number
    updated: number
    errors: Array<{ row: number; message: string }>
  }>(
    `${args.apiBaseUrl}/sales/products/import`,
    token,
    'file',
    basename(simpleCsvPath),
    Buffer.from(readFileSync(simpleCsvPath)),
  )

  const parametricImport = await apiMultipart<{
    productsCreated: number
    productsUpdated: number
    matrixRows: number
    warnings: string[]
  }>(
    `${args.apiBaseUrl}/pricing/products/import-full`,
    token,
    'file',
    basename(parametricCsvPath),
    Buffer.from(readFileSync(parametricCsvPath)),
  )

  console.log(`[${SCRIPT_NAME}] simple import: created=${simpleImport.created} updated=${simpleImport.updated} errors=${simpleImport.errors.length}`)
  if (simpleImport.errors.length) {
    console.log(`[${SCRIPT_NAME}] simple import errors:`)
    simpleImport.errors.forEach((error) => console.log(`  - row ${error.row}: ${error.message}`))
  }

  console.log(
    `[${SCRIPT_NAME}] parametric import: created=${parametricImport.productsCreated} updated=${parametricImport.productsUpdated} matrixRows=${parametricImport.matrixRows} warnings=${parametricImport.warnings.length}`,
  )
  if (parametricImport.warnings.length) {
    console.log(`[${SCRIPT_NAME}] parametric import warnings:`)
    parametricImport.warnings.slice(0, 50).forEach((warning) => console.log(`  - ${warning}`))
    if (parametricImport.warnings.length > 50) {
      console.log(`  ... ${parametricImport.warnings.length - 50} more`)
    }
  }
}

main().catch((error) => {
  console.error(`[${SCRIPT_NAME}] failed`, error)
  process.exitCode = 1
})

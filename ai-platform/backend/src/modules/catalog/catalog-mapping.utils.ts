import { CatalogItemCandidate } from './catalog.types';

const aliasGroups = {
  externalId: ['id', 'external_id', 'externalId'],
  sku: ['sku', 'codigo', 'code'],
  name: ['name', 'nombre', 'product', 'producto', 'title', 'titulo'],
  description: ['description', 'descripcion', 'details', 'detalle'],
  price: ['price', 'precio', 'sale_price', 'salePrice'],
  currency: ['currency', 'moneda'],
  availability: ['availability', 'stock', 'disponibilidad'],
} as const;

export function mapStructuredRowToCatalogItem(
  row: Record<string, string>,
): CatalogItemCandidate | null {
  const name = resolveField(row, aliasGroups.name);

  if (!name) {
    return null;
  }

  const externalId = resolveField(row, aliasGroups.externalId);
  const sku = resolveField(row, aliasGroups.sku);
  const description = resolveField(row, aliasGroups.description);
  const price = parseOptionalNumber(resolveField(row, aliasGroups.price));
  const currency = resolveField(row, aliasGroups.currency);
  const availability = resolveField(row, aliasGroups.availability);
  const attributeKeys = new Set(
    Object.values(aliasGroups).flat().map((value) => normalizeKey(value)),
  );
  const attributes = Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !attributeKeys.has(normalizeKey(key)))
      .map(([key, value]) => [key, value])
      .filter(([, value]) => String(value).trim().length > 0),
  );

  return {
    externalId: externalId ?? null,
    sku: sku ?? null,
    name,
    description: description ?? null,
    price,
    currency: currency ?? null,
    availability: availability ?? null,
    attributes,
  };
}

export function buildCatalogSearchText(item: CatalogItemCandidate) {
  return [
    item.externalId ?? '',
    item.sku ?? '',
    item.name,
    item.description ?? '',
    item.currency ?? '',
    item.availability ?? '',
    ...Object.values(item.attributes ?? {}),
  ]
    .filter((value) => String(value).trim().length > 0)
    .join(' ');
}

export function normalizeCatalogText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeCatalogText(value: string) {
  return normalizeCatalogText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function resolveField(
  row: Record<string, string>,
  aliases: readonly string[],
) {
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const matchedEntry = Object.entries(row).find(
      ([key]) => normalizeKey(key) === normalizedAlias,
    );

    if (matchedEntry && matchedEntry[1].trim().length > 0) {
      return matchedEntry[1].trim();
    }
  }

  return null;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

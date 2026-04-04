import { BadRequestException, Injectable } from '@nestjs/common';

import { CatalogItemCandidate, RestCatalogSourceConfig } from './catalog.types';
import {
  buildCatalogSearchText,
  mapStructuredRowToCatalogItem,
} from './catalog-mapping.utils';

@Injectable()
export class CatalogRestSourceAdapter {
  async fetchItems(config: RestCatalogSourceConfig) {
    const url = new URL(config.endpointUrl);

    if (config.queryParam) {
      url.searchParams.set(config.queryParam, '*');
    }

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(config.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `REST catalog source returned ${response.status} for ${config.endpointUrl}`,
      );
    }

    const payload = (await response.json()) as unknown;
    const items = this.resolveItems(payload, config)
      .map((item) => this.mapItem(item, config))
      .filter((item): item is CatalogItemCandidate => Boolean(item));

    if (items.length === 0) {
      throw new BadRequestException(
        `REST catalog source "${config.endpointUrl}" did not return usable items`,
      );
    }

    return items.map((item) => ({
      ...item,
      searchText: buildCatalogSearchText(item),
    }));
  }

  private resolveItems(payload: unknown, config: RestCatalogSourceConfig) {
    const itemsPath =
      config.itemsPath?.trim().length ? config.itemsPath.trim().split('.') : null;
    const resolved = itemsPath
      ? itemsPath.reduce<unknown>(
          (current, segment) =>
            current && typeof current === 'object'
              ? (current as Record<string, unknown>)[segment]
              : undefined,
          payload,
        )
      : payload && typeof payload === 'object' && Array.isArray((payload as any).items)
        ? (payload as any).items
        : payload;

    if (!Array.isArray(resolved)) {
      return [];
    }

    return resolved.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    );
  }

  private mapItem(
    item: Record<string, unknown>,
    config: RestCatalogSourceConfig,
  ): CatalogItemCandidate | null {
    const fieldMap = config.fieldMap ?? {};
    const row = Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, stringifyValue(value)]),
    );

    if (
      fieldMap.externalId ||
      fieldMap.sku ||
      fieldMap.name ||
      fieldMap.description ||
      fieldMap.price ||
      fieldMap.currency ||
      fieldMap.availability
    ) {
      return {
        externalId: resolveMappedField(row, fieldMap.externalId) ?? null,
        sku: resolveMappedField(row, fieldMap.sku) ?? null,
        name: resolveMappedField(row, fieldMap.name) ?? '',
        description: resolveMappedField(row, fieldMap.description) ?? null,
        price: parseOptionalNumber(resolveMappedField(row, fieldMap.price)),
        currency: resolveMappedField(row, fieldMap.currency) ?? null,
        availability: resolveMappedField(row, fieldMap.availability) ?? null,
        attributes: Object.fromEntries(
          Object.entries(row).filter(
            ([key]) =>
              !Object.values(fieldMap).some((mapped) => mapped === key),
          ),
        ),
      };
    }

    return mapStructuredRowToCatalogItem(row);
  }
}

function resolveMappedField(
  row: Record<string, string>,
  key: string | undefined,
) {
  if (!key) {
    return null;
  }

  const matchedKey = Object.keys(row).find(
    (candidate) => candidate.trim().toLowerCase() === key.trim().toLowerCase(),
  );
  return matchedKey ? row[matchedKey] : null;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value).trim();
}

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

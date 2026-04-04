import { Injectable } from '@nestjs/common';

export type ProductCatalogEntry = {
  sku: string;
  name: string;
  price: number;
  currency: string;
  availability: string;
};

export class ProductCatalogNoMatchError extends Error {
  constructor(query: string) {
    super(`No product match found for query "${query}"`);
  }
}

const catalog: ProductCatalogEntry[] = [
  {
    sku: 'A-19',
    name: 'Atlas Carry Case',
    price: 129,
    currency: 'USD',
    availability: 'in_stock',
  },
  {
    sku: 'B-77',
    name: 'Beacon Desk Lamp',
    price: 89,
    currency: 'USD',
    availability: 'backorder',
  },
];

@Injectable()
export class ProductCatalogService {
  findMatch(input: { sku?: string; query?: string | null }) {
    const sku = input.sku?.trim();

    if (sku) {
      const bySku = catalog.find(
        (product) => product.sku.toLowerCase() === sku.toLowerCase(),
      );

      if (bySku) {
        return {
          matched: true as const,
          matchedBy: 'sku' as const,
          product: bySku,
          score: 100,
        };
      }
    }

    const query = input.query?.trim();

    if (!query) {
      return {
        matched: false as const,
        matchedBy: null,
        product: null,
        score: 0,
      };
    }

    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);
    const candidates = catalog
      .map((product) => {
        const normalizedName = normalizeText(product.name);
        const productTokens = tokenize(product.name);
        const overlap = productTokens.filter((token) =>
          queryTokens.includes(token),
        ).length;

        let score = 0;

        if (normalizedQuery.includes(normalizedName)) {
          score = 95;
        } else if (
          queryTokens.length >= 2 &&
          overlap >= queryTokens.length &&
          overlap >= Math.min(2, productTokens.length)
        ) {
          score = 80;
        } else if (
          productTokens.length >= 2 &&
          overlap === productTokens.length
        ) {
          score = 75;
        }

        return {
          product,
          score,
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);

    const best = candidates[0];

    if (!best) {
      return {
        matched: false as const,
        matchedBy: null,
        product: null,
        score: 0,
      };
    }

    return {
      matched: true as const,
      matchedBy: 'query' as const,
      product: best.product,
      score: best.score,
    };
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

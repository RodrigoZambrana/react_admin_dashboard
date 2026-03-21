import type {
  AuthSession,
  CategorySummary,
  CreateOrderPayload,
  CustomerNotificationList,
  CustomerProfile,
  CustomerWishlist,
  HomeLayoutDefinition,
  OrderSummary,
  PaginatedResponse,
  ProductDetail,
  ProductListQuery,
  ProductSummary,
  StorefrontConfig
} from "@/types/storefront";
import type { OrderTimelineResponse } from "@/types/orderTimeline";

import { apiFetch, isApiError } from "../http";
import { loadStorefrontSnapshot } from "@/lib/snapshots/loaders";
import { isSnapshotFallbackEnabled } from "@/lib/resilience-flags";
import type { StorefrontSnapshot } from "@/lib/snapshots/types";

let cachedFallbackCategories: CategorySummary[] | null = null;

export const resetSnapshotCaches = () => {
  cachedFallbackCategories = null;
};

const loadFallbackCategoriesFromSnapshot = async (): Promise<CategorySummary[]> => {
  if (cachedFallbackCategories) {
    return cachedFallbackCategories;
  }
  const record = await loadStorefrontSnapshot();
  if (!record) {
    return [];
  }
  cachedFallbackCategories = record.value.categories ?? [];
  return cachedFallbackCategories;
};

const selectSnapshotProducts = (
  snapshot: StorefrontSnapshot,
  query: ProductListQuery,
): ProductSummary[] => {
  if (query.categorySlug) {
    const byCategory = snapshot.products.byCategory[query.categorySlug];
    if (byCategory && byCategory.length) {
      return byCategory;
    }
  }

  switch (query.sort) {
    case "newest":
      return snapshot.products.newest;
    case "best-sellers":
      return snapshot.products.bestSellers;
    case "featured":
    default:
      return snapshot.products.featured;
  }
};

const buildPaginatedResponse = (
  items: ProductSummary[],
  query: ProductListQuery,
): PaginatedResponse<ProductSummary> => {
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 12;
  const page = query.page && query.page > 0 ? query.page : 1;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    data: items.slice(start, end),
    total,
    page,
    pageSize,
    totalPages,
  };
};

export interface StorefrontAddressInput {
  street: string;
  number: string;
  city: string;
  country: string;
  label?: string | null;
  corner?: string | null;
  apartment?: string | null;
  comments?: string | null;
  isPrimary?: boolean | null;
}

export interface MercadoPagoChargeRequest {
  token: string;
  transactionAmount: number;
  currency: string;
  installments: number;
  paymentMethodId: string;
  payer: {
    email: string;
    identification: { type: string; number: string };
    firstName?: string;
    lastName?: string;
  };
  issuerId?: string;
  description?: string;
  orderId?: string;
  cartId?: string;
  statementDescriptor?: string;
}

export interface MercadoPagoChargeResponse {
  status: string;
  statusDetail?: string | null;
  paymentId?: string | null;
  paymentIntentId: string;
  cartId?: string | null;
  orderId?: number | null;
  amount: number;
  currency: string;
  installments?: number | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  cardholderName?: string | null;
  createdAt: string;
}

export interface MercadoPagoPreferenceRequest {
  amount: number;
  currency: string;
  description?: string;
  cartId?: string;
  orderId?: string;
  statementDescriptor?: string;
  payerEmail?: string;
  successUrl?: string;
  failureUrl?: string;
  pendingUrl?: string;
}

export interface MercadoPagoPreferenceResponse {
  preferenceId: string;
}

export interface GoogleAuthStartResponse {
  url: string;
  state: string;
  expiresAt: string;
}

export const StorefrontApi = {
  async getConfig(slug?: string): Promise<StorefrontConfig> {
    return apiFetch<StorefrontConfig>("config", {
      params: slug ? { clientSlug: slug } : undefined,
      cache: "no-store"
    });
  },

  async getHomeLayout(layoutKey: string): Promise<HomeLayoutDefinition> {
    return apiFetch<HomeLayoutDefinition>(`home-layouts/${encodeURIComponent(layoutKey)}`, {
      cache: "no-store"
    });
  },

  async listProducts(query: ProductListQuery = {}): Promise<PaginatedResponse<ProductSummary>> {
    try {
      return await apiFetch<PaginatedResponse<ProductSummary>>("products", {
        params: {
          page: query.page,
          pageSize: query.pageSize,
          category: query.categorySlug,
          search: query.search,
          sort: query.sort,
          tag: query.tag
        },
        cache: "no-store"
      });
    } catch (error) {
      if (isSnapshotFallbackEnabled()) {
        const record = await loadStorefrontSnapshot();
        if (record) {
          const fallbackItems = selectSnapshotProducts(record.value, query);
          if (fallbackItems.length) {
            const status = isApiError(error) ? error.status : "unknown";
            console.warn(
              `[storefront] products endpoint unavailable (status: ${status}). Serving snapshot dataset.`,
            );
            const unique = Array.from(
              new Map(fallbackItems.map((item) => [item.slug ?? item.id, item])).values(),
            );
            return buildPaginatedResponse(unique, query);
          }
        }
      }
      throw error;
    }
  },

  async getProduct(slugOrId: string): Promise<ProductDetail> {
    return apiFetch<ProductDetail>(`products/${encodeURIComponent(slugOrId)}`, {
      cache: "no-store"
    });
  },

  async getProductParametricConfig(productId: number): Promise<Record<string, any>> {
    return apiFetch<Record<string, any>>(`products/${productId}/parametric-config`, {
      cache: "no-store"
    });
  },

  async quoteParametricProduct(
    productId: number,
    payload: Record<string, unknown>
  ): Promise<any> {
    return apiFetch(`products/${productId}/parametric-quote`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });
  },

  async listCategories(): Promise<CategorySummary[]> {
    try {
      return await apiFetch<CategorySummary[]>("categories", {
        cache: "no-store"
      });
    } catch (error) {
      if (isSnapshotFallbackEnabled()) {
        const fallback = await loadFallbackCategoriesFromSnapshot();
        if (fallback.length) {
          const status = isApiError(error) ? error.status : "unknown";
          console.warn(
            `[storefront] categories endpoint unavailable (status: ${status}). Serving snapshot dataset.`,
          );
          return fallback;
        }
      }
      throw error;
    }
  },

  async getRecommendations(productId: number, limit = 8): Promise<ProductSummary[]> {
    return apiFetch<ProductSummary[]>(`products/${productId}/recommendations`, {
      params: { limit },
      cache: "no-store"
    });
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
      cache: "no-store"
    });
  },

  async logout(): Promise<void> {
    await apiFetch("auth/logout", {
      method: "POST",
      cache: "no-store"
    });
  },

  async register(
    payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      locale?: string;
    }
  ): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  },

  async startGoogleLogin(returnPath?: string): Promise<GoogleAuthStartResponse> {
    return apiFetch<GoogleAuthStartResponse>("auth/google/start", {
      method: "POST",
      body: JSON.stringify(returnPath ? { returnPath } : {}),
      cache: "no-store"
    });
  },

  async getCurrentSession(): Promise<AuthSession | null> {
    return apiFetch<AuthSession | null>("auth/session", {
      cache: "no-store"
    });
  },

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      cache: "no-store"
    });
  },

  async createOrder(payload: CreateOrderPayload): Promise<OrderSummary> {
    return apiFetch<OrderSummary>("orders", {
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  },

  async listNotifications(
    token: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<CustomerNotificationList> {
    return apiFetch<CustomerNotificationList>("account/notifications", {
      params,
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getNotificationUnreadCount(token: string): Promise<{ count: number }> {
    return apiFetch<{ count: number }>("account/notifications/unread-count", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async markNotificationsRead(
    token: string,
    payload: { ids?: number[]; markAll?: boolean }
  ): Promise<void> {
    await apiFetch("account/notifications/read", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async createMercadoPagoCharge(
    payload: MercadoPagoChargeRequest,
    options: { idempotencyKey?: string } = {}
  ): Promise<MercadoPagoChargeResponse> {
    const headers: Record<string, string> = {};
    if (options.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }
    return apiFetch(
      "payments/mercadopago/charge",
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers,
        cache: "no-store"
      }
    );
  },

  async createMercadoPagoPreference(
    payload: MercadoPagoPreferenceRequest
  ): Promise<MercadoPagoPreferenceResponse> {
    return apiFetch(
      "payments/mercadopago/preference",
      {
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );
  },

  async getAccountProfile(token: string): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>("account/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async updateAccountProfile(
    token: string,
    payload: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      dateOfBirth?: string | null;
      locale?: string | null;
    }
  ): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>("account/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async listOrders(token: string): Promise<OrderSummary[]> {
    return apiFetch<OrderSummary[]>("account/orders", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getOrder(token: string, identifier: string): Promise<OrderSummary> {
    return apiFetch<OrderSummary>(`account/orders/${encodeURIComponent(identifier)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getOrderTimeline(token: string, identifier: string): Promise<OrderTimelineResponse> {
    return apiFetch<OrderTimelineResponse>(
      `account/orders/${encodeURIComponent(identifier)}/timeline`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      },
    );
  },

  async listAddresses(token: string) {
    return apiFetch<CustomerProfile["addresses"]>("account/addresses", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async createAddress(token: string, payload: StorefrontAddressInput): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>("account/addresses", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async updateAddress(token: string, addressId: number, payload: StorefrontAddressInput): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>(`account/addresses/${addressId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async deleteAddress(token: string, addressId: number): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>(`account/addresses/${addressId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async setPrimaryAddress(token: string, addressId: number): Promise<CustomerProfile> {
    return apiFetch<CustomerProfile>(`account/addresses/${addressId}/set-primary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getWishlist(token: string): Promise<CustomerWishlist> {
    return apiFetch<CustomerWishlist>("account/wishlist", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async addWishlistItem(token: string, productId: number): Promise<CustomerWishlist> {
    return apiFetch<CustomerWishlist>("account/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async removeWishlistItem(token: string, productId: number): Promise<CustomerWishlist> {
    return apiFetch<CustomerWishlist>(`account/wishlist/${productId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
  },

  async getCurrencySettings(): Promise<{
    baseCurrency: string;
    enabledCurrencies: string[];
    rates: Record<string, number>;
    generatedAt: string;
  }> {
    return apiFetch("currencies", {
      cache: "no-store"
    });
  }
};

export { isApiError } from "@/lib/http";

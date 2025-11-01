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

import { apiFetch } from "../http";

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

export interface GoogleAuthStartResponse {
  url: string;
  state: string;
  expiresAt: string;
}

export const StorefrontApi = {
  async getConfig(): Promise<StorefrontConfig> {
    return apiFetch<StorefrontConfig>("config", {
      cache: "no-store"
    });
  },

  async getHomeLayout(layoutKey: string): Promise<HomeLayoutDefinition> {
    return apiFetch<HomeLayoutDefinition>(`home-layouts/${encodeURIComponent(layoutKey)}`, {
      cache: "no-store"
    });
  },

  async listProducts(query: ProductListQuery = {}): Promise<PaginatedResponse<ProductSummary>> {
    return apiFetch<PaginatedResponse<ProductSummary>>("products", {
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
    return apiFetch<CategorySummary[]>("categories", {
      cache: "no-store"
    });
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

  async getCurrentSession(): Promise<AuthSession> {
    return apiFetch<AuthSession>("auth/session", {
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

import type {
  AuthSession,
  CategorySummary,
  CreateOrderPayload,
  CustomerProfile,
  HomeLayoutDefinition,
  OrderSummary,
  PaginatedResponse,
  ProductDetail,
  ProductListQuery,
  ProductSummary,
  StorefrontConfig
} from "@/types/storefront";

import { apiFetch, ApiError } from "../http";

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
  }
};

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
